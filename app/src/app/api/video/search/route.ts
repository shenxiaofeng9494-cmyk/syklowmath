import { NextRequest, NextResponse } from 'next/server'
import { searchNodes, hybridSearch, getNodeByTime, getAllNodes } from '@/lib/rag'

/**
 * 视频节点搜索 API
 * GET /api/video/search?videoId=xxx&query=xxx
 * GET /api/video/search?videoId=xxx&time=123
 * GET /api/video/search?videoId=xxx&all=true
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const videoId = searchParams.get('videoId')
  const query = searchParams.get('query')
  const time = searchParams.get('time')
  const all = searchParams.get('all')
  const limit = parseInt(searchParams.get('limit') || '3')

  if (!videoId) {
    return NextResponse.json({ error: 'Missing videoId parameter' }, { status: 400 })
  }

  try {
    // 获取所有节点
    if (all === 'true') {
      const nodes = await getAllNodes(videoId)
      return NextResponse.json({ nodes, count: nodes.length })
    }

    // 按时间获取当前节点
    if (time) {
      const currentTime = parseFloat(time)
      const node = await getNodeByTime(videoId, currentTime)
      return NextResponse.json({ node })
    }

    // 语义搜索
    if (query) {
      const results = await hybridSearch(videoId, query, [], limit)
      return NextResponse.json({ results, count: results.length })
    }

    return NextResponse.json({ error: 'Missing query or time parameter' }, { status: 400 })
  } catch (error) {
    console.error('Search error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Search failed' },
      { status: 500 }
    )
  }
}
