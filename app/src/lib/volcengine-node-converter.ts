/**
 * 火山引擎场景切分结果转换器
 *
 * 将火山引擎的场景切分结果转换为 VideoNodeData 格式
 */

import type { SceneSegment } from './volcengine-scene-segmentation'
import type { VideoNodeInsert } from '@/types/database'

interface SubtitleCue {
  start: number
  end: number
  text: string
}

/**
 * 从字幕中提取指定时间范围的文本
 */
function extractTranscript(
  subtitles: SubtitleCue[],
  startTime: number,
  endTime: number
): string {
  return subtitles
    .filter((cue) => cue.start >= startTime && cue.end <= endTime)
    .map((cue) => cue.text)
    .join(' ')
}

/**
 * 生成场景标题
 *
 * 基于字幕内容生成简短标题，如果字幕为空则使用默认标题
 */
function generateSceneTitle(transcript: string, index: number): string {
  if (!transcript || transcript.trim().length === 0) {
    return `场景 ${index + 1}`
  }

  // 取前 20 个字符作为标题
  const trimmed = transcript.trim()
  if (trimmed.length <= 20) {
    return trimmed
  }

  // 尝试在标点符号处截断
  const punctuationMatch = trimmed.slice(0, 30).match(/[，。！？、；：,.!?;:]/)
  if (punctuationMatch && punctuationMatch.index && punctuationMatch.index > 5) {
    return trimmed.slice(0, punctuationMatch.index)
  }

  return trimmed.slice(0, 20) + '...'
}

/**
 * 将火山引擎场景切分结果转换为 VideoNodeInsert 格式
 *
 * @param videoId 视频 ID
 * @param scenes 火山引擎返回的场景列表
 * @param subtitles 字幕数据
 * @returns VideoNodeInsert 数组（不含 embedding，需要后续生成）
 */
export function convertScenesToNodes(
  videoId: string,
  scenes: SceneSegment[],
  subtitles: SubtitleCue[]
): Omit<VideoNodeInsert, 'embedding'>[] {
  return scenes.map((scene, index) => {
    const startTime = Math.floor(scene.start)
    const endTime = Math.ceil(scene.end)
    const transcript = extractTranscript(subtitles, startTime, endTime)
    const title = generateSceneTitle(transcript, index)

    return {
      id: `node-${videoId}-${index + 1}`,
      video_id: videoId,
      order: index + 1,
      start_time: startTime,
      end_time: endTime,
      title,
      summary: transcript.slice(0, 200) || `视频片段 ${index + 1}`,
      key_concepts: [],
      transcript,
      // V3 字段 - 火山引擎视觉切分
      boundary_confidence: 1.0,
      boundary_signals: ['visual_scene_change'],
      boundary_reason: '基于视觉转场检测',
      node_type: null,
      version: 3,
      created_by: 'auto' as const,
    }
  })
}

/**
 * 合并相邻的短场景
 *
 * 火山引擎可能会切分出很多短场景，可以选择合并
 * 策略：将短场景合并到前一个场景，直到合并后的场景达到最小时长
 *
 * @param scenes 原始场景列表
 * @param minDuration 最小场景时长（秒），短于此时长的场景会被合并到相邻场景
 * @returns 合并后的场景列表
 */
export function mergeShortScenes(
  scenes: SceneSegment[],
  minDuration: number = 10
): SceneSegment[] {
  if (scenes.length === 0) return []
  if (scenes.length === 1) return scenes

  const merged: SceneSegment[] = []
  let current = { ...scenes[0] }

  for (let i = 1; i < scenes.length; i++) {
    const scene = scenes[i]
    const sceneDuration = scene.end - scene.start

    // 如果下一个场景太短，合并到当前场景
    if (sceneDuration < minDuration) {
      current.end = scene.end
      current.frames = [current.frames[0], scene.frames[1]]
    } else {
      // 下一个场景足够长，保存当前场景（无论长短），开始新场景
      merged.push(current)
      current = { ...scene }
    }
  }

  // 添加最后一个场景
  merged.push(current)

  // 如果第一个场景太短，合并到第二个
  if (merged.length > 1 && merged[0].end - merged[0].start < minDuration) {
    const first = merged.shift()!
    merged[0].start = first.start
    merged[0].frames = [first.frames[0], merged[0].frames[1]]
  }

  return merged
}

/**
 * 过滤掉过短的场景
 *
 * @param scenes 原始场景列表
 * @param minDuration 最小场景时长（秒）
 * @returns 过滤后的场景列表
 */
export function filterShortScenes(
  scenes: SceneSegment[],
  minDuration: number = 5
): SceneSegment[] {
  return scenes.filter((scene) => scene.end - scene.start >= minDuration)
}
