/**
 * 火山引擎视频上传模块
 *
 * 通过 URL 拉取上传视频到火山引擎 VOD
 * 参考文档: https://www.volcengine.com/docs/4/68620
 */

import { signVolcengineRequest, buildVolcengineUrl } from './volcengine-auth'

// API 配置
const VOD_HOST = 'vod.volcengineapi.com'
const VOD_PATH = '/'
const API_VERSION = '2020-08-01'
const REGION = 'cn-north-1'
const SERVICE = 'vod'

// 轮询配置
const UPLOAD_POLL_CONFIG = {
  initialDelay: 3000, // 首次查询延迟 3 秒
  pollInterval: 2000, // 轮询间隔 2 秒
  maxWaitTime: 600000, // 最大等待 10 分钟
  maxRetries: 300, // 最大轮询次数
}

/**
 * 上传任务状态
 */
export type UploadState = 'initial' | 'processing' | 'success' | 'failed'

/**
 * 上传任务信息
 */
export interface UploadTaskInfo {
  jobId: string
  sourceUrl: string
  state: UploadState
  vid?: string
  spaceName?: string
  accountId?: string
  errorMessage?: string
}

/**
 * 火山引擎 API 响应
 */
interface VolcengineResponse<T> {
  ResponseMetadata: {
    RequestId: string
    Action: string
    Version: string
    Service: string
    Region: string
    Error?: {
      Code: string
      Message: string
    }
  }
  Result?: T
}

/**
 * UploadMediaByUrl 响应
 */
interface UploadMediaByUrlResult {
  Data: Array<{
    JobId: string
    SourceUrl: string
  }>
}

/**
 * QueryUploadTaskInfo 响应
 * 注意：实际响应结构是 { Data: { MediaInfoList: [...] } }
 */
interface QueryUploadTaskInfoResult {
  Data: {
    MediaInfoList: Array<{
      JobId: string
      SourceUrl: string
      State: UploadState
      Vid?: string
      SpaceName?: string
      AccountId?: string
      SourceInfo?: {
        Format?: string
        Duration?: number
        Size?: number
        Width?: number
        Height?: number
      }
    }>
    NotExistJobIds?: string[]
  }
}

/**
 * 获取环境变量配置
 */
function getConfig() {
  const accessKeyId = process.env.VOLCENGINE_ACCESS_KEY_ID
  const accessKeySecret = process.env.VOLCENGINE_ACCESS_KEY_SECRET
  const spaceName = process.env.VOLCENGINE_VOD_SPACE_NAME

  if (!accessKeyId || !accessKeySecret) {
    throw new Error(
      '缺少火山引擎配置，请设置 VOLCENGINE_ACCESS_KEY_ID 和 VOLCENGINE_ACCESS_KEY_SECRET 环境变量'
    )
  }

  if (!spaceName) {
    throw new Error(
      '缺少火山引擎 VOD 空间配置，请设置 VOLCENGINE_VOD_SPACE_NAME 环境变量'
    )
  }

  return { accessKeyId, accessKeySecret, spaceName }
}

/**
 * 发送火山引擎 API 请求 (POST)
 */
async function sendRequest<T>(
  action: string,
  body: Record<string, unknown> = {},
  queryParams: Record<string, string> = {}
): Promise<T> {
  const { accessKeyId, accessKeySecret } = getConfig()

  const query: Record<string, string> = {
    Action: action,
    Version: API_VERSION,
    ...queryParams,
  }

  const bodyStr = JSON.stringify(body)

  const headers = signVolcengineRequest({
    method: 'POST',
    host: VOD_HOST,
    path: VOD_PATH,
    query,
    headers: {
      'content-type': 'application/json',
    },
    body: bodyStr,
    accessKeyId,
    accessKeySecret,
    region: REGION,
    service: SERVICE,
  })

  const url = buildVolcengineUrl(VOD_HOST, VOD_PATH, query)
  console.log('[Volcengine Upload] 请求 URL:', url)

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: bodyStr,
  })

  const data = (await response.json()) as VolcengineResponse<T>

  if (data.ResponseMetadata.Error) {
    throw new Error(
      `火山引擎 API 错误: ${data.ResponseMetadata.Error.Code} - ${data.ResponseMetadata.Error.Message}`
    )
  }

  if (!data.Result) {
    throw new Error('火山引擎 API 返回空结果')
  }

  return data.Result
}

/**
 * 发送火山引擎 API 请求 (GET)
 */
async function sendGetRequest<T>(
  action: string,
  queryParams: Record<string, string> = {}
): Promise<T> {
  const { accessKeyId, accessKeySecret } = getConfig()

  const query: Record<string, string> = {
    Action: action,
    Version: API_VERSION,
    ...queryParams,
  }

  const headers = signVolcengineRequest({
    method: 'GET',
    host: VOD_HOST,
    path: VOD_PATH,
    query,
    headers: {},
    body: '',
    accessKeyId,
    accessKeySecret,
    region: REGION,
    service: SERVICE,
  })

  const url = buildVolcengineUrl(VOD_HOST, VOD_PATH, query)
  console.log('[Volcengine Upload] GET 请求 URL:', url)

  const response = await fetch(url, {
    method: 'GET',
    headers,
  })

  const data = (await response.json()) as VolcengineResponse<T>

  if (data.ResponseMetadata.Error) {
    throw new Error(
      `火山引擎 API 错误: ${data.ResponseMetadata.Error.Code} - ${data.ResponseMetadata.Error.Message}`
    )
  }

  if (!data.Result) {
    throw new Error('火山引擎 API 返回空结果')
  }

  return data.Result
}

