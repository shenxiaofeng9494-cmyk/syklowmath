-- 创建基础表结构
-- 这是MathTalkTV项目的核心数据表

-- 1. 创建 videos 表
CREATE TABLE IF NOT EXISTS videos (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  duration INTEGER NOT NULL,
  video_url TEXT NOT NULL,
  teacher TEXT,
  node_count INTEGER DEFAULT 0,
  status TEXT CHECK (status IN ('pending', 'processing', 'ready', 'error')) DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

-- 2. 创建 video_nodes 表
CREATE TABLE IF NOT EXISTS video_nodes (
  id TEXT PRIMARY KEY,
  video_id TEXT NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  "order" INTEGER NOT NULL,
  start_time INTEGER NOT NULL,
  end_time INTEGER NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  key_concepts TEXT[] DEFAULT '{}',
  transcript TEXT,
  embedding VECTOR(1536),
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- V1 字段
  boundary_confidence FLOAT DEFAULT 0,
  boundary_signals TEXT[] DEFAULT '{}',
  boundary_reason TEXT,
  node_type TEXT,
  version INTEGER DEFAULT 1,
  created_by TEXT DEFAULT 'auto',

  -- Critical Checkpoint 字段（必停点）
  is_critical_checkpoint BOOLEAN DEFAULT FALSE,
  checkpoint_type TEXT,
  checkpoint_question TEXT,
  checkpoint_expected_answer TEXT,
  checkpoint_followup TEXT,
  silence_threshold_seconds INTEGER DEFAULT 5
);

-- 3. 创建索引
CREATE INDEX IF NOT EXISTS idx_video_nodes_video_id ON video_nodes(video_id);
CREATE INDEX IF NOT EXISTS idx_video_nodes_order ON video_nodes(video_id, "order");
CREATE INDEX IF NOT EXISTS idx_video_nodes_critical_checkpoint
  ON video_nodes(video_id, is_critical_checkpoint)
  WHERE is_critical_checkpoint = TRUE;

-- 4. 创建向量搜索函数
CREATE OR REPLACE FUNCTION search_video_nodes(
  query_embedding VECTOR(1536),
  target_video_id TEXT DEFAULT NULL,
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 5
)
RETURNS TABLE (
  id TEXT,
  video_id TEXT,
  "order" INTEGER,
  start_time INTEGER,
  end_time INTEGER,
  title TEXT,
  summary TEXT,
  key_concepts TEXT[],
  transcript TEXT,
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
    1 - (vn.embedding <=> query_embedding) AS similarity
  FROM video_nodes vn
  WHERE
    (target_video_id IS NULL OR vn.video_id = target_video_id)
    AND vn.embedding IS NOT NULL
    AND 1 - (vn.embedding <=> query_embedding) > match_threshold
  ORDER BY vn.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- 5. 添加注释
COMMENT ON TABLE videos IS '视频表';
COMMENT ON TABLE video_nodes IS '视频知识点节点表';
COMMENT ON COLUMN video_nodes.is_critical_checkpoint IS '是否为必停点（老师主动介入点）';
COMMENT ON COLUMN video_nodes.checkpoint_type IS '检查点类型：motivation/definition/pitfall/summary/verification';
COMMENT ON COLUMN video_nodes.checkpoint_question IS '老师提问内容（语音）';
COMMENT ON COLUMN video_nodes.checkpoint_expected_answer IS '期望答案类型：yes_no/short_answer/multiple_choice';
COMMENT ON COLUMN video_nodes.checkpoint_followup IS '追问内容（可选，用于验证不是蒙对）';
COMMENT ON COLUMN video_nodes.silence_threshold_seconds IS '学生沉默多久后触发介入（秒）';
