import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY

// Supabase 是可选的，如果没有配置则某些功能（视频上传、RAG 检索）将不可用
// 但语音交互功能仍然可以正常工作
if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('⚠️  Supabase not configured. Video upload and RAG features will be disabled.')
  console.warn('   To enable these features, set SUPABASE_URL and SUPABASE_ANON_KEY in .env.local')
}

// 注意：这里不使用类型参数，因为 pgvector 的向量类型在 Supabase SDK 中不被正确支持
// 类型安全通过 database.ts 中的类型定义在应用层保证
const _supabase = (supabaseUrl && supabaseAnonKey)
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null

// 导出可能为 null 的版本（用于条件检查）
export { _supabase as supabaseClient }

// 导出非 null 版本（大部分 API 路由使用）
// 在 Supabase 未配置时调用会抛出错误，但生产环境始终配置
export const supabase = _supabase!
