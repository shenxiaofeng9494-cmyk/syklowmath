-- RAG 节点检索 - Supabase RPC 函数
--
-- 使用方法：在 Supabase SQL Editor 中执行此脚本
--
-- 前置条件：
-- 1. 已启用 pgvector 扩展: CREATE EXTENSION IF NOT EXISTS vector;
-- 2. video_nodes 表已存在且有 embedding 列 (VECTOR(1024))

-- ============================================
-- 0. 删除旧函数（如果存在）
-- ============================================
DO $$
DECLARE
  func_record RECORD;
BEGIN
  -- 查找并删除所有同名函数
  FOR func_record IN
    SELECT ns.nspname AS schema_name, p.proname AS func_name,
           pg_get_function_identity_arguments(p.oid) AS func_args
    FROM pg_proc p
    JOIN pg_namespace ns ON p.pronamespace = ns.oid
    WHERE p.proname IN ('search_video_nodes', 'hybrid_search_nodes', 'get_node_by_time', 'get_node_context')
      AND ns.nspname = 'public'
  LOOP
    EXECUTE format('DROP FUNCTION IF EXISTS %I.%I(%s)',
                   func_record.schema_name,
                   func_record.func_name,
                   func_record.func_args);
  END LOOP;
END $$;

-- ============================================
-- 1. 向量相似度检索函数
-- ============================================
CREATE OR REPLACE FUNCTION search_video_nodes(
  query_embedding VECTOR(1024),
  target_video_id TEXT,
  match_threshold FLOAT DEFAULT 0.5,
  match_count INT DEFAULT 3
)
RETURNS TABLE (
  id TEXT,
  video_id TEXT,
  "order" INT,
  start_time INT,
  end_time INT,
  title TEXT,
  summary TEXT,
  key_concepts TEXT[],
  transcript TEXT,
  node_type TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    vn.id,
    vn.video_id,
    vn."order",
    vn.start_time,
    vn.end_time,
    vn.title,
    vn.summary,
    vn.key_concepts,
    vn.transcript,
    vn.node_type,
    1 - (vn.embedding <=> query_embedding) AS similarity
  FROM video_nodes vn
  WHERE vn.video_id = target_video_id
    AND vn.embedding IS NOT NULL
    AND 1 - (vn.embedding <=> query_embedding) > match_threshold
  ORDER BY vn.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- ============================================
-- 2. 混合检索函数（向量 + 关键词）
-- ============================================
CREATE OR REPLACE FUNCTION hybrid_search_nodes(
  query_embedding VECTOR(1024),
  target_video_id TEXT,
  search_keywords TEXT[] DEFAULT '{}',
  match_threshold FLOAT DEFAULT 0.3,
  match_count INT DEFAULT 5
)
RETURNS TABLE (
  id TEXT,
  video_id TEXT,
  "order" INT,
  start_time INT,
  end_time INT,
  title TEXT,
  summary TEXT,
  key_concepts TEXT[],
  transcript TEXT,
  node_type TEXT,
  semantic_score FLOAT,
  keyword_score FLOAT,
  final_score FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH semantic_search AS (
    -- 语义检索：向量相似度
    SELECT
      vn.id,
      vn.video_id,
      vn."order",
      vn.start_time,
      vn.end_time,
      vn.title,
      vn.summary,
      vn.key_concepts,
      vn.transcript,
      vn.node_type,
      1 - (vn.embedding <=> query_embedding) AS sem_score
    FROM video_nodes vn
    WHERE vn.video_id = target_video_id
      AND vn.embedding IS NOT NULL
  ),
  keyword_search AS (
    -- 关键词检索：key_concepts 数组匹配
    SELECT
      vn.id,
      -- 计算关键词匹配得分：匹配数 / 总关键词数
      CASE
        WHEN array_length(search_keywords, 1) > 0 THEN
          (
            SELECT COUNT(*)::FLOAT
            FROM unnest(vn.key_concepts) AS concept
            WHERE EXISTS (
              SELECT 1 FROM unnest(search_keywords) AS kw
              WHERE concept ILIKE '%' || kw || '%'
            )
          ) / GREATEST(array_length(search_keywords, 1), 1)
        ELSE 0
      END AS kw_score
    FROM video_nodes vn
    WHERE vn.video_id = target_video_id
  )
  SELECT
    s.id,
    s.video_id,
    s."order",
    s.start_time,
    s.end_time,
    s.title,
    s.summary,
    s.key_concepts,
    s.transcript,
    s.node_type,
    s.sem_score AS semantic_score,
    COALESCE(k.kw_score, 0) AS keyword_score,
    -- 综合得分：语义 70% + 关键词 30%
    s.sem_score * 0.7 + COALESCE(k.kw_score, 0) * 0.3 AS final_score
  FROM semantic_search s
  LEFT JOIN keyword_search k ON s.id = k.id
  WHERE s.sem_score > match_threshold
     OR COALESCE(k.kw_score, 0) > 0
  ORDER BY (s.sem_score * 0.7 + COALESCE(k.kw_score, 0) * 0.3) DESC
  LIMIT match_count;
END;
$$;

-- ============================================
-- 3. 根据时间获取当前节点
-- ============================================
CREATE OR REPLACE FUNCTION get_node_by_time(
  target_video_id TEXT,
  playback_time INT
)
RETURNS TABLE (
  id TEXT,
  video_id TEXT,
  "order" INT,
  start_time INT,
  end_time INT,
  title TEXT,
  summary TEXT,
  key_concepts TEXT[],
  transcript TEXT,
  node_type TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    vn.id,
    vn.video_id,
    vn."order",
    vn.start_time,
    vn.end_time,
    vn.title,
    vn.summary,
    vn.key_concepts,
    vn.transcript,
    vn.node_type
  FROM video_nodes vn
  WHERE vn.video_id = target_video_id
    AND vn.start_time <= playback_time
    AND vn.end_time > playback_time
  LIMIT 1;
END;
$$;

-- ============================================
-- 4. 获取节点上下文（当前 + 前后相邻）
-- ============================================
CREATE OR REPLACE FUNCTION get_node_context(
  target_video_id TEXT,
  target_node_order INT
)
RETURNS TABLE (
  id TEXT,
  video_id TEXT,
  node_order INT,
  start_time INT,
  end_time INT,
  title TEXT,
  summary TEXT,
  key_concepts TEXT[],
  transcript TEXT,
  node_type TEXT,
  relative_pos TEXT  -- 'previous', 'current', 'next'
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    vn.id,
    vn.video_id,
    vn."order",
    vn.start_time,
    vn.end_time,
    vn.title,
    vn.summary,
    vn.key_concepts,
    vn.transcript,
    vn.node_type,
    CASE
      WHEN vn."order" = target_node_order - 1 THEN 'previous'
      WHEN vn."order" = target_node_order THEN 'current'
      WHEN vn."order" = target_node_order + 1 THEN 'next'
    END AS relative_pos
  FROM video_nodes vn
  WHERE vn.video_id = target_video_id
    AND vn."order" BETWEEN target_node_order - 1 AND target_node_order + 1
  ORDER BY vn."order";
END;
$$;

-- ============================================
-- 5. 索引优化（如果不存在则创建）
-- ============================================

-- 向量索引（HNSW 算法，比 IVFFlat 更快）
-- 注意：如果数据量小（< 1000），可以先不创建索引
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'video_nodes_embedding_hnsw_idx'
  ) THEN
    CREATE INDEX video_nodes_embedding_hnsw_idx
    ON video_nodes
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);
  END IF;
END $$;

-- 关键词数组索引（GIN）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'video_nodes_key_concepts_gin_idx'
  ) THEN
    CREATE INDEX video_nodes_key_concepts_gin_idx
    ON video_nodes
    USING GIN (key_concepts);
  END IF;
END $$;

-- 视频ID + 时间复合索引
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'video_nodes_video_time_idx'
  ) THEN
    CREATE INDEX video_nodes_video_time_idx
    ON video_nodes (video_id, start_time, end_time);
  END IF;
END $$;

-- ============================================
-- 完成提示
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '✅ RAG 函数创建完成！';
  RAISE NOTICE '';
  RAISE NOTICE '可用函数：';
  RAISE NOTICE '  - search_video_nodes(embedding, video_id, threshold, count)';
  RAISE NOTICE '  - hybrid_search_nodes(embedding, video_id, keywords, threshold, count)';
  RAISE NOTICE '  - get_node_by_time(video_id, playback_time)';
  RAISE NOTICE '  - get_node_context(video_id, node_order)';
END $$;