/**
 * 通过 URL 上传视频到火山引擎
 *
 * @param sourceUrl 视频的公网 URL
 * @param title 视频标题（可选）
 * @returns 上传任务 ID (JobId)
 */
export async function uploadMediaByUrl(
  sourceUrl: string,
  title?: string
): Promise<string> {
  const { spaceName } = getConfig()

  console.log('[Volcengine Upload] 提交上传任务:', sourceUrl)

  const result = await sendRequest<UploadMediaByUrlResult>('UploadMediaByUrl', {
    SpaceName: spaceName,
    URLSets: [
      {
        SourceUrl: sourceUrl,
        Title: title || `video-${Date.now()}`,
      },
    ],
  })

  console.log('[Volcengine Upload] API 响应:', JSON.stringify(result, null, 2))

  if (!result.Data || result.Data.length === 0) {
    throw new Error('上传任务提交失败：未返回 JobId')
  }

  const jobId = result.Data[0].JobId
  console.log('[Volcengine Upload] 任务已提交, JobId:', jobId)
  return jobId
}

/**
 * 查询上传任务状态
 *
 * @param jobId 任务 ID
 * @returns 上传任务信息
 */
export async function queryUploadTaskInfo(
  jobId: string
): Promise<UploadTaskInfo> {
  console.log('[Volcengine Upload] 查询任务状态:', jobId)

  const result = await sendGetRequest<QueryUploadTaskInfoResult>(
    'QueryUploadTaskInfo',
    { JobIds: jobId }
  )

  console.log('[Volcengine Upload] 查询响应:', JSON.stringify(result, null, 2))

  // 注意：实际响应结构是 { Data: { MediaInfoList: [...] } }
  const mediaInfoList = result.Data?.MediaInfoList
  const notExistJobIds = result.Data?.NotExistJobIds

  if (notExistJobIds?.includes(jobId)) {
    throw new Error(`上传任务不存在: ${jobId}`)
  }

  if (!mediaInfoList || mediaInfoList.length === 0) {
    throw new Error('查询上传任务失败：未返回任务信息')
  }

  const info = mediaInfoList[0]
  return {
    jobId: info.JobId,
    sourceUrl: info.SourceUrl,
    state: info.State,
    vid: info.Vid,
    spaceName: info.SpaceName,
    accountId: info.AccountId,
  }
}

/**
 * 等待视频上传完成
 *
 * @param sourceUrl 视频 URL
 * @param options 配置选项
 * @returns 上传成功后的 Vid
 */
export async function waitForUpload(
  sourceUrl: string,
  options?: {
    title?: string
    pollInterval?: number
    maxWaitTime?: number
    onProgress?: (state: UploadState, message?: string) => void
  }
): Promise<string> {
  const pollInterval = options?.pollInterval ?? UPLOAD_POLL_CONFIG.pollInterval
  const maxWaitTime = options?.maxWaitTime ?? UPLOAD_POLL_CONFIG.maxWaitTime
  const onProgress = options?.onProgress

  // 提交上传任务
  onProgress?.('initial', '正在提交上传任务...')
  const jobId = await uploadMediaByUrl(sourceUrl, options?.title)

  // 等待初始延迟
  onProgress?.('processing', '等待上传开始...')
  await sleep(UPLOAD_POLL_CONFIG.initialDelay)

  // 轮询结果
  const startTime = Date.now()
  let retries = 0

  while (retries < UPLOAD_POLL_CONFIG.maxRetries) {
    const elapsed = Date.now() - startTime
    if (elapsed > maxWaitTime) {
      throw new Error(`上传任务超时（已等待 ${Math.round(elapsed / 1000)} 秒）`)
    }

    const info = await queryUploadTaskInfo(jobId)

    switch (info.state) {
      case 'success':
        if (!info.vid) {
          throw new Error('上传成功但未返回 Vid')
        }
        onProgress?.('success', `上传完成，Vid: ${info.vid}`)
        console.log('[Volcengine Upload] 上传完成, Vid:', info.vid)
        return info.vid

      case 'failed':
        throw new Error(`上传失败: ${info.errorMessage || '未知错误'}`)

      case 'initial':
      case 'processing':
        onProgress?.(info.state, `上传${info.state === 'initial' ? '等待中' : '处理中'}...`)
        break
    }

    retries++
    await sleep(pollInterval)
  }

  throw new Error('上传任务轮询次数超限')
}

/**
 * 辅助函数：延迟
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * 检查火山引擎上传配置是否可用
 */
export function isVolcengineUploadConfigured(): boolean {
  return !!(
    process.env.VOLCENGINE_ACCESS_KEY_ID &&
    process.env.VOLCENGINE_ACCESS_KEY_SECRET &&
    process.env.VOLCENGINE_VOD_SPACE_NAME
  )
}
