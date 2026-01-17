import { NextRequest, NextResponse } from 'next/server'
import { processVideo, getVideoProcessingStatus } from '@/lib/video-processor'
import { readFile } from 'fs/promises'
import { join } from 'path'

interface SubtitleData {
  videoId: string
  language: string
  duration: number
  fullText: string
  subtitles: Array<{
    start: number
    end: number
    text: string
  }>
}

/**
 * POST /api/video/process
 * 触发视频预处理 Pipeline
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { videoId, title, description, videoUrl, teacher } = body

    if (!videoId) {
      return NextResponse.json(
        { error: '缺少 videoId 参数' },
        { status: 400 }
      )
    }

    // 读取字幕文件
    const subtitlePath = join(process.cwd(), 'public', 'subtitles', `${videoId}.json`)

    let subtitleData: SubtitleData
    try {
      const content = await readFile(subtitlePath, 'utf-8')
      subtitleData = JSON.parse(content)
    } catch {
      return NextResponse.json(
        { error: `找不到字幕文件: ${videoId}.json，请先调用 /api/transcribe 生成字幕` },
        { status: 404 }
      )
    }

    // 开始处理
    console.log(`开始处理视频: ${videoId}`)

    const result = await processVideo(
      videoId,
      title || `视频 ${videoId}`,
      description || '',
      videoUrl || `/videos/${videoId}.mp4`,
      subtitleData.duration,
      subtitleData.subtitles,
      teacher
    )

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: `视频处理完成，共生成 ${result.nodeCount} 个知识点节点`,
        nodeCount: result.nodeCount,
      })
    } else {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('处理请求失败:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '处理失败' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/video/process?videoId=xxx
 * 获取视频处理状态
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const videoId = searchParams.get('videoId')

  if (!videoId) {
    return NextResponse.json(
      { error: '缺少 videoId 参数' },
      { status: 400 }
    )
  }

  const status = await getVideoProcessingStatus(videoId)

  if (!status) {
    return NextResponse.json(
      { error: '视频不存在' },
      { status: 404 }
    )
  }

  return NextResponse.json(status)
}
