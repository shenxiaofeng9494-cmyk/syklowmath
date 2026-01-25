/**
 * 火山引擎智能场景切分 API 客户端
 *
 * 使用火山引擎视频点播的智能场景切分功能
 * 参考文档: https://www.volcengine.com/docs/4/175710
 */

import { signVolcengineRequest, buildVolcengineUrl } from './volcengine-auth'

// API 配置
const VOD_HOST = 'vod.volcengineapi.com'
const VOD_PATH = '/'
const API_VERSION = '2025-01-01'
const REGION = 'cn-north-1'
const SERVICE = 'vod'

// 轮询配置
const POLL_CONFIG = {
  initialDelay: 5000, // 首次查询延迟 5 秒
  pollInterval: 3000, // 轮询间隔 3 秒
  maxWaitTime: 300000, // 最大等待 5 分钟
  maxRetries: 100, // 最大轮询次数
}

/**
 * 场景切分片段
 */
export interface SceneSegment {
  start: number // 开始时间（秒）
  end: number // 结束时间（秒）
  frames: [number, number] // 帧范围
}

/**
 * 场景切分结果
 */
export interface SceneSegmentationResult {
  runId: string
  status: 'Pending' | 'Running' | 'Success' | 'Failed'
  segments: SceneSegment[]
  message?: string
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
 * StartExecution 响应
 */
interface StartExecutionResult {
  RunId: string
}

/**
 * GetExecution 响应
 * 参考文档: https://www.volcengine.com/docs/4/1582325
 */
interface GetExecutionResult {
  RunId: string
  Status: 'PendingStart' | 'Pending' | 'Running' | 'Success' | 'Failed' | 'Terminated'
  Code?: string
  Output?: {
    Type: string
    Task?: {
      Type: string
      Segment?: {
        Duration: number
        Segments?: Array<{
          Start: number
          End: number
          Frames: [number, number]
          File?: {
            Size: string
            FileName: string
          }
        }>
      }
    }
  }
  Message?: string
}

/**
 * 获取环境变量配置
 */
function getConfig() {
  const accessKeyId = process.env.VOLCENGINE_ACCESS_KEY_ID
  const accessKeySecret = process.env.VOLCENGINE_ACCESS_KEY_SECRET

  if (!accessKeyId || !accessKeySecret) {
    throw new Error(
      '缺少火山引擎配置，请设置 VOLCENGINE_ACCESS_KEY_ID 和 VOLCENGINE_ACCESS_KEY_SECRET 环境变量'
    )
  }

  return { accessKeyId, accessKeySecret }
}

/**
 * 发送火山引擎 API POST 请求
 */
async function sendPostRequest<T>(
  action: string,
  body: Record<string, unknown> = {}
): Promise<T> {
  const { accessKeyId, accessKeySecret } = getConfig()

  const query: Record<string, string> = {
    Action: action,
    Version: API_VERSION,
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
  console.log('[Volcengine] POST 请求 URL:', url)
  console.log('[Volcengine] 请求 Body:', bodyStr)

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: bodyStr,
  })

  const responseText = await response.text()
  console.log('[Volcengine] 响应:', responseText)

  let data: VolcengineResponse<T>
  try {
    data = JSON.parse(responseText) as VolcengineResponse<T>
  } catch (e) {
    throw new Error(`火山引擎 API 响应解析失败: ${responseText.substring(0, 200)}`)
  }

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
 * 发送火山引擎 API GET 请求
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
  console.log('[Volcengine] GET 请求 URL:', url)

  const response = await fetch(url, {
    method: 'GET',
    headers,
  })

  const responseText = await response.text()
  console.log('[Volcengine] 响应:', responseText)

