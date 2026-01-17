import { NextRequest, NextResponse } from 'next/server'
import { uploadToOSS, generateVideoFileName, isOSSConfigured } from '@/lib/oss'

/**
 * POST /api/upload
 * 上传视频文件到阿里云 OSS
 *
 * FormData:
 * - file: 视频文件
 * - videoId: 视频 ID（可选，自动生成）
 * - title: 视频标题（可选）
 */
export async function POST(request: NextRequest) {
  try {
    // 检查 OSS 配置
    if (!isOSSConfigured()) {
      return NextResponse.json(
        {
          error: 'OSS not configured',
          message: '请配置 OSS 环境变量: OSS_ACCESS_KEY_ID, OSS_ACCESS_KEY_SECRET, OSS_BUCKET, OSS_REGION',
        },
        { status: 500 }
      )
    }

    // 解析 FormData
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    let videoId = formData.get('videoId') as string | null
    const title = formData.get('title') as string | null

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
    }

    // 验证文件类型
    const allowedTypes = ['video/mp4', 'video/webm', 'video/quicktime', 'audio/mpeg', 'audio/mp3', 'audio/wav']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: `Unsupported file type: ${file.type}. Allowed: ${allowedTypes.join(', ')}` },
        { status: 400 }
      )
    }

    // 生成 videoId（如果未提供）
    if (!videoId) {
      videoId = `video-${Date.now()}`
    }

    // 读取文件内容
    const buffer = Buffer.from(await file.arrayBuffer())

    // 生成 OSS 文件名
    const fileName = generateVideoFileName(videoId, file.name)

    // 上传到 OSS
    console.log(`[Upload] Starting upload for ${videoId}, size: ${(buffer.length / 1024 / 1024).toFixed(2)} MB`)

    const fileUrl = await uploadToOSS(buffer, fileName, file.type)

    console.log(`[Upload] Upload complete: ${fileUrl}`)

    return NextResponse.json({
      success: true,
      videoId,
      fileName,
      fileUrl,
      fileSize: buffer.length,
      title: title || `视频 ${videoId}`,
    })
  } catch (error) {
    console.error('[Upload] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/upload
 * 检查 OSS 配置状态
 */
export async function GET() {
  return NextResponse.json({
    configured: isOSSConfigured(),
    region: process.env.OSS_REGION || 'oss-cn-hangzhou',
    bucket: process.env.OSS_BUCKET || '(not set)',
  })
}
