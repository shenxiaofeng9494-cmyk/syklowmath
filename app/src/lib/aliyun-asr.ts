/**
 * 阿里云 DashScope Paraformer 语音识别
 * 支持词级时间戳，用于将视频/音频文件转写为精确字幕
 */

const DASHSCOPE_API_KEY = process.env.DASHSCOPE_API_KEY
const DASHSCOPE_ASR_URL = 'https://dashscope.aliyuncs.com/api/v1/services/audio/asr/transcription'
const DASHSCOPE_TASKS_URL = 'https://dashscope.aliyuncs.com/api/v1/tasks'

interface TranscriptionTask {
  request_id: string
  output: {
    task_id: string
    task_status: 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED'
    submit_time?: string
    scheduled_time?: string
    end_time?: string
    results?: Array<{
      file_url: string
      transcription_url: string
      subtask_status: string
    }>
    message?: string
  }
  usage?: {
    duration: number
  }
}

// Paraformer 返回的词级结果
interface ParaformerWord {
  begin_time: number // 毫秒
  end_time: number // 毫秒
  text: string
  punctuation?: string
}

interface ParaformerSentence {
  begin_time: number
  end_time: number
  text: string
  words?: ParaformerWord[]
}

interface ParaformerParagraph {
  begin_time: number
  end_time: number
  text: string
  sentences?: ParaformerSentence[]
  words?: ParaformerWord[]
}

interface ParaformerTranscript {
  channel_id: number
  text: string
  paragraphs?: ParaformerParagraph[]
  sentences?: ParaformerSentence[]
  words?: ParaformerWord[]
}

interface ParaformerResult {
  file_url: string
  properties?: {
    original_duration_in_milliseconds?: number
  }
  transcripts: ParaformerTranscript[]
}

/**
 * 提交转写任务
 */
async function submitTranscriptionTask(fileUrl: string): Promise<string> {
  if (!DASHSCOPE_API_KEY) {
    throw new Error('Missing DASHSCOPE_API_KEY environment variable')
  }

  const response = await fetch(DASHSCOPE_ASR_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${DASHSCOPE_API_KEY}`,
      'Content-Type': 'application/json',
      'X-DashScope-Async': 'enable',
    },
    body: JSON.stringify({
      model: 'paraformer-v2',
      input: {
        file_urls: [fileUrl],
      },
      parameters: {
        language_hints: ['zh'],
      },
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to submit transcription task: ${error}`)
  }

  const result: TranscriptionTask = await response.json()

  if (!result.output?.task_id) {
    throw new Error('No task_id returned from API')
  }

  return result.output.task_id
}

/**
 * 查询任务状态
 */
