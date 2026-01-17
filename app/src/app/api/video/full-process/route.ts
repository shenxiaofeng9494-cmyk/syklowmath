import { NextRequest, NextResponse } from 'next/server'
import { transcribeWithAliyun } from '@/lib/aliyun-asr'
import { processVideo } from '@/lib/video-processor'
import { promises as fs } from 'fs'
import path from 'path'

/**
 * POST /api/video/full-process
 * 完整的视频处理流程：转写 + 节点切分 + 向量化
 *
 * Body:
 * - videoId: 视频 ID
 * - fileUrl: 视频的公网 URL（OSS 地址）
 * - title: 视频标题
 * - description: 视频描述（可选）
 * - teacher: 讲师名称（可选）
 */
export async function POST(request: NextRequest) {
  const encoder = new TextEncoder()

  // 创建流式响应
  const stream = new ReadableStream({
    async start(controller) {
      const sendProgress = (stage: string, progress: number, message: string) => {
        const data = JSON.stringify({ stage, progress, message }) + '\n'
        controller.enqueue(encoder.encode(`data: ${data}\n`))
      }

      try {
        const body = await request.json()
        const { videoId, fileUrl, title, description, teacher } = body

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

        const result = await processVideo(
          videoId,
          title || `视频 ${videoId}`,
          description || '',
          fileUrl,
          subtitleData.duration,
          subtitleData.subtitles,
          teacher,
          (progress) => {
            // 将 25-100 的进度映射到 35-100
            const mappedProgress = 35 + Math.round((progress.progress / 100) * 65)
            sendProgress('process', mappedProgress, progress.message)
          }
        )

        if (result.success) {
          sendProgress('complete', 100, `处理完成！共生成 ${result.nodeCount} 个知识点节点`)
        } else {
          sendProgress('error', 0, `处理失败: ${result.error}`)
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
