/**
 * 游戏反馈 API
 *
 * POST /api/game/feedback
 * 接收老师对游戏的反馈并重新生成
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { generateGame } from '@/lib/game-generator'
import type { GameGeneratorInput } from '@/lib/game-generator/types'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { gameId, feedback, type, videoId } = body as {
      gameId: string
      feedback: string
      type: 'positive' | 'negative'
      videoId: string
    }

    if (!gameId || !feedback || !videoId) {
      return NextResponse.json(
        { error: '缺少必要参数' },
        { status: 400 }
      )
    }

    if (!supabase) {
      return NextResponse.json({ error: '数据库未配置' }, { status: 503 })
    }

    // 获取游戏信息
    const { data: game, error: gameError } = await supabase
      .from('video_games')
      .select(`
        *,
        video_nodes (
          id,
          title,
          summary,
          transcript,
          key_concepts,
          node_type
        )
      `)
      .eq('id', gameId)
      .single()

    if (gameError || !game) {
      return NextResponse.json(
        { error: '游戏不存在' },
        { status: 404 }
      )
    }

    // 获取视频信息
    const { data: video, error: videoError } = await supabase
      .from('videos')
      .select('title')
      .eq('id', videoId)
      .single()

    if (videoError || !video) {
      return NextResponse.json(
        { error: '视频不存在' },
        { status: 404 }
      )
    }

    // 保存反馈到数据库
    const { error: feedbackError } = await supabase
      .from('game_feedback')
      .insert({
        game_id: gameId,
        feedback_text: feedback,
        feedback_type: type,
        video_id: videoId,
        created_at: new Date().toISOString(),
      })

    if (feedbackError) {
      console.error('保存反馈失败:', feedbackError)
    }

    // 如果是负面反馈，重新生成游戏
    if (type === 'negative') {
      // 构建输入
      const input: GameGeneratorInput = {
        videoId,
        videoTitle: video.title,
        nodeId: game.video_nodes.id,
        nodeTitle: game.video_nodes.title,
        nodeSummary: game.video_nodes.summary,
        nodeTranscript: game.video_nodes.transcript || '',
        keyConcepts: game.video_nodes.key_concepts || [],
        nodeType: game.video_nodes.node_type || 'concept',
        targetAgeGroup: '12-15岁',
        subjectArea: '数学',
      }

      // 基于反馈生成改进的游戏
      const improvedGame = await generateGame(
        {
          ...input,
          feedback: feedback, // 传递反馈给生成器
        },
        {
          onProgress: (progress) => {
            console.log(`[Game Regeneration] ${progress.stage}: ${progress.progress}% - ${progress.message}`)
          },
        }
      )

      // 更新游戏
      const { error: updateError } = await supabase
        .from('video_games')
        .update({
          title: improvedGame.title,
          description: improvedGame.description,
          component_code: improvedGame.componentCode,
          instructions: improvedGame.instructions,
          hints: improvedGame.hints,
          updated_at: new Date().toISOString(),
        })
        .eq('id', gameId)

      if (updateError) {
        console.error('更新游戏失败:', updateError)
        return NextResponse.json(
          { error: '更新游戏失败', details: updateError.message },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        message: '游戏已根据您的反馈重新生成',
        improvedGame: {
          id: improvedGame.id,
          title: improvedGame.title,
          description: improvedGame.description,
        },
      })
    }

    // 正面反馈只保存记录
    return NextResponse.json({
      success: true,
      message: '感谢您的反馈！',
    })
  } catch (error) {
    console.error('[GameFeedback] 处理失败:', error)
    return NextResponse.json(
      {
        error: '处理反馈失败',
        details: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 }
    )
  }
}
