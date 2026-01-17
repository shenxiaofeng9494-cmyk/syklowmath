/**
 * 阿里云 OSS 文件上传
 */
import OSS from 'ali-oss'

// OSS 配置
const ossConfig = {
  region: process.env.OSS_REGION || 'oss-cn-hangzhou',
  accessKeyId: process.env.OSS_ACCESS_KEY_ID || '',
  accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET || '',
  bucket: process.env.OSS_BUCKET || '',
}

/**
 * 检查 OSS 配置是否完整
 */
export function isOSSConfigured(): boolean {
  return !!(
    ossConfig.accessKeyId &&
    ossConfig.accessKeySecret &&
    ossConfig.bucket
  )
}

/**
 * 创建 OSS 客户端
 */
function createOSSClient(): OSS {
  if (!isOSSConfigured()) {
    throw new Error('OSS configuration is incomplete. Please set OSS_ACCESS_KEY_ID, OSS_ACCESS_KEY_SECRET, and OSS_BUCKET.')
  }

  return new OSS({
    region: ossConfig.region,
    accessKeyId: ossConfig.accessKeyId,
    accessKeySecret: ossConfig.accessKeySecret,
    bucket: ossConfig.bucket,
  })
}

/**
 * 上传文件到 OSS
 * @param buffer 文件内容
 * @param fileName 文件名（如 videos/demo.mp4）
 * @param contentType MIME 类型
 * @returns 公网可访问的 URL
 */
export async function uploadToOSS(
  buffer: Buffer,
  fileName: string,
  contentType?: string
): Promise<string> {
  const client = createOSSClient()

  console.log(`[OSS] Uploading file: ${fileName}`)

  const result = await client.put(fileName, buffer, {
    headers: contentType ? { 'Content-Type': contentType } : undefined,
  })

  // 构建公网 URL
  const url = `https://${ossConfig.bucket}.${ossConfig.region}.aliyuncs.com/${fileName}`

  console.log(`[OSS] Upload complete: ${url}`)

  return url
}

/**
 * 删除 OSS 文件
 */
export async function deleteFromOSS(fileName: string): Promise<void> {
  const client = createOSSClient()

  console.log(`[OSS] Deleting file: ${fileName}`)

  await client.delete(fileName)

  console.log(`[OSS] Delete complete: ${fileName}`)
}

/**
 * 检查文件是否存在
 */
export async function existsInOSS(fileName: string): Promise<boolean> {
  const client = createOSSClient()

  try {
    await client.head(fileName)
    return true
  } catch (error: any) {
    if (error.code === 'NoSuchKey') {
      return false
    }
    throw error
  }
}

/**
 * 生成视频文件名
 */
export function generateVideoFileName(videoId: string, originalName: string): string {
  const ext = originalName.split('.').pop() || 'mp4'
  return `videos/${videoId}.${ext}`
}
