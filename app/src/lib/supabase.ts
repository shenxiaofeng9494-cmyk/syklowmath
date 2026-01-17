import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables: SUPABASE_URL and SUPABASE_ANON_KEY are required')
}

// 注意：这里不使用类型参数，因为 pgvector 的向量类型在 Supabase SDK 中不被正确支持
// 类型安全通过 database.ts 中的类型定义在应用层保证
export const supabase = createClient(supabaseUrl, supabaseAnonKey)
