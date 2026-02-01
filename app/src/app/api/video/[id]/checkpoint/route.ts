import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getFallbackNodes } from '@/data/video-nodes'

/**
 * 配置视频节点的必停点（Critical Checkpoint）
 * POST /api/video/[id]/checkpoint
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: videoId } = await params
    const body = await request.json()

    const {
      nodeId,
      checkpointType,
      question,
      expectedAnswer,
      followup,
      silenceThreshold = 5
    } = body

    // 验证必填字段
    if (!nodeId || !checkpointType || !question || !expectedAnswer) {
      return NextResponse.json(
        { error: '缺少必填字段：nodeId, checkpointType, question, expectedAnswer' },
        { status: 400 }
      )
    }

    // 验证枚举值
    const validCheckpointTypes = ['motivation', 'definition', 'pitfall', 'summary', 'verification']
    const validAnswerTypes = ['yes_no', 'short_answer', 'multiple_choice']

    if (!validCheckpointTypes.includes(checkpointType)) {
      return NextResponse.json(
        { error: `无效的 checkpointType，必须是：${validCheckpointTypes.join(', ')}` },
        { status: 400 }
      )
    }

    if (!validAnswerTypes.includes(expectedAnswer)) {
      return NextResponse.json(
        { error: `无效的 expectedAnswer，必须是：${validAnswerTypes.join(', ')}` },
        { status: 400 }
      )
    }

    if (!supabase) {
      return NextResponse.json(
        { error: 'Supabase未配置' },
        { status: 500 }
      )
    }

    // 更新节点配置
    const { data, error } = await supabase
      .from('video_nodes')
      .update({
        is_critical_checkpoint: true,
        checkpoint_type: checkpointType,
        checkpoint_question: question,
        checkpoint_expected_answer: expectedAnswer,
        checkpoint_followup: followup || null,
        silence_threshold_seconds: silenceThreshold
      })
      .eq('id', nodeId)
      .eq('video_id', videoId)
      .select()
      .single()

    if (error) {
      console.error('配置必停点失败:', error)
      return NextResponse.json(
        { error: '配置必停点失败', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data,
      message: '必停点配置成功'
    })
  } catch (error) {
    console.error('配置必停点异常:', error)
    return NextResponse.json(
      { error: '服务器错误', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

/**
 * 获取视频的所有必停点
 * GET /api/video/[id]/checkpoint
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: videoId } = await params

    // 尝试从 Supabase 获取
    if (supabase) {
      const { data, error } = await supabase
        .from('video_nodes')
        .select('*')
        .eq('video_id', videoId)
        .eq('is_critical_checkpoint', true)
        .order('order')

      console.log('[Checkpoint API] videoId:', videoId)
      console.log('[Checkpoint API] Supabase data:', data)
      console.log('[Checkpoint API] Supabase error:', error)

      if (!error && data && data.length > 0) {
        return NextResponse.json({
          success: true,
          data,
          count: data.length,
          source: 'database'
        })
      }
    }

    // 回退到 fallback 数据
    console.log('[Checkpoint API] Falling back to hardcoded data for videoId:', videoId)
    const fallbackNodes = getFallbackNodes(videoId)
    const checkpointNodes = fallbackNodes.filter(node => node.criticalCheckpoint?.enabled)

    // 转换为数据库格式
    const formattedNodes = checkpointNodes.map(node => ({
      id: node.id,
      video_id: videoId,
      order: node.order,
      title: node.title,
      start_time: node.start_time,
      end_time: node.end_time,
      summary: node.summary,
      key_concepts: node.key_concepts,
      node_type: node.node_type,
      is_critical_checkpoint: true,
      checkpoint_type: node.criticalCheckpoint?.interventionType || 'quick_check',
      checkpoint_intro: node.criticalCheckpoint?.intervention.intro || '',  // 添加 intro 字段
      checkpoint_question: node.criticalCheckpoint?.intervention.question || '',
      checkpoint_expected_answer: 'yes_no',
      checkpoint_followup: node.criticalCheckpoint?.intervention.followUp || null,
      silence_threshold_seconds: 5
    }))

    console.log('[Checkpoint API] Fallback checkpoint nodes:', formattedNodes.length)

    return NextResponse.json({
      success: true,
      data: formattedNodes,
      count: formattedNodes.length,
      source: 'fallback'
    })
  } catch (error) {
    console.error('获取必停点异常:', error)
    return NextResponse.json(
      { error: '服务器错误', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

/**
 * 删除必停点配置
 * DELETE /api/video/[id]/checkpoint
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: videoId } = await params
    const { searchParams } = new URL(request.url)
    const nodeId = searchParams.get('nodeId')

    if (!nodeId) {
      return NextResponse.json(
        { error: '缺少 nodeId 参数' },
        { status: 400 }
      )
    }

    if (!supabase) {
      return NextResponse.json(
        { error: 'Supabase未配置' },
        { status: 500 }
      )
    }

    // 清除必停点配置
    const { data, error } = await supabase
      .from('video_nodes')
      .update({
        is_critical_checkpoint: false,
        checkpoint_type: null,
        checkpoint_question: null,
        checkpoint_expected_answer: null,
        checkpoint_followup: null,
        silence_threshold_seconds: 5
      })
      .eq('id', nodeId)
      .eq('video_id', videoId)
      .select()
      .single()

    if (error) {
      console.error('删除必停点失败:', error)
      return NextResponse.json(
        { error: '删除必停点失败', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data,
      message: '必停点已删除'
    })
  } catch (error) {
    console.error('删除必停点异常:', error)
    return NextResponse.json(
      { error: '服务器错误', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
