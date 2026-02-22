import { NextRequest, NextResponse } from 'next/server'
import { getNodeByTime, hybridSearch, assembleRAGContext, getAllNodes } from '@/lib/rag'
import { supabase } from '@/lib/supabase'
import type { VideoNodeSearchResult } from '@/types/database'
import { getVideoById } from '@/data/videos'

interface ContextParams {
  params: Promise<{ id: string }>
}

/**
 * 获取视频上下文 API
 * POST /api/video/[id]/context
 *
 * 用于 AI 对话时动态获取 RAG 上下文
 */
export async function POST(request: NextRequest, { params }: ContextParams) {
  const { id: videoId } = await params

  try {
    const body = await request.json()
    const { currentTime, query } = body as {
      currentTime: number
      query?: string
    }

    if (typeof currentTime !== 'number') {
      return NextResponse.json(
        { error: 'Missing or invalid currentTime parameter' },
        { status: 400 }
      )
    }

    if (!supabase) {
      return NextResponse.json({ error: '数据库未配置' }, { status: 503 })
    }

    // 1. 获取视频信息
    const { data: video, error: videoError } = await supabase
      .from('videos')
      .select('id, title, duration, node_count')
      .eq('id', videoId)
      .single()

    if (videoError || !video) {
      return NextResponse.json(
        { error: 'Video not found' },
        { status: 404 }
      )
    }

    // 2. 获取当前播放位置的节点
    const currentNode = await getNodeByTime(videoId, currentTime)

    // 3. 如果有用户问题，进行检索增强
    let relevantNodes: VideoNodeSearchResult[] = []
    if (query) {
      relevantNodes = await hybridSearch(videoId, query, [], 3)
    }

    // 4. 组装上下文
    const contextPrompt = assembleRAGContext(currentNode, relevantNodes)

    // 5. 获取所有节点的简要信息（用于跳转）
    const allNodes = await getAllNodes(videoId)
    const nodeList = allNodes.map(n => ({
      order: n.order,
      title: n.title,
      startTime: n.start_time,
      endTime: n.end_time,
    }))

    return NextResponse.json({
      video: {
        id: video.id,
        title: video.title,
        duration: video.duration,
        nodeCount: video.node_count,
      },
      currentNode: currentNode ? {
        id: currentNode.id,
        order: currentNode.order,
        title: currentNode.title,
        startTime: currentNode.start_time,
        endTime: currentNode.end_time,
        summary: currentNode.summary,
        keyConcepts: currentNode.key_concepts,
      } : null,
      relevantNodes: relevantNodes.map(n => ({
        id: n.id,
        order: n.order,
        title: n.title,
        startTime: n.start_time,
        endTime: n.end_time,
        summary: n.summary,
        similarity: n.similarity,
      })),
      contextPrompt,
      nodeList,
    })
  } catch (error) {
    console.error('Context API error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get context' },
      { status: 500 }
    )
  }
}

/**
 * 获取视频节点列表
 * GET /api/video/[id]/context
 */
export async function GET(request: NextRequest, { params }: ContextParams) {
  const { id: videoId } = await params

  try {
    // If Supabase is not configured, use fallback data
    if (!supabase) {
      const fallbackVideo = getVideoById(videoId);
      if (!fallbackVideo) {
        return NextResponse.json(
          { error: 'Video not found' },
          { status: 404 }
        )
      }
      const nodes = await getAllNodes(videoId);
      return NextResponse.json({
        video: {
          id: fallbackVideo.id,
          title: fallbackVideo.title,
          duration: fallbackVideo.duration,
          nodeCount: nodes.length,
          status: 'ready',
        },
        nodes: nodes.map(n => ({
          id: n.id,
          order: n.order,
          title: n.title,
          startTime: n.start_time,
          endTime: n.end_time,
          summary: n.summary,
          keyConcepts: n.key_concepts,
          nodeType: n.node_type,
        })),
      })
    }

    // 获取视频信息
    const { data: video, error: videoError } = await supabase
      .from('videos')
      .select('id, title, duration, node_count, status')
      .eq('id', videoId)
      .single()

    if (videoError || !video) {
      // Fallback to hardcoded data
      const fallbackVideo = getVideoById(videoId);
      if (!fallbackVideo) {
        return NextResponse.json(
          { error: 'Video not found' },
          { status: 404 }
        )
      }
      const nodes = await getAllNodes(videoId);
      return NextResponse.json({
        video: {
          id: fallbackVideo.id,
          title: fallbackVideo.title,
          duration: fallbackVideo.duration,
          nodeCount: nodes.length,
          status: 'ready',
        },
        nodes: nodes.map(n => ({
          id: n.id,
          order: n.order,
          title: n.title,
          startTime: n.start_time,
          endTime: n.end_time,
          summary: n.summary,
          keyConcepts: n.key_concepts,
          nodeType: n.node_type,
        })),
      })
    }

    // 获取所有节点
    const nodes = await getAllNodes(videoId)

    return NextResponse.json({
      video: {
        id: video.id,
        title: video.title,
        duration: video.duration,
        nodeCount: video.node_count,
        status: video.status,
      },
      nodes: nodes.map(n => ({
        id: n.id,
        order: n.order,
        title: n.title,
        startTime: n.start_time,
        endTime: n.end_time,
        summary: n.summary,
        keyConcepts: n.key_concepts,
        nodeType: n.node_type,
      })),
    })
  } catch (error) {
    console.error('Context GET error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get nodes' },
      { status: 500 }
    )
  }
}
