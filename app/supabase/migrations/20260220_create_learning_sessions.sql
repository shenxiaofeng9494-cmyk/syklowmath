-- 创建 learning_sessions 表
-- 用于跨语音模式（实时/精准）共享学生对话上下文，解决模式切换时上下文断裂问题

CREATE TABLE IF NOT EXISTS learning_sessions (
  session_id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  student_id TEXT NOT NULL,
  video_id TEXT NOT NULL,
  status TEXT CHECK (status IN ('active', 'ended')) DEFAULT 'active',

  -- 对话轮次计数
  turn_count INTEGER DEFAULT 0,

  -- LLM 生成的对话摘要（<= 300 字）
  context_summary TEXT DEFAULT '',

  -- 最近 3 轮 Q&A（FIFO，精简版）
  recent_qa JSONB DEFAULT '[]'::jsonb,

  -- 概念触达状态 { "概念名": "touched" | "confused" | "understood" }
  concepts_touched JSONB DEFAULT '{}'::jsonb,

  -- 计划状态（已触发/已失效的 checkpoint 等）
  plan_state JSONB DEFAULT '{"checkpoints_triggered":[],"checkpoints_invalidated":[],"next_suggested_action":null}'::jsonb,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ
);

-- 索引：快速查找学生的活跃 session
CREATE INDEX IF NOT EXISTS idx_learning_sessions_active
  ON learning_sessions(student_id, video_id, status)
  WHERE status = 'active';

-- 索引：按学生查找历史 session
CREATE INDEX IF NOT EXISTS idx_learning_sessions_student
  ON learning_sessions(student_id, created_at DESC);

-- 注释
COMMENT ON TABLE learning_sessions IS '学习会话表，用于跨语音模式共享上下文';
COMMENT ON COLUMN learning_sessions.context_summary IS 'LLM 生成的对话摘要，注入到下一次语音 session 的 system prompt 中';
COMMENT ON COLUMN learning_sessions.recent_qa IS '最近 3 轮问答的精简版 [{q, a, mode, ts}]';
COMMENT ON COLUMN learning_sessions.concepts_touched IS '概念理解状态 {"概念名": "touched"|"confused"|"understood"}';
COMMENT ON COLUMN learning_sessions.plan_state IS '检查点计划状态 {checkpoints_triggered, checkpoints_invalidated, next_suggested_action}';
