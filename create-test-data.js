// 创建测试数据
async function createTestData() {
  const API = 'http://localhost:3000'

  console.log('创建测试视频和节点...\n')

  // 1. 创建测试视频
  const videoId = 'test-video-001'
  const videoData = {
    id: videoId,
    title: '一元二次方程定义课',
    description: 'Phase 1 测试视频',
    duration: 300,
    video_url: 'https://example.com/test.mp4',
    teacher: '测试老师',
    node_count: 3,
    status: 'ready'
  }

  console.log('1️⃣ 创建视频:', videoData.title)

  // 直接插入数据库（通过Supabase）
  const { createClient } = require('@supabase/supabase-js')
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
  )

  const { data: video, error: videoError } = await supabase
    .from('videos')
    .insert(videoData)
    .select()
    .single()

  if (videoError) {
    console.log('❌ 创建视频失败:', videoError.message)
    return
  }

  console.log('✅ 视频创建成功\n')

  // 2. 创建测试节点
  const nodes = [
    {
      id: 'node-001',
      video_id: videoId,
      order: 1,
      start_time: 0,
      end_time: 60,
      title: '引入：为什么要学一元二次方程',
      summary: '讲解一次方程的局限性，引出二次方程的必要性',
      key_concepts: ['一次方程', '二次方程', '方程的次数'],
      node_type: 'intro'
    },
    {
      id: 'node-002',
      video_id: videoId,
      order: 2,
      start_time: 60,
      end_time: 180,
      title: '定义：一元二次方程的标准形式',
      summary: '讲解一元二次方程的定义和标准形式 ax²+bx+c=0',
      key_concepts: ['标准形式', '最高次数', '二次项系数'],
      node_type: 'concept'
    },
    {
      id: 'node-003',
      video_id: videoId,
      order: 3,
      start_time: 180,
      end_time: 300,
      title: '判断：如何判断一元二次方程',
      summary: '讲解判断方法：整式方程、一个未知数、最高次数为2',
      key_concepts: ['整式方程', '判断方法', '易错点'],
      node_type: 'method'
    }
  ]

  console.log('2️⃣ 创建节点...')

  const { data: createdNodes, error: nodesError } = await supabase
    .from('video_nodes')
    .insert(nodes)
    .select()

  if (nodesError) {
    console.log('❌ 创建节点失败:', nodesError.message)
    return
  }

  console.log(`✅ 创建了 ${createdNodes.length} 个节点\n`)

  // 3. 配置必停点（Case 1: 动机段）
  console.log('3️⃣ 配置必停点（Case 1: 动机段）...')

  const configRes = await fetch(`${API}/api/video/${videoId}/checkpoint`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      nodeId: 'node-001',
      checkpointType: 'motivation',
      question: '我停一下。你现在如果只是觉得"二次方程更厉害"，后面你会不知道它到底解决了什么问题。我只问一句：用一次方程，能不能解 x(x+3)=18？回答：能 / 不能。',
      expectedAnswer: 'yes_no',
      silenceThreshold: 5
    })
  })

  if (configRes.ok) {
    console.log('✅ 必停点配置成功\n')
  } else {
    const error = await configRes.json()
    console.log('❌ 配置失败:', error, '\n')
  }

  console.log('✅ 测试数据创建完成！')
  console.log(`\n访问: http://localhost:3000/watch/${videoId}`)
}

// 手动设置环境变量
process.env.SUPABASE_URL = 'https://fpukeccfstbqpaxbpwtj.supabase.co'
process.env.SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZwdWtlY2Nmc3RicXBheGJwd3RqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk1OTE1NzAsImV4cCI6MjA4NTE2NzU3MH0.cXptR4d-AOAQY8lp6G2mBPFa2nETEZTifbwxVrPmil4'

createTestData().catch(console.error)
