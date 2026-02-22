import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { validateNodeTimes, NodeTimeUpdate } from '@/lib/node-validation'

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

interface NodeUpdateRequest extends NodeTimeUpdate {
  node_type?: string
  summary?: string
  order?: number
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    if (!supabase) {
      return NextResponse.json({ error: '数据库未配置' }, { status: 503 })
    }

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

// PATCH - 批量同步节点（支持创建、更新、删除）
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { nodes } = body as { nodes: NodeUpdateRequest[] }

    if (!nodes || !Array.isArray(nodes)) {
      return NextResponse.json(
        { error: 'Invalid request: nodes array is required' },
        { status: 400 }
      )
    }

    if (!supabase) {
      return NextResponse.json({ error: '数据库未配置' }, { status: 503 })
    }

    // 获取视频信息以验证时长
    const { data: video, error: videoError } = await supabase
      .from('videos')
      .select('id, duration')
      .eq('id', id)
      .single()

    if (videoError || !video) {
      return NextResponse.json(
        { error: 'Video not found' },
        { status: 404 }
      )
    }

    // 验证节点时间（只验证非空数组）
    if (nodes.length > 0) {
      const validation = validateNodeTimes(nodes, video.duration)
      if (!validation.valid) {
        return NextResponse.json(
          { error: 'Validation failed', errors: validation.errors },
          { status: 400 }
        )
      }
    }

    // 获取数据库中现有的节点
    const { data: existingNodes, error: fetchError } = await supabase
      .from('video_nodes')
      .select('id')
      .eq('video_id', id)

    if (fetchError) {
      console.error('Failed to fetch existing nodes:', fetchError)
      return NextResponse.json(
        { error: 'Failed to fetch existing nodes' },
        { status: 500 }
      )
    }

    const existingIds = new Set(existingNodes?.map(n => n.id) || [])
    const newNodeIds = new Set(nodes.map(n => n.id))

    // 分类节点操作
    const nodesToCreate: NodeUpdateRequest[] = []
    const nodesToUpdate: NodeUpdateRequest[] = []
    const idsToDelete: string[] = []

    // 找出需要创建和更新的节点
    for (const node of nodes) {
      if (node.id.startsWith('node-new-') || !existingIds.has(node.id)) {
        nodesToCreate.push(node)
      } else {
        nodesToUpdate.push(node)
      }
    }

    // 找出需要删除的节点（在数据库中存在但不在新列表中）
    for (const existingId of existingIds) {
      if (!newNodeIds.has(existingId)) {
        idsToDelete.push(existingId)
      }
    }

    const results: { created: number; updated: number; deleted: number; errors: string[] } = {
      created: 0,
      updated: 0,
      deleted: 0,
      errors: [],
    }

    // 执行顺序：1. 删除 -> 2. 更新（先设置临时 order 避免冲突）-> 3. 创建

    // 1. 删除被移除的节点
    if (idsToDelete.length > 0) {
      const { error: deleteError } = await supabase
        .from('video_nodes')
        .delete()
        .in('id', idsToDelete)
        .eq('video_id', id)

      if (deleteError) {
        console.error('Failed to delete nodes:', deleteError)
        results.errors.push(`删除节点失败: ${deleteError.message}`)
      } else {
        results.deleted = idsToDelete.length
      }
    }

    // 2. 更新现有节点（使用负数 order 避免唯一约束冲突）
    if (nodesToUpdate.length > 0) {
      // 先将所有 order 设为负数（临时值）
      const tempUpdatePromises = nodesToUpdate.map((node, index) => {
        return supabase
          .from('video_nodes')
          .update({ order: -(index + 1) })
          .eq('id', node.id)
          .eq('video_id', id)
      })
      await Promise.all(tempUpdatePromises)

      // 然后更新所有字段（包括正确的 order）
      const updatePromises = nodesToUpdate.map((node) => {
        const updateData: Record<string, unknown> = {
          start_time: node.start_time,
          end_time: node.end_time,
          created_by: 'human',
          order: node.order || 1,
        }
        if (node.title !== undefined) {
          updateData.title = node.title
        }
        return supabase
          .from('video_nodes')
          .update(updateData)
          .eq('id', node.id)
          .eq('video_id', id)
      })

      const updateResults = await Promise.all(updatePromises)
      const failedUpdates = updateResults.filter(r => r.error)

      if (failedUpdates.length > 0) {
        console.error('Some updates failed:', failedUpdates.map(r => r.error))
        results.errors.push(`部分更新失败: ${failedUpdates.length} 个`)
      }
      results.updated = nodesToUpdate.length - failedUpdates.length
    }

    // 3. 创建新节点
    if (nodesToCreate.length > 0) {
      const insertData = nodesToCreate.map((node, index) => ({
        id: `node-${id}-${Date.now()}-${index}`,
        video_id: id,
        title: node.title || '新节点',
        summary: node.summary || '',
        start_time: node.start_time,
        end_time: node.end_time,
        node_type: node.node_type || 'concept',
        order: node.order || 1,
        created_by: 'human',
      }))

      const { data: insertedNodes, error: insertError } = await supabase
        .from('video_nodes')
        .insert(insertData)
        .select('id')

      if (insertError) {
        console.error('Failed to create nodes:', insertError)
        results.errors.push(`创建节点失败: ${insertError.message}`)
      } else {
        results.created = insertedNodes?.length || 0
      }
    }

    // 更新视频的节点数量
    const { error: updateVideoError } = await supabase
      .from('videos')
      .update({ node_count: nodes.length })
      .eq('id', id)

    if (updateVideoError) {
      console.error('Failed to update video node_count:', updateVideoError)
    }

    if (results.errors.length > 0) {
      return NextResponse.json({
        success: false,
        ...results,
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      ...results,
    })
  } catch (error) {
    console.error('Failed to sync nodes:', error)
    return NextResponse.json(
      { error: 'Failed to sync nodes' },
      { status: 500 }
    )
  }
}
