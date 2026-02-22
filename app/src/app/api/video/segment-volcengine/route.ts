import { NextRequest, NextResponse } from 'next/server'
import {
  waitForSceneSegmentationByVid,
  isVolcengineConfigured,
} from '@/lib/volcengine-scene-segmentation'
import {
  waitForUpload,
  isVolcengineUploadConfigured,
} from '@/lib/volcengine-upload'
import {
  convertScenesToNodes,
  mergeShortScenes,
} from '@/lib/volcengine-node-converter'
import { supabase } from '@/lib/supabase'
import { generateDocumentEmbedding } from '@/lib/embedding'
import type { VideoNodeInsert } from '@/types/database'
import { promises as fs } from 'fs'
import path from 'path'

interface SubtitleCue {
  start: number
  end: number
  text: string
}

/**
 * POST /api/video/segment-volcengine
 *
 * 使用火山引擎智能场景切分处理视频
 * 流程：上传视频到火山引擎 -> 获取 Vid -> 场景切分 -> 生成节点
 *
 * Body:
 * - videoId: 视频 ID
 * - videoUrl: 视频的公网 URL（OSS 地址）
 * - title: 视频标题
 * - description: 视频描述（可选）
 * - teacher: 讲师名称（可选）
 * - minSceneDuration: 最小场景时长（秒，可选，默认 10）
 */
