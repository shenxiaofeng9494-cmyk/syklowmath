-- Node Segmentation V2 - Database Migration
-- 更新 node_type 约束以支持更多类型
--
-- 运行方式：在 Supabase SQL Editor 中执行此脚本

-- Step 1: 删除旧的 CHECK 约束
ALTER TABLE video_nodes DROP CONSTRAINT IF EXISTS video_nodes_node_type_check;

-- Step 2: 添加新的 CHECK 约束（包含 V2 新增类型）
ALTER TABLE video_nodes ADD CONSTRAINT video_nodes_node_type_check
  CHECK (node_type IN ('intro', 'concept', 'method', 'example', 'pitfall', 'summary', 'transition', 'other'));

-- 完成提示
DO $$
BEGIN
  RAISE NOTICE 'V2 migration completed successfully!';
  RAISE NOTICE 'node_type now supports: intro, concept, method, example, pitfall, summary, transition, other';
END $$;
