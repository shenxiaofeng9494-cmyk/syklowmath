/**
 * 游戏生成 API
 *
 * POST /api/game/generate
 * 为指定的视频节点生成互动游戏
 */

import { NextRequest, NextResponse } from 'next/server'
import { generateGame } from '@/lib/game-generator'
import { supabase } from '@/lib/supabase'
import type { GameGeneratorInput } from '@/lib/game-generator/types'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { videoId, nodeId, options } = body as {
      videoId: string
      nodeId: string
      options?: {
        enableWebSearch?: boolean
        difficulty?: 'easy' | 'medium' | 'hard'
      }
    }

    if (!videoId || !nodeId) {
      return NextResponse.json(
        { error: '缺少必要参数：videoId 和 nodeId' },
        { status: 400 }
      )
    }

    // 获取视频信息
    const { data: video, error: videoError } = await supabase
      .from('videos')
      .select('title, description')
      .eq('id', videoId)
      .single()

    if (videoError || !video) {
      return NextResponse.json(
        { error: `视频不存在: ${videoId}` },
        { status: 404 }
      )
    }

    // 获取节点信息
    const { data: node, error: nodeError } = await supabase
      .from('video_nodes')
      .select('*')
      .eq('id', nodeId)
      .single()

    if (nodeError || !node) {
      return NextResponse.json(
        { error: `节点不存在: ${nodeId}` },
        { status: 404 }
      )
    }

    // 构建输入
    const input: GameGeneratorInput = {
      videoId,
      videoTitle: video.title,
      nodeId: node.id,
      nodeTitle: node.title,
      nodeSummary: node.summary,
      nodeTranscript: node.transcript || '',
      keyConcepts: node.key_concepts || [],
      nodeType: node.node_type || 'concept',
      targetAgeGroup: '12-15岁',
      subjectArea: '数学',
      difficulty: options?.difficulty,
    }

    // 生成游戏
    const game = await generateGame(input, {
      enableWebSearch: options?.enableWebSearch ?? false,
    })

    // 游戏类型映射函数：将 AI 生成的游戏类型映射到数据库支持的类型
    function mapGameType(aiGameType: string): string {
      const typeMap: { [key: string]: string } = {
        // 新类型映射到现有类型
        'drag-drop-cleanup': 'drag-match',
        'drag-simplify': 'drag-match',
        'drag-classify': 'drag-match',
        'parameter-explorer': 'parameter-slider',
        'drag-adjust-explore': 'drag-match',
      }
      return typeMap[aiGameType] || 'custom'
    }

    // 存储到数据库
    const { error: insertError } = await supabase
      .from('video_games')
      .upsert({
        id: game.id,
        video_id: game.videoId,
        node_id: game.nodeId,
        title: game.title,
        description: game.description,
        game_type: mapGameType(game.gameType), // 使用映射函数
        difficulty: game.difficulty,
        math_concepts: game.mathConcepts,
        learning_objectives: game.learningObjectives,
        component_code: game.componentCode,
        instructions: game.instructions,
        hints: game.hints,
        estimated_play_time: game.estimatedPlayTime,
        agent_model: game.agentModel,
        generation_time_ms: game.generationTimeMs,
      })

    if (insertError) {
      console.error('[GameAPI] 存储游戏失败:', insertError)
      // 即使存储失败，也返回生成的游戏
    }

    return NextResponse.json({
      success: true,
      game,
    })
  } catch (error) {
    console.error('[GameAPI] 游戏生成失败:', error)
    return NextResponse.json(
      {
        error: '游戏生成失败',
        details: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/game/generate?videoId=xxx&nodeId=xxx
 * 获取已生成的游戏
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const videoId = searchParams.get('videoId')
  const nodeId = searchParams.get('nodeId')

  if (!videoId) {
    return NextResponse.json(
      { error: '缺少必要参数：videoId' },
      { status: 400 }
    )
  }

  let query = supabase.from('video_games').select('*').eq('video_id', videoId)

  if (nodeId) {
    query = query.eq('node_id', nodeId)
  }

  const { data: games, error } = await query.order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json(
      { error: '查询游戏失败', details: error.message },
      { status: 500 }
    )
  }

  return NextResponse.json({
    success: true,
    games: games || [],
  })
}
