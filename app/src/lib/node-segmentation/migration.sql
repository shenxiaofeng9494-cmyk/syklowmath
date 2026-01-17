-- Node Segmentation V1 - Database Migration
-- 为 video_nodes 表添加 V1 新字段
--
-- 运行方式：在 Supabase SQL Editor 中执行此脚本

-- Step 1: 添加新字段
ALTER TABLE video_nodes ADD COLUMN IF NOT EXISTS boundary_confidence REAL DEFAULT 0;
ALTER TABLE video_nodes ADD COLUMN IF NOT EXISTS boundary_signals TEXT[] DEFAULT '{}';
ALTER TABLE video_nodes ADD COLUMN IF NOT EXISTS boundary_reason TEXT;
ALTER TABLE video_nodes ADD COLUMN IF NOT EXISTS node_type TEXT CHECK (node_type IN ('concept', 'method', 'example', 'summary', 'transition'));
ALTER TABLE video_nodes ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;
ALTER TABLE video_nodes ADD COLUMN IF NOT EXISTS created_by TEXT DEFAULT 'auto' CHECK (created_by IN ('auto', 'human'));

-- Step 2: 为已存在的记录设置默认值
UPDATE video_nodes
SET
  boundary_confidence = 0.5,
  boundary_signals = '{}',
  boundary_reason = '由 V0 自动切分生成',
  version = 0,
  created_by = 'auto'
WHERE boundary_confidence IS NULL;

-- Step 3: 创建索引以优化查询
CREATE INDEX IF NOT EXISTS idx_video_nodes_version ON video_nodes(video_id, version);
CREATE INDEX IF NOT EXISTS idx_video_nodes_created_by ON video_nodes(created_by);
CREATE INDEX IF NOT EXISTS idx_video_nodes_node_type ON video_nodes(node_type);

-- 完成提示
DO $$
BEGIN
  RAISE NOTICE 'V1 migration completed successfully!';
  RAISE NOTICE 'New columns: boundary_confidence, boundary_signals, boundary_reason, node_type, version, created_by';
END $$;
