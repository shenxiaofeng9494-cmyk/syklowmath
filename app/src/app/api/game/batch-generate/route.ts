/**
 * 批量并行生成游戏 API
 *
 * POST /api/game/batch-generate
 * 为视频的多个节点并行生成游戏
 */

import { NextRequest, NextResponse } from 'next/server'
import { generateGame } from '@/lib/game-generator'
import { supabase } from '@/lib/supabase'
import type { GameGeneratorInput } from '@/lib/game-generator/types'

// 游戏类型映射
function mapGameType(aiGameType: string): string {
  const typeMap: Record<string, string> = {
    'drag-drop-cleanup': 'drag-match',
    'drag-simplify': 'drag-match',
    'drag-classify': 'drag-match',
    'parameter-explorer': 'parameter-slider',
    'drag-adjust-explore': 'drag-match',
  }
  return typeMap[aiGameType] || 'custom'
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { videoId, nodeIds, options } = body as {
      videoId: string
      nodeIds?: string[] // 可选，不传则为所有节点生成
      options?: {
        difficulty?: 'easy' | 'medium' | 'hard'
        maxConcurrency?: number // 最大并发数，默认 3
      }
    }

    if (!videoId) {
      return NextResponse.json(
        { error: '缺少必要参数：videoId' },
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
    let nodesQuery = supabase
      .from('video_nodes')
      .select('*')
      .eq('video_id', videoId)
      .order('order', { ascending: true })

    if (nodeIds && nodeIds.length > 0) {
      nodesQuery = nodesQuery.in('id', nodeIds)
    }

    const { data: nodes, error: nodesError } = await nodesQuery

    if (nodesError || !nodes || nodes.length === 0) {
      return NextResponse.json(
        { error: '未找到视频节点' },
        { status: 404 }
      )
    }

    console.log(`[BatchGenerate] 开始为 ${nodes.length} 个节点并行生成游戏`)

    const maxConcurrency = options?.maxConcurrency || 3
    const results: Array<{
      nodeId: string
      nodeTitle: string
      success: boolean
      game?: unknown
      error?: string
    }> = []

    // 分批并行处理
    for (let i = 0; i < nodes.length; i += maxConcurrency) {
      const batch = nodes.slice(i, i + maxConcurrency)
      console.log(`[BatchGenerate] 处理批次 ${Math.floor(i / maxConcurrency) + 1}，节点数: ${batch.length}`)

      const batchPromises = batch.map(async (node) => {
        try {
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

          console.log(`[BatchGenerate] 开始生成: ${node.title}`)
          const game = await generateGame(input)
          console.log(`[BatchGenerate] 完成生成: ${node.title}`)

          // 存储到数据库
          const { error: insertError } = await supabase
            .from('video_games')
            .upsert({
              id: game.id,
              video_id: game.videoId,
              node_id: game.nodeId,
              title: game.title,
              description: game.description,
              game_type: mapGameType(game.gameType),
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
            console.error(`[BatchGenerate] 存储游戏失败 (${node.title}):`, insertError)
          }

          return {
            nodeId: node.id,
            nodeTitle: node.title,
            success: true,
            game,
          }
        } catch (error) {
          console.error(`[BatchGenerate] 生成失败 (${node.title}):`, error)
          return {
            nodeId: node.id,
            nodeTitle: node.title,
            success: false,
            error: error instanceof Error ? error.message : '未知错误',
          }
        }
      })

      const batchResults = await Promise.all(batchPromises)
      results.push(...batchResults)
    }

    const successCount = results.filter(r => r.success).length
    const failCount = results.filter(r => !r.success).length

    console.log(`[BatchGenerate] 完成！成功: ${successCount}, 失败: ${failCount}`)

    return NextResponse.json({
      success: true,
      summary: {
        total: results.length,
        success: successCount,
        failed: failCount,
      },
      results,
    })
  } catch (error) {
    console.error('[BatchGenerate] 批量生成失败:', error)
    return NextResponse.json(
      {
        error: '批量生成失败',
        details: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 }
    )
  }
}