async function getTaskStatus(taskId: string): Promise<TranscriptionTask> {
  if (!DASHSCOPE_API_KEY) {
    throw new Error('Missing DASHSCOPE_API_KEY environment variable')
  }

  const response = await fetch(`${DASHSCOPE_TASKS_URL}/${taskId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${DASHSCOPE_API_KEY}`,
    },
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to get task status: ${error}`)
  }

  return response.json()
}

/**
 * 等待任务完成并获取结果
 */
async function waitForCompletion(
  taskId: string,
  maxWaitMs = 600000,
  pollIntervalMs = 3000
): Promise<TranscriptionTask> {
  const startTime = Date.now()

  while (Date.now() - startTime < maxWaitMs) {
    const task = await getTaskStatus(taskId)

    if (task.output.task_status === 'SUCCEEDED') {
      return task
    }

    if (task.output.task_status === 'FAILED') {
      throw new Error(`Transcription task failed: ${task.output.message || 'Unknown error'}`)
    }

    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs))
  }

  throw new Error('Transcription task timed out')
}

/**
 * 获取转写结果详情
 */
async function fetchTranscriptionResult(transcriptionUrl: string): Promise<ParaformerResult> {
  const response = await fetch(transcriptionUrl)

  if (!response.ok) {
    throw new Error(`Failed to fetch transcription result: ${response.statusText}`)
  }

  return response.json()
}

/**
 * 转换为我们的字幕格式
 */
export interface SubtitleCue {
  start: number // 秒
  end: number // 秒
  text: string
}

export interface SubtitleData {
  videoId: string
  language: string
  duration: number // 秒
  fullText: string
  subtitles: SubtitleCue[]
}

/**
 * 将长字幕按中文标点拆分为多条短字幕
 * 时间按字符数比例分配
 *
 * 策略：
 * 1. 先尝试按句末标点（。！？）拆分
 * 2. 如果拆分后仍有超长片段，再按逗号（，）拆分
 */
function splitLongSubtitle(
  text: string,
  startTime: number,
  endTime: number,
  maxLength: number = 40
): SubtitleCue[] {
  // 如果文本足够短，直接返回
  if (text.length <= maxLength) {
    return [{ start: startTime, end: endTime, text }]
  }

  // 第一步：按中文句末标点拆分（保留标点）
  let parts = text.split(/(?<=[。！？])/).filter(p => p.trim())

  // 如果没有句末标点可拆分，尝试按逗号拆分
  if (parts.length <= 1) {
    parts = text.split(/(?<=[，,])/).filter(p => p.trim())
  }

  // 如果还是只有一部分（无标点可拆分），直接返回
  if (parts.length <= 1) {
    return [{ start: startTime, end: endTime, text }]
  }

  // 第二步：检查是否有超长片段，需要进一步按逗号拆分
  const refinedParts: string[] = []
  for (const part of parts) {
    if (part.length > maxLength) {
      // 超长片段按逗号拆分
      const subParts = part.split(/(?<=[，,])/).filter(p => p.trim())
      if (subParts.length > 1) {
        refinedParts.push(...subParts)
      } else {
        refinedParts.push(part)
      }
    } else {
      refinedParts.push(part)
    }
  }

  // 计算总字符数用于时间分配
  const totalChars = refinedParts.reduce((sum, p) => sum + p.length, 0)
  const totalDuration = endTime - startTime

  const result: SubtitleCue[] = []
  let currentTime = startTime

  for (const part of refinedParts) {
    const trimmed = part.trim()
    if (!trimmed) continue

    // 按字符比例计算这部分的时长
    const duration = (trimmed.length / totalChars) * totalDuration
    const partEnd = currentTime + duration

    result.push({
      start: currentTime,
      end: partEnd,
      text: trimmed,
    })

    currentTime = partEnd
  }

  return result
}

/**
 * 从 Paraformer 结果中提取字幕
 * 优先使用 sentences 级别，如果没有则用 words 组合
 * 长字幕会按句末标点拆分为更短的段落
 */
function extractSubtitles(transcript: ParaformerTranscript): SubtitleCue[] {
  const rawSubtitles: SubtitleCue[] = []

  // 优先从 paragraphs -> sentences 获取
  if (transcript.paragraphs?.length) {
    for (const para of transcript.paragraphs) {
      if (para.sentences?.length) {
        for (const sentence of para.sentences) {
          rawSubtitles.push({
            start: sentence.begin_time / 1000,
            end: sentence.end_time / 1000,
            text: sentence.text.trim(),
          })
        }
      } else if (para.words?.length) {
        // 如果没有 sentences，用整个 paragraph
        rawSubtitles.push({
          start: para.begin_time / 1000,
          end: para.end_time / 1000,
          text: para.text.trim(),
        })
      }
    }
  }
  // 如果没有 paragraphs，尝试直接用 sentences
  else if (transcript.sentences?.length) {
    for (const sentence of transcript.sentences) {
      rawSubtitles.push({
        start: sentence.begin_time / 1000,
        end: sentence.end_time / 1000,
        text: sentence.text.trim(),
      })
    }
  }
  // 最后尝试用 words 组合成句子（按标点分割）
  else if (transcript.words?.length) {
    let currentText = ''
    let startTime = transcript.words[0].begin_time
    let endTime = transcript.words[0].end_time

    for (const word of transcript.words) {
      currentText += word.text
      endTime = word.end_time

      // 遇到句末标点，生成一条字幕
      if (word.punctuation && /[。！？]/.test(word.punctuation)) {
        currentText += word.punctuation
        rawSubtitles.push({
          start: startTime / 1000,
          end: endTime / 1000,
          text: currentText.trim(),
        })
        currentText = ''
        // 下一句的开始时间
        startTime = endTime
      } else if (word.punctuation) {
        currentText += word.punctuation
      }
    }

    // 处理剩余文本
    if (currentText.trim()) {
      rawSubtitles.push({
        start: startTime / 1000,
        end: endTime / 1000,
        text: currentText.trim(),
      })
    }
  }

  // 拆分长字幕为更短的段落（最大 50 字符）
  const subtitles: SubtitleCue[] = []
  for (const cue of rawSubtitles) {
    const split = splitLongSubtitle(cue.text, cue.start, cue.end, 50)
    subtitles.push(...split)
  }

  return subtitles
}

/**
 * 完整的转写流程
 * @param videoId 视频 ID
 * @param fileUrl 公网可访问的视频/音频 URL
 */
export async function transcribeWithAliyun(
  videoId: string,
  fileUrl: string
): Promise<SubtitleData> {
  console.log(`[Paraformer] 开始转写: ${videoId}`)
  console.log(`[Paraformer] 文件 URL: ${fileUrl}`)

  // 1. 提交任务
  console.log('[Paraformer] 提交转写任务...')
  const taskId = await submitTranscriptionTask(fileUrl)
  console.log(`[Paraformer] 任务已提交, task_id: ${taskId}`)

  // 2. 等待完成
  console.log('[Paraformer] 等待转写完成...')
  const task = await waitForCompletion(taskId)
  console.log('[Paraformer] 转写完成!')

  // 3. 获取结果 URL
  const transcriptionUrl = task.output.results?.[0]?.transcription_url
  if (!transcriptionUrl) {
    throw new Error(`No transcription URL in result. Task output: ${JSON.stringify(task.output)}`)
  }

  console.log('[Paraformer] 获取转写结果...')
  const result = await fetchTranscriptionResult(transcriptionUrl)
  console.log('[Paraformer] 转写结果结构:', Object.keys(result).join(', '))

  // 4. 转换格式
  const transcript = result.transcripts?.[0]
  if (!transcript) {
    throw new Error(`No transcript in result. Keys: ${Object.keys(result).join(', ')}`)
  }

  console.log('[Paraformer] transcript 结构:', {
    hasText: !!transcript.text,
    hasParagraphs: !!transcript.paragraphs?.length,
    hasSentences: !!transcript.sentences?.length,
    hasWords: !!transcript.words?.length,
  })

  // 提取字幕
  const subtitles = extractSubtitles(transcript)

  // 计算时长
  const lastSubtitle = subtitles[subtitles.length - 1]
  const durationSeconds = lastSubtitle?.end ||
    (result.properties?.original_duration_in_milliseconds || 0) / 1000

  const subtitleData: SubtitleData = {
    videoId,
    language: 'zh',
    duration: durationSeconds,
    fullText: transcript.text,
    subtitles,
  }

  console.log(`[Paraformer] 转写完成，共 ${subtitles.length} 条字幕，时长 ${durationSeconds.toFixed(1)} 秒`)

  return subtitleData
}
