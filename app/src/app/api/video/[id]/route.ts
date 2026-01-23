import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import type { Video as DBVideo } from '@/types/database'

// 返回给客户端的视频格式（兼容旧格式）
interface ClientVideo {
  id: string
  title: string
  description: string
  videoUrl: string
  duration: number
  teacher: string
  status: string
  nodeCount: number
}

function mapDBVideoToClient(dbVideo: DBVideo): ClientVideo {
  return {
    id: dbVideo.id,
    title: dbVideo.title,
    description: dbVideo.description || '',
    videoUrl: dbVideo.video_url,
    duration: dbVideo.duration,
    teacher: dbVideo.teacher || '数学老师',
    status: dbVideo.status,
    nodeCount: dbVideo.node_count,
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // 从 Supabase 查询视频
    const { data, error } = await supabase
      .from('videos')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !data) {
      return NextResponse.json(
        { error: 'Video not found' },
        { status: 404 }
      )
    }

    // 映射为客户端格式
    const clientVideo = mapDBVideoToClient(data)

    return NextResponse.json({ video: clientVideo })
  } catch (error) {
    console.error('Failed to fetch video:', error)
    return NextResponse.json(
      { error: 'Failed to fetch video' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/video/[id]
 * 删除视频及其相关数据（节点和游戏）
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // 开始事务删除：先删除相关数据，再删除视频
    // 1. 删除相关游戏
    const { error: gamesError } = await supabase
      .from('video_games')
      .delete()
      .eq('video_id', id)

    if (gamesError) {
      console.warn('Failed to delete games:', gamesError)
      // 游戏删除失败不影响视频删除
    }

    // 2. 删除相关节点
    const { error: nodesError } = await supabase
      .from('video_nodes')
      .delete()
      .eq('video_id', id)

    if (nodesError) {
      console.warn('Failed to delete nodes:', nodesError)
      // 节点删除失败不影响视频删除
    }

    // 3. 删除视频
    const { error: videoError } = await supabase
      .from('videos')
      .delete()
      .eq('id', id)

    if (videoError) {
      console.error('Failed to delete video:', videoError)
      return NextResponse.json(
        { error: 'Failed to delete video' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Video deleted successfully',
    })
  } catch (error) {
    console.error('Failed to delete video:', error)
    return NextResponse.json(
      { error: 'Failed to delete video' },
      { status: 500 }
    )
  }
}
