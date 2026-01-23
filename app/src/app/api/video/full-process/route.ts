import { NextRequest, NextResponse } from 'next/server'
import { transcribeWithAliyun } from '@/lib/aliyun-asr'
import { processVideo, SegmentationMethod } from '@/lib/video-processor'
import { generateGamesForVideo } from '@/lib/game-generator'
import { supabase } from '@/lib/supabase'
import { promises as fs } from 'fs'
import path from 'path'

/**
 * POST /api/video/full-process
 * 完整的视频处理流程：转写 + 节点切分 + 向量化 + 游戏生成（可选）
 *
 * Body:
 * - videoId: 视频 ID
 * - fileUrl: 视频的公网 URL（OSS 地址）
 * - title: 视频标题
 * - description: 视频描述（可选）
 * - teacher: 讲师名称（可选）
 * - generateGames: 是否生成互动游戏（可选，默认 false）
 * - segmentationMethod: 切分方法（可选，'gpt' | 'volcengine'，默认 'gpt'）
 */
export async function POST(request: NextRequest) {
  const encoder = new TextEncoder()

  // 创建流式响应
  const stream = new ReadableStream({
    async start(controller) {
      const sendProgress = (
        stage: string,
        progress: number,
        message: string,
        extra?: {
          details?: string
          thinking?: string[]
          steps?: string[]
          currentTurn?: number
          maxTurns?: number
          currentNode?: string
          totalNodes?: number
          completedNodes?: number
        }
      ) => {
        const data = JSON.stringify({ stage, progress, message, ...extra }) + '\n'
        controller.enqueue(encoder.encode(`data: ${data}\n`))
      }

      try {
        const body = await request.json()
        const {
          videoId,
          fileUrl,
          title,
          description,
          teacher,
          generateGames: shouldGenerateGames,
          segmentationMethod = 'gpt' as SegmentationMethod,
        } = body

        if (!videoId || !fileUrl) {
          sendProgress('error', 0, '缺少 videoId 或 fileUrl 参数')
          controller.close()
          return
        }

        // Step 1: 语音转写
        sendProgress('transcribe', 0, '开始语音转写...')

        let subtitleData
        const cacheDir = path.join(process.cwd(), 'public', 'subtitles')
        const cachePath = path.join(cacheDir, `${videoId}.json`)

        // 检查缓存
        try {
          const cached = await fs.readFile(cachePath, 'utf-8')
          subtitleData = JSON.parse(cached)
          sendProgress('transcribe', 30, '使用缓存的字幕数据')
        } catch {
          // 调用阿里云 ASR
          sendProgress('transcribe', 5, '调用阿里云语音识别...')

          subtitleData = await transcribeWithAliyun(videoId, fileUrl)

          // 缓存字幕
          sendProgress('transcribe', 25, '保存字幕缓存...')
          await fs.mkdir(cacheDir, { recursive: true })
          await fs.writeFile(cachePath, JSON.stringify(subtitleData, null, 2))
        }

        sendProgress('transcribe', 30, `转写完成，共 ${subtitleData.subtitles.length} 条字幕`)

        // Step 2: 视频预处理（节点切分 + 向量化）
        sendProgress('process', 35, '开始节点切分与向量化...')

        // 计算进度映射：如果需要生成游戏，则节点处理占 35-70，游戏生成占 70-100
        // 如果不需要生成游戏，则节点处理占 35-100
        const processEndProgress = shouldGenerateGames ? 70 : 100

        const result = await processVideo(
          videoId,
          title || `视频 ${videoId}`,
          description || '',
          fileUrl,
          subtitleData.duration,
          subtitleData.subtitles,
          teacher,
          (progress) => {
            const mappedProgress = 35 + Math.round((progress.progress / 100) * (processEndProgress - 35))
            sendProgress('process', mappedProgress, progress.message)
          },
          {
            segmentationMethod,
          }
        )

        if (!result.success) {
          sendProgress('error', 0, `处理失败: ${result.error}`)
          controller.close()
          return
        }

        // Step 3: 生成互动游戏（可选）
        if (shouldGenerateGames && result.nodeCount > 0) {
          sendProgress('games', 70, '开始生成互动游戏...')

          // 获取刚刚创建的节点
          const { data: nodes } = await supabase
            .from('video_nodes')
            .select('id, title, summary, transcript, key_concepts, node_type')
            .eq('video_id', videoId)
            .order('order', { ascending: true })

          if (nodes && nodes.length > 0) {
            const totalNodes = nodes.length
            let completedGames = 0
            let currentNodeTitle = ''

            // 为每个节点生成游戏
            console.log(`[FullProcess] 开始为 ${nodes.length} 个节点生成游戏`)
            const games = await generateGamesForVideo(
              videoId,
              title || `视频 ${videoId}`,
              nodes.map(n => ({
                id: n.id,
                title: n.title,
                summary: n.summary,
                transcript: n.transcript || '',
                keyConcepts: n.key_concepts || [],
                nodeType: n.node_type || 'concept',
              })),
              {
                onProgress: (progress) => {
                  if (progress.stage === 'analyzing') {
                    // 开始处理新节点
                    currentNodeTitle = progress.message.replace('正在分析教学内容...', '').trim() || currentNodeTitle
                  }

                  if (progress.stage === 'complete') {
                    completedGames++
                    const gameProgress = 70 + Math.round((completedGames / totalNodes) * 30)
                    sendProgress('games', gameProgress, `已生成 ${completedGames}/${totalNodes} 个游戏`, {
                      completedNodes: completedGames,
                      totalNodes,
                    })
                  } else if (progress.stage === 'coding' || progress.stage === 'designing') {
                    // 显示游戏生成的详细进度
                    const gameProgress = 70 + Math.round((completedGames / totalNodes) * 25)
                    sendProgress('games', gameProgress, progress.message, {
                      details: progress.details,
                      thinking: progress.thinking,
                      steps: progress.steps,
                      currentTurn: progress.currentTurn,
                      maxTurns: progress.maxTurns,
                      currentNode: currentNodeTitle || nodes[completedGames]?.title,
                      completedNodes: completedGames,
                      totalNodes,
                    })
                  }
                },
              }
            )

            console.log(`[FullProcess] 游戏生成完成，共 ${games.length} 个游戏`)
            console.log(`[FullProcess] 成功生成的游戏:`, games.map(g => g.title))

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

            // 保存游戏到数据库
            let savedGames = 0
            for (const game of games) {
              console.log(`[FullProcess] 保存游戏: ${game.title}`)
              const { error } = await supabase.from('video_games').upsert({
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
              if (error) {
                console.error(`[FullProcess] 保存游戏失败:`, error)
              } else {
                savedGames++
                console.log(`[FullProcess] 游戏保存成功: ${game.title}`)
              }
            }

            console.log(`[FullProcess] 成功保存 ${savedGames}/${games.length} 个游戏`)

            sendProgress('complete', 100, `处理完成！共生成 ${result.nodeCount} 个知识点节点和 ${games.length} 个互动游戏`)
          } else {
            sendProgress('complete', 100, `处理完成！共生成 ${result.nodeCount} 个知识点节点`)
          }
        } else {
          sendProgress('complete', 100, `处理完成！共生成 ${result.nodeCount} 个知识点节点`)
        }

        controller.close()
      } catch (error) {
        console.error('[Full Process] Error:', error)
        sendProgress('error', 0, error instanceof Error ? error.message : '处理失败')
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