  let data: VolcengineResponse<T>
  try {
    data = JSON.parse(responseText) as VolcengineResponse<T>
  } catch (e) {
    throw new Error(`火山引擎 API 响应解析失败: ${responseText.substring(0, 200)}`)
  }

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
 * 提交场景切分任务（使用 Vid）
 *
 * @param vid 火山引擎视频 ID
 * @param options 可选参数
 * @returns 任务 ID (RunId)
 */
export async function submitSceneSegmentationByVid(
  vid: string,
  options?: {
    threshold?: number // 敏感度阈值 [0-100]，值越低切分越敏感
    maxDuration?: number // 单个切片最大时长（秒）
    minDuration?: number // 单个切片最小时长（秒）
  }
): Promise<string> {
  console.log('[Volcengine] 提交场景切分任务 (Vid):', vid, options)

  const segmentConfig: Record<string, unknown> = {
    NoFile: true, // 不生成切片文件，只返回时间戳
  }

  // 设置敏感度阈值，默认 10（较敏感）
  if (options?.threshold !== undefined) {
    segmentConfig.Threshold = options.threshold
  } else {
    segmentConfig.Threshold = 10 // 默认较敏感
  }

  // 设置最大切片时长
  if (options?.maxDuration !== undefined) {
    segmentConfig.MaxDuration = options.maxDuration
  } else {
    segmentConfig.MaxDuration = 120 // 默认最大 2 分钟
  }

  // 设置最小切片时长
  if (options?.minDuration !== undefined) {
    segmentConfig.MinDuration = options.minDuration
  }

  const result = await sendPostRequest<StartExecutionResult>('StartExecution', {
    Input: {
      Type: 'Vid',
      Vid: vid,
    },
    Operation: {
      Type: 'Task',
      Task: {
        Type: 'Segment',
        Segment: segmentConfig,
      },
    },
  })

  console.log('[Volcengine] 任务已提交, RunId:', result.RunId)
  return result.RunId
}

/**
 * 提交场景切分任务（使用 URL - 已废弃，火山引擎不支持外部 URL）
 *
 * @param videoUrl 视频的公网 URL（如阿里云 OSS 地址）
 * @returns 任务 ID (RunId)
 * @deprecated 火山引擎不支持外部 URL，请使用 submitSceneSegmentationByVid
 */
export async function submitSceneSegmentation(videoUrl: string): Promise<string> {
  console.log('[Volcengine] 提交场景切分任务:', videoUrl)

  const result = await sendPostRequest<StartExecutionResult>('StartExecution', {
    Input: {
      Type: 'Url',
      Url: videoUrl,
    },
    Operation: {
      Type: 'Task',
      Task: {
        Type: 'Segment',
        Segment: {
          NoFile: true, // 不生成切片文件，只返回时间戳
        },
      },
    },
  })

  console.log('[Volcengine] 任务已提交, RunId:', result.RunId)
  return result.RunId
}

/**
 * 查询场景切分任务结果
 *
 * @param runId 任务 ID
 * @returns 切分结果
 */
export async function getSceneSegmentationResult(
  runId: string
): Promise<SceneSegmentationResult> {
  console.log('[Volcengine] 查询任务状态:', runId)

  // GetExecution 使用 GET 方法，RunId 作为 Query 参数
  const result = await sendGetRequest<GetExecutionResult>('GetExecution', {
    RunId: runId,
  })

  console.log('[Volcengine] 任务状态:', result.Status)

  const segments: SceneSegment[] = []

  // 正确的路径: Output.Task.Segment.Segments
  const segmentData = result.Output?.Task?.Segment?.Segments
  if (result.Status === 'Success' && segmentData) {
    for (const seg of segmentData) {
      segments.push({
        start: seg.Start,
        end: seg.End,
        frames: seg.Frames,
      })
    }
  }

  // 映射状态: PendingStart -> Pending
  let status = result.Status
  if (status === 'PendingStart') {
    status = 'Pending'
  }

  return {
    runId: result.RunId,
    status: status as 'Pending' | 'Running' | 'Success' | 'Failed',
    segments,
    message: result.Message || result.Code,
  }
}

/**
 * 等待场景切分任务完成（使用 Vid）
 *
 * @param vid 火山引擎视频 ID
 * @param options 配置选项
 * @returns 切分结果
 */
export async function waitForSceneSegmentationByVid(
  vid: string,
  options?: {
    pollInterval?: number
    maxWaitTime?: number
    onProgress?: (status: string, message?: string) => void
    // 场景切分参数
    threshold?: number // 敏感度阈值 [0-100]，值越低切分越敏感
    maxDuration?: number // 单个切片最大时长（秒）
    minDuration?: number // 单个切片最小时长（秒）
  }
): Promise<SceneSegment[]> {
  const pollInterval = options?.pollInterval ?? POLL_CONFIG.pollInterval
  const maxWaitTime = options?.maxWaitTime ?? POLL_CONFIG.maxWaitTime
  const onProgress = options?.onProgress

  // 提交任务
  onProgress?.('submitting', '正在提交场景切分任务...')
  const runId = await submitSceneSegmentationByVid(vid, {
    threshold: options?.threshold,
    maxDuration: options?.maxDuration,
    minDuration: options?.minDuration,
  })

  // 等待初始延迟
  onProgress?.('waiting', '等待任务开始处理...')
  await sleep(POLL_CONFIG.initialDelay)

  // 轮询结果
  const startTime = Date.now()
  let retries = 0

  while (retries < POLL_CONFIG.maxRetries) {
    const elapsed = Date.now() - startTime
    if (elapsed > maxWaitTime) {
      throw new Error(`场景切分任务超时（已等待 ${Math.round(elapsed / 1000)} 秒）`)
    }

    const result = await getSceneSegmentationResult(runId)

    switch (result.status) {
      case 'Success':
        onProgress?.('success', `切分完成，共 ${result.segments.length} 个场景`)
        console.log('[Volcengine] 任务完成:', result.segments.length, '个场景')
        return result.segments

      case 'Failed':
        throw new Error(`场景切分任务失败: ${result.message || '未知错误'}`)

      case 'Pending':
      case 'Running':
        onProgress?.(result.status.toLowerCase(), `任务${result.status === 'Pending' ? '等待中' : '处理中'}...`)
        break
    }

    retries++
    await sleep(pollInterval)
  }

  throw new Error('场景切分任务轮询次数超限')
}

/**
 * 等待场景切分任务完成（使用 URL - 已废弃）
 *
 * @param videoUrl 视频 URL
 * @param options 配置选项
 * @returns 切分结果
 * @deprecated 火山引擎不支持外部 URL，请使用 waitForSceneSegmentationByVid
 */
export async function waitForSceneSegmentation(
  videoUrl: string,
  options?: {
    pollInterval?: number
    maxWaitTime?: number
    onProgress?: (status: string, message?: string) => void
  }
): Promise<SceneSegment[]> {
  const pollInterval = options?.pollInterval ?? POLL_CONFIG.pollInterval
  const maxWaitTime = options?.maxWaitTime ?? POLL_CONFIG.maxWaitTime
  const onProgress = options?.onProgress

  // 提交任务
  onProgress?.('submitting', '正在提交场景切分任务...')
  const runId = await submitSceneSegmentation(videoUrl)

  // 等待初始延迟
  onProgress?.('waiting', '等待任务开始处理...')
  await sleep(POLL_CONFIG.initialDelay)

  // 轮询结果
  const startTime = Date.now()
  let retries = 0

  while (retries < POLL_CONFIG.maxRetries) {
    const elapsed = Date.now() - startTime
    if (elapsed > maxWaitTime) {
      throw new Error(`场景切分任务超时（已等待 ${Math.round(elapsed / 1000)} 秒）`)
    }

    const result = await getSceneSegmentationResult(runId)

    switch (result.status) {
      case 'Success':
        onProgress?.('success', `切分完成，共 ${result.segments.length} 个场景`)
        console.log('[Volcengine] 任务完成:', result.segments.length, '个场景')
        return result.segments

      case 'Failed':
        throw new Error(`场景切分任务失败: ${result.message || '未知错误'}`)

      case 'Pending':
      case 'Running':
        onProgress?.(result.status.toLowerCase(), `任务${result.status === 'Pending' ? '等待中' : '处理中'}...`)
        break
    }

    retries++
    await sleep(pollInterval)
  }

  throw new Error('场景切分任务轮询次数超限')
}

/**
 * 辅助函数：延迟
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * 检查火山引擎配置是否可用
 */
export function isVolcengineConfigured(): boolean {
  return !!(
    process.env.VOLCENGINE_ACCESS_KEY_ID &&
    process.env.VOLCENGINE_ACCESS_KEY_SECRET
  )
}
