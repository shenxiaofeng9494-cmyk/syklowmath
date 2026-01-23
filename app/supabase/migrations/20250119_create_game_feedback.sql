-- Supabase 迁移脚本：创建 game_feedback 表
-- 用于存储老师对游戏的反馈

-- 创建 game_feedback 表
CREATE TABLE game_feedback (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id TEXT NOT NULL REFERENCES video_games(id) ON DELETE CASCADE,
  video_id TEXT NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  feedback_text TEXT NOT NULL,
  feedback_type TEXT NOT NULL CHECK (feedback_type IN ('positive', 'negative')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建索引
CREATE INDEX idx_game_feedback_game_id ON game_feedback(game_id);
CREATE INDEX idx_game_feedback_video_id ON game_feedback(video_id);
CREATE INDEX idx_game_feedback_created_at ON game_feedback(created_at);

-- 创建更新时间触发器
CREATE OR REPLACE FUNCTION update_game_feedback_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER game_feedback_updated_at
  BEFORE UPDATE ON game_feedback
  FOR EACH ROW
  EXECUTE FUNCTION update_game_feedback_updated_at();

-- 启用 RLS
ALTER TABLE game_feedback ENABLE ROW LEVEL SECURITY;

-- 创建 RLS 策略
CREATE POLICY "Allow public read" ON game_feedback
  FOR SELECT USING (true);

CREATE POLICY "Allow authenticated insert" ON game_feedback
  FOR INSERT WITH CHECK (true);

COMMENT ON TABLE game_feedback IS '老师对游戏生成的反馈记录';
COMMENT ON COLUMN game_feedback.feedback_text IS '具体的反馈文本';
COMMENT ON COLUMN game_feedback.feedback_type IS '反馈类型：positive(正面) 或 negative(负面)';
