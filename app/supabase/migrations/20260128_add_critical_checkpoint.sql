-- 为 video_nodes 表添加 critical_checkpoint 相关字段
-- 用于实现"老师主动介入"功能

ALTER TABLE video_nodes
ADD COLUMN IF NOT EXISTS is_critical_checkpoint BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS checkpoint_type TEXT,
ADD COLUMN IF NOT EXISTS checkpoint_question TEXT,
ADD COLUMN IF NOT EXISTS checkpoint_expected_answer TEXT,
ADD COLUMN IF NOT EXISTS checkpoint_followup TEXT,
ADD COLUMN IF NOT EXISTS silence_threshold_seconds INTEGER DEFAULT 5;

-- 添加注释
COMMENT ON COLUMN video_nodes.is_critical_checkpoint IS '是否为必停点（老师主动介入点）';
COMMENT ON COLUMN video_nodes.checkpoint_type IS '检查点类型：motivation/definition/pitfall/summary等';
COMMENT ON COLUMN video_nodes.checkpoint_question IS '老师提问内容（语音）';
COMMENT ON COLUMN video_nodes.checkpoint_expected_answer IS '期望答案类型：yes_no/short_answer/multiple_choice';
COMMENT ON COLUMN video_nodes.checkpoint_followup IS '追问内容（可选，用于验证不是蒙对）';
COMMENT ON COLUMN video_nodes.silence_threshold_seconds IS '学生沉默多久后触发介入（秒）';

-- 创建索引以优化查询
CREATE INDEX IF NOT EXISTS idx_video_nodes_critical_checkpoint
ON video_nodes(video_id, is_critical_checkpoint)
WHERE is_critical_checkpoint = TRUE;
