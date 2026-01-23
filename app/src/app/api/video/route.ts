import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import type { Video as DBVideo } from '@/types/database'

// 返回给客户端的视频格式
interface ClientVideo {
  id: string
  title: string
  description: string
  video_url: string
  duration: number
  teacher?: string
  status: string
  node_count: number
  created_at: string
}

function mapDBVideoToClient(dbVideo: DBVideo): ClientVideo {
  return {
    id: dbVideo.id,
    title: dbVideo.title,
    description: dbVideo.description || '',
    video_url: dbVideo.video_url,
    duration: dbVideo.duration || 0,
    teacher: dbVideo.teacher || '',
    status: dbVideo.status || 'unknown',
    node_count: dbVideo.node_count || 0,
    created_at: dbVideo.created_at || new Date().toISOString(),
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const searchQuery = searchParams.get('search') || ''
    const status = searchParams.get('status') || ''

    let query = supabase
      .from('videos')
      .select('*')
      .order('created_at', { ascending: false })

    if (searchQuery) {
      query = query.or(`title.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`)
    }

    if (status && status !== 'all') {
      query = query.eq('status', status)
    }

    const { data, error } = await query

    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch videos' },
        { status: 500 }
      )
    }

    // 映射为客户端格式
    const clientVideos = data?.map(mapDBVideoToClient) || []

    return NextResponse.json({
      videos: clientVideos,
      total: clientVideos.length,
    })
  } catch (error) {
    console.error('Failed to fetch videos:', error)
    return NextResponse.json(
      { error: 'Failed to fetch videos' },
      { status: 500 }
    )
  }
}
