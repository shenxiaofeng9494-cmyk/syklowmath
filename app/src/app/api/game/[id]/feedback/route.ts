import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const gameId = params.id
    const body = await request.json()
    const { feedback, type, gameId: bodyGameId, videoId } = body

    if (!feedback || !type) {
      return NextResponse.json(
        { error: '缺少必要参数：feedback 和 type' },
        { status: 400 }
      )
    }

    // 验证游戏是否存在
    const { data: game, error: gameError } = await supabase
      .from('video_games')
      .select('id, title')
      .eq('id', gameId)
      .single()

    if (gameError || !game) {
      return NextResponse.json(
        { error: `游戏不存在: ${gameId}` },
        { status: 404 }
      )
    }

    // 保存反馈到数据库
    const { error: insertError } = await supabase
      .from('game_feedback')
      .insert({
        game_id: gameId,
        feedback_text: feedback,
        feedback_type: type, // 'positive' | 'negative'
        video_id: videoId,
      })

    if (insertError) {
      console.error('[GameFeedback] 保存反馈失败:', insertError)
      return NextResponse.json(
        { error: '保存反馈失败', details: insertError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: '反馈已保存',
    })
  } catch (error) {
    console.error('[GameFeedback] 处理反馈失败:', error)
    return NextResponse.json(
      {
        error: '处理反馈失败',
        details: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/game/[id]/feedback
 * 获取游戏的反馈列表
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const gameId = params.id

    const { data: feedback, error } = await supabase
      .from('game_feedback')
      .select('*')
      .eq('game_id', gameId)
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json(
        { error: '查询反馈失败', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      feedback: feedback || [],
    })
  } catch (error) {
    console.error('[GameFeedback] 获取反馈失败:', error)
    return NextResponse.json(
      {
        error: '获取反馈失败',
        details: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 }
    )
  }
}
