// 测试Supabase连接
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  'https://fpukeccfstbqpaxbpwtj.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZwdWtlY2Nmc3RicXBheGJwd3RqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk1OTE1NzAsImV4cCI6MjA4NTE2NzU3MH0.cXptR4d-AOAQY8lp6G2mBPFa2nETEZTifbwxVrPmil4'
)

async function test() {
  console.log('测试Supabase连接...\n')

  const { data, error } = await supabase
    .from('video_nodes')
    .select('*')
    .eq('video_id', 'test-video-001')
    .eq('is_critical_checkpoint', true)

  if (error) {
    console.log('❌ 错误:', error)
  } else {
    console.log('✅ 成功')
    console.log('数据:', JSON.stringify(data, null, 2))
  }
}

test()