export async function POST(request: NextRequest) {
  const encoder = new TextEncoder()

  // 创建流式响应
  const stream = new ReadableStream({
    async start(controller) {
      const sendProgress = (
        stage: string,
        progress: number,
        message: string
      ) => {
        const data = JSON.stringify({ stage, progress, message }) + '\n'
        controller.enqueue(encoder.encode(`data: ${data}\n`))
      }

      try {
        // 检查配置
        if (!isVolcengineConfigured()) {
          sendProgress(
            'error',
            0,
            '火山引擎未配置，请设置 VOLCENGINE_ACCESS_KEY_ID 和 VOLCENGINE_ACCESS_KEY_SECRET'
          )
          controller.close()
          return
        }

        if (!isVolcengineUploadConfigured()) {
          sendProgress(
            'error',
            0,
            '火山引擎 VOD 空间未配置，请设置 VOLCENGINE_VOD_SPACE_NAME 环境变量'
          )
          controller.close()
          return
        }

        const body = await request.json()
        const {
          videoId,
          videoUrl,
          title,
          description,
          teacher,
          minSceneDuration = 10,
        } = body

        if (!videoId || !videoUrl) {
          sendProgress('error', 0, '缺少 videoId 或 videoUrl 参数')
          controller.close()
          return
        }

        if (!supabase) {
          sendProgress('error', 0, '数据库未配置')
          controller.close()
          return
        }

        // Step 1: 加载字幕数据
        sendProgress('init', 5, '加载字幕数据...')

        const cacheDir = path.join(process.cwd(), 'public', 'subtitles')
        const cachePath = path.join(cacheDir, `${videoId}.json`)

        let subtitleData: { subtitles: SubtitleCue[]; duration: number }
        try {
          const cached = await fs.readFile(cachePath, 'utf-8')
          subtitleData = JSON.parse(cached)
        } catch {
          sendProgress('error', 0, '未找到字幕数据，请先进行语音转写')
          controller.close()
          return
        }

        // Step 2: 创建或��新视频记录
        sendProgress('database', 8, '更新视频记录...')

        const { error: videoError } = await supabase.from('videos').upsert({
          id: videoId,
          title: title || `视频 ${videoId}`,
          description: description || null,
          video_url: videoUrl,
          duration: Math.round(subtitleData.duration),
          teacher: teacher || null,
          status: 'processing',
          node_count: 0,
        })

        if (videoError) {
          throw new Error(`创建视频记录失败: ${videoError.message}`)
        }

        // Step 3: 上传视频到火山引擎
        sendProgress('upload', 10, '正在上传视频到火山引擎...')

        const vid = await waitForUpload(videoUrl, {
          title: title || videoId,
          onProgress: (state, message) => {
            const progressMap: Record<string, number> = {
              initial: 12,
              processing: 18,
              success: 25,
            }
            sendProgress(
              'upload',
              progressMap[state] || 15,
              message || `上传${state}...`
            )
          },
        })

        console.log(`[Volcengine] 视频上传完成, Vid: ${vid}`)

        // Step 4: 调用火山引擎场景切分
        sendProgress('segmentation', 28, '正在调用火山引擎场景切分...')

        let scenes = await waitForSceneSegmentationByVid(vid, {
          onProgress: (status, message) => {
            const progressMap: Record<string, number> = {
              submitting: 30,
              waiting: 33,
              pending: 36,
              running: 42,
              success: 50,
            }
            sendProgress(
              'segmentation',
              progressMap[status] || 38,
              message || `场景切分${status}...`
            )
          },
        })

        console.log(`[Volcengine] 原始切分结果: ${scenes.length} 个场景`)
        console.log(`[Volcengine] 场景详情:`, JSON.stringify(scenes, null, 2))

        // Step 5: 合并短场景
        if (minSceneDuration > 0) {
          scenes = mergeShortScenes(scenes, minSceneDuration)
          console.log(`[Volcengine] 合并后: ${scenes.length} 个场景`)
          console.log(`[Volcengine] 合并后场景详情:`, JSON.stringify(scenes, null, 2))
        }

        sendProgress(
          'segmentation',
          55,
          `场景切分完成，共 ${scenes.length} 个场景`
        )

        // Step 6: 转换为节点格式
        sendProgress('convert', 58, '转换节点数据...')

        const nodeDataList = convertScenesToNodes(
          videoId,
          scenes,
          subtitleData.subtitles
        )

        // Step 7: 删除旧节点
        sendProgress('cleanup', 62, '清理旧数据...')
        await supabase.from('video_nodes').delete().eq('video_id', videoId)

        // Step 8: 生成向量并保存节点
        const nodes: VideoNodeInsert[] = []
        const totalNodes = nodeDataList.length

        for (let i = 0; i < nodeDataList.length; i++) {
          const nodeData = nodeDataList[i]
          const progressPercent = 65 + Math.round((i / totalNodes) * 28)

          sendProgress(
            'embedding',
            progressPercent,
            `正在处理节点 ${i + 1}/${totalNodes}: ${nodeData.title}...`
          )

          // 生成向量
          const embedding = await generateDocumentEmbedding(
            nodeData.summary,
            nodeData.key_concepts || []
          )

          nodes.push({
            ...nodeData,
            embedding,
          })
        }

        // Step 9: 批量插入节点
        sendProgress('saving', 95, '保存节点数据...')

        const { error: nodesError } = await supabase
          .from('video_nodes')
          .insert(nodes)

        if (nodesError) {
          throw new Error(`保存节点失败: ${nodesError.message}`)
        }

        // Step 10: 更新视频状态
        sendProgress('finalizing', 98, '更新视频状态...')

        await supabase
          .from('videos')
          .update({
            status: 'ready',
            node_count: nodes.length,
            processed_at: new Date().toISOString(),
          })
          .eq('id', videoId)

        sendProgress(
          'complete',
          100,
          `处理完成！共生成 ${nodes.length} 个知识点节点（火山引擎视觉切分）`
        )

        controller.close()
      } catch (error) {
        console.error('[Volcengine Segment] Error:', error)
        sendProgress(
          'error',
          0,
          error instanceof Error ? error.message : '处理失败'
        )
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

/**
 * GET /api/video/segment-volcengine
 *
 * 检查火山引擎配置状态
 */
export async function GET() {
  const authConfigured = isVolcengineConfigured()
  const uploadConfigured = isVolcengineUploadConfigured()
  const fullyConfigured = authConfigured && uploadConfigured

  return NextResponse.json({
    configured: fullyConfigured,
    details: {
      auth: authConfigured,
      upload: uploadConfigured,
    },
    message: fullyConfigured
      ? '火山引擎已完全配置'
      : !authConfigured
        ? '缺少 VOLCENGINE_ACCESS_KEY_ID 或 VOLCENGINE_ACCESS_KEY_SECRET'
        : '缺少 VOLCENGINE_VOD_SPACE_NAME',
  })
}
