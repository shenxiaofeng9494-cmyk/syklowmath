import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

interface VideoNode {
  id: string
  video_id: string
  title: string
  summary: string
  start_time: number
  end_time: number
  node_type: string
  order: number
  created_at: string
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // 首先验证视频是否存在
    const { data: video, error: videoError } = await supabase
      .from('videos')
      .select('id')
      .eq('id', id)
      .single()

    if (videoError || !video) {
      return NextResponse.json(
        { error: 'Video not found' },
        { status: 404 }
      )
    }

    // 获取节点列表
    const { data, error } = await supabase
      .from('video_nodes')
      .select('*')
      .eq('video_id', id)
      .order('order', { ascending: true })

    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch nodes' },
        { status: 500 }
      )
    }

    const nodes: VideoNode[] = data?.map(node => ({
      id: node.id,
      video_id: node.video_id,
      title: node.title,
      summary: node.summary || '',
      start_time: node.start_time || 0,
      end_time: node.end_time || 0,
      node_type: node.node_type || 'concept',
      order: node.order || 0,
      created_at: node.created_at || new Date().toISOString(),
    })) || []

    return NextResponse.json({
      nodes,
      total: nodes.length,
    })
  } catch (error) {
    console.error('Failed to fetch nodes:', error)
    return NextResponse.json(
      { error: 'Failed to fetch nodes' },
      { status: 500 }
    )
  }
}
