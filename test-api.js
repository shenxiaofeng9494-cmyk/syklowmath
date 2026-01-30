// 测试必停点功能
async function test() {
  const API = 'http://localhost:3000'

  // 1. 检查是否有视频
  console.log('1️⃣ 检查视频数据...')
  const videosRes = await fetch(`${API}/api/video`)
  const videosData = await videosRes.json()
  console.log('视频数量:', videosData.videos?.length || 0)

  if (!videosData.videos || videosData.videos.length === 0) {
    console.log('❌ 没有视频数据')
    console.log('需要先上传视频或创建测试数据')
    return
  }

  const video = videosData.videos[0]
  console.log('✅ 使用视频:', video.title)

  // 2. 获取视频节点
  console.log('\n2️⃣ 获取视频节点...')
  const nodesRes = await fetch(`${API}/api/video/${video.id}/nodes`)
  const nodesData = await nodesRes.json()
  console.log('节点数量:', nodesData.nodes?.length || 0)

  if (!nodesData.nodes || nodesData.nodes.length === 0) {
    console.log('❌ 视频没有节点')
    return
  }

  const node = nodesData.nodes[0]
  console.log('✅ 使用节点:', node.title)

  // 3. 配置必停点（Case 1: 动机段）
  console.log('\n3️⃣ 配置必停点...')
  const configRes = await fetch(`${API}/api/video/${video.id}/checkpoint`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      nodeId: node.id,
      checkpointType: 'motivation',
      question: '我停一下。用一次方程，能不能解 x(x+3)=18？回答：能 / 不能。',
      expectedAnswer: 'yes_no',
      silenceThreshold: 5
    })
  })

  if (configRes.ok) {
    console.log('✅ 必停点配置成功')
  } else {
    const error = await configRes.json()
    console.log('❌ 配置失败:', error)
  }

  // 4. 查询必停点
  console.log('\n4️⃣ 查询必停点...')
  const checkpointsRes = await fetch(`${API}/api/video/${video.id}/checkpoint`)
  const checkpointsData = await checkpointsRes.json()
  console.log('必停点数量:', checkpointsData.count)
  console.log('必停点列表:', checkpointsData.data)

  console.log('\n✅ 测试完成！')
}

test().catch(console.error)
