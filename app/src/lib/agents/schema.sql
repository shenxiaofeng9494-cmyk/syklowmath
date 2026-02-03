-- ============================================================
-- V2 学习分析系统 - 数据库表结构（无 embedding 版本）
-- 执行方式: 在 Supabase SQL Editor 中运行
-- ============================================================

-- 1. 学生画像表
CREATE TABLE IF NOT EXISTS student_profiles (
  student_id TEXT PRIMARY KEY,
  overall_level NUMERIC DEFAULT 50,
  dimensions JSONB DEFAULT '{
    "conceptUnderstanding": 50,
    "procedureExecution": 50,
    "reasoning": 50,
    "transfer": 50,
    "selfExplanation": 50
  }'::jsonb,
  preferred_style TEXT DEFAULT '参与感选择',
  total_sessions INTEGER DEFAULT 0,
  recent_trend TEXT DEFAULT 'stable',
  knowledge_gaps TEXT[] DEFAULT '{}',
  recent_problem_tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. 学习快照表
CREATE TABLE IF NOT EXISTS learning_snapshots (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  student_id TEXT REFERENCES student_profiles(student_id) ON DELETE CASCADE,
  video_id TEXT,
  overall_level NUMERIC,
  dimensions JSONB,
  problem_tags TEXT[],
  preferred_style TEXT,
  next_strategy JSONB DEFAULT '{
    "introQuestionCount": 1,
    "midpointQuestion": true,
    "difficulty": 5,
    "focusAreas": []
  }'::jsonb,
  key_observations TEXT[],
  conversation_summary TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. 情景记忆表（无 embedding，用关键词搜索替代）
CREATE TABLE IF NOT EXISTS episodic_memories (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  student_id TEXT REFERENCES student_profiles(student_id) ON DELETE CASCADE,
  video_id TEXT,
  event TEXT NOT NULL,
  keywords TEXT[] DEFAULT '{}',  -- 用关键词替代 embedding
  metadata JSONB DEFAULT '{}'::jsonb,
  importance INTEGER DEFAULT 3,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. 对话日志表
CREATE TABLE IF NOT EXISTS conversation_logs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  student_id TEXT REFERENCES student_profiles(student_id) ON DELETE CASCADE,
  video_id TEXT,
  session_id TEXT,
  messages JSONB NOT NULL,
  total_duration_seconds INTEGER,
  silence_count INTEGER DEFAULT 0,
  active_question_count INTEGER DEFAULT 0,
  checkpoint_responses JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_snapshots_student ON learning_snapshots(student_id);
CREATE INDEX IF NOT EXISTS idx_snapshots_created ON learning_snapshots(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_episodes_student ON episodic_memories(student_id);
CREATE INDEX IF NOT EXISTS idx_episodes_keywords ON episodic_memories USING GIN(keywords);
CREATE INDEX IF NOT EXISTS idx_logs_student ON conversation_logs(student_id);

-- 情景记忆搜索函数（基于关键词）
CREATE OR REPLACE FUNCTION search_episodic_memories_by_keywords(
  target_student_id TEXT,
  search_keywords TEXT[],
  match_count INT DEFAULT 5
)
RETURNS TABLE(
  id TEXT,
  event TEXT,
  video_id TEXT,
  keywords TEXT[],
  importance INTEGER,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    em.id,
    em.event,
    em.video_id,
    em.keywords,
    em.importance,
    em.created_at
  FROM episodic_memories em
  WHERE em.student_id = target_student_id
    AND em.keywords && search_keywords  -- 有交集
  ORDER BY em.importance DESC, em.created_at DESC
  LIMIT match_count;
END;
$$ LANGUAGE plpgsql;

-- 自动更新 updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_profiles_updated_at ON student_profiles;
CREATE TRIGGER trigger_profiles_updated_at
  BEFORE UPDATE ON student_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
