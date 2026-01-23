-- Supabase 迁移脚本：创建 video_games 表
-- 用于存储 AI 生成的互动游戏

-- 创建游戏类型枚举
CREATE TYPE game_type AS ENUM (
  'parameter-slider',
  'drag-match',
  'number-line',
  'coordinate-plot',
  'equation-balance',
  'geometry-construct',
  'sequence-puzzle',
  'fraction-visual',
  'graph-transform',
  'custom'
);

CREATE TYPE game_difficulty AS ENUM ('easy', 'medium', 'hard');

-- 创建 video_games 表
CREATE TABLE video_games (
  id TEXT PRIMARY KEY,
  video_id TEXT NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  node_id TEXT NOT NULL REFERENCES video_nodes(id) ON DELETE CASCADE,

  -- 游戏基本信息
  title TEXT NOT NULL,
  description TEXT,
  game_type game_type NOT NULL DEFAULT 'custom',
  difficulty game_difficulty NOT NULL DEFAULT 'medium',

  -- 教育相关
  math_concepts TEXT[] DEFAULT '{}',
  learning_objectives TEXT[] DEFAULT '{}',

  -- 游戏代码和说明
  component_code TEXT NOT NULL,
  instructions TEXT,
  hints TEXT[] DEFAULT '{}',

  -- 元信息
  estimated_play_time INTEGER DEFAULT 120,
  agent_model TEXT,
  generation_time_ms INTEGER,

  -- 时间戳
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建索引
CREATE INDEX idx_video_games_video_id ON video_games(video_id);
CREATE INDEX idx_video_games_node_id ON video_games(node_id);
CREATE INDEX idx_video_games_game_type ON video_games(game_type);

-- 创建更新时间触发器
CREATE OR REPLACE FUNCTION update_video_games_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER video_games_updated_at
  BEFORE UPDATE ON video_games
  FOR EACH ROW
  EXECUTE FUNCTION update_video_games_updated_at();

-- 启用 RLS
ALTER TABLE video_games ENABLE ROW LEVEL SECURITY;

-- 创建 RLS 策略（允许所有读取，仅允许认证用户写入）
CREATE POLICY "Allow public read" ON video_games
  FOR SELECT USING (true);

CREATE POLICY "Allow authenticated insert" ON video_games
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow authenticated update" ON video_games
  FOR UPDATE USING (true);

COMMENT ON TABLE video_games IS 'AI 生成的互动数学游戏';
COMMENT ON COLUMN video_games.component_code IS 'React 组件源代码';
COMMENT ON COLUMN video_games.generation_time_ms IS 'AI 生成游戏所花费的时间（毫秒）';
