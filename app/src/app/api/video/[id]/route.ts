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

    return NextResponse.json(clientVideo)
  } catch (error) {
    console.error('Failed to fetch video:', error)
    return NextResponse.json(
      { error: 'Failed to fetch video' },
      { status: 500 }
    )
  }
}
