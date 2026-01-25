import { supabase } from './supabase'
import { generateDocumentEmbedding } from './embedding'
import { segmentVideoNodesV2 } from './node-segmentation-v2'
import {
  waitForSceneSegmentationByVid,
  isVolcengineConfigured,
} from './volcengine-scene-segmentation'
import {
  waitForUpload,
  isVolcengineUploadConfigured,
} from './volcengine-upload'
import {
  convertScenesToNodes,
  mergeShortScenes,
} from './volcengine-node-converter'
import type { VideoNodeInsert } from '@/types/database'

interface SubtitleCue {
  start: number
  end: number
  text: string
}

interface ProcessingProgress {
  stage: string
  progress: number
  message: string
}

type ProgressCallback = (progress: ProcessingProgress) => void

/**
 * 切分方法类型
 * - gpt: 使用 GPT-4o 语义分析（默认）
 * - volcengine: 使用火山引擎视觉场景切分
 */
export type SegmentationMethod = 'gpt' | 'volcengine'

/**
 * 根据时间范围提取字幕文本
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
 * 完整的视频预处理 Pipeline (V2/V3)
 *
 * V2 (GPT): 直接让强模型 (GPT-4o) 分析全文，输出节点结构
 * V3 (Volcengine): 使用火山引擎视觉场景切分
 */
export async function processVideo(
  videoId: string,
  title: string,
  description: string,
  videoUrl: string,
  duration: number,
  subtitles: SubtitleCue[],
  teacher?: string,
  onProgress?: ProgressCallback,
  options?: {
    segmentationMethod?: SegmentationMethod
    minSceneDuration?: number
  }
): Promise<{ success: boolean; nodeCount: number; error?: string }> {
  const segmentationMethod = options?.segmentationMethod ?? 'gpt'
  const minSceneDuration = options?.minSceneDuration ?? 10

  try {
    // 更新进度的辅助函数
    const updateProgress = (stage: string, progress: number, message: string) => {
      onProgress?.({ stage, progress, message })
      console.log(`[VideoProcessor] ${stage}: ${progress}% - ${message}`)
    }

    updateProgress('init', 0, '开始处理视频...')

    // Step 1: 在数据库中创建或更新视频记录
    updateProgress('database', 5, '创建视频记录...')

    const { error: videoError } = await supabase.from('videos').upsert({
      id: videoId,
      title,
      description,
      video_url: videoUrl,
      duration: Math.round(duration),
      teacher: teacher || null,
      status: 'processing',
      node_count: 0,
    })

    if (videoError) {
      throw new Error(`创建视频记录失败: ${videoError.message}`)
    }

    // Step 2: 节点切分（根据方法选择）
    let nodes: VideoNodeInsert[] = []

    if (segmentationMethod === 'volcengine') {
      // V3: 火山引擎视觉场景切分
      if (!isVolcengineConfigured()) {
        throw new Error('火山引擎未配置，请设置 VOLCENGINE_ACCESS_KEY_ID 和 VOLCENGINE_ACCESS_KEY_SECRET')
      }

      if (!isVolcengineUploadConfigured()) {
        throw new Error('火山引擎 VOD 空间未配置，请设置 VOLCENGINE_VOD_SPACE_NAME 环境变量')
      }

      // Step 2a: 先上传视频到火山引擎获取 Vid
      updateProgress('upload', 10, '正在上传视频到火山引擎...')

      const vid = await waitForUpload(videoUrl, {
        title: title,
        onProgress: (state, message) => {
          const progressMap: Record<string, number> = {
            initial: 12,
            processing: 18,
            success: 25,
          }
          updateProgress('upload', progressMap[state] || 15, message || `上传${state}...`)
        },
      })

      console.log(`[VideoProcessor] 视频上传完成, Vid: ${vid}`)

      // Step 2b: 使用 Vid 进行场景切分
      updateProgress('segmentation', 28, '正在使用火山引擎进行视觉场景切分...')

      let scenes = await waitForSceneSegmentationByVid(vid, {
        onProgress: (status, message) => {
          const progressMap: Record<string, number> = {
            submitting: 30,
            waiting: 33,
            pending: 36,
            running: 42,
            success: 50,
          }
          updateProgress('segmentation', progressMap[status] || 38, message || `场景切分${status}...`)
        },
      })

      console.log(`[VideoProcessor] 火山引擎原始切分: ${scenes.length} 个场景`)

      // 合并短场景
      if (minSceneDuration > 0) {
        scenes = mergeShortScenes(scenes, minSceneDuration)
        console.log(`[VideoProcessor] 合并后: ${scenes.length} 个场景`)
      }

      updateProgress('segmentation', 50, `场景切分完成，共 ${scenes.length} 个场景`)

      // 转换为节点格式
      const nodeDataList = convertScenesToNodes(videoId, scenes, subtitles)

      // 删除旧节点
      updateProgress('cleanup', 55, '清理旧数据...')
      await supabase.from('video_nodes').delete().eq('video_id', videoId)

      // 生成向量
      const totalNodes = nodeDataList.length
      for (let i = 0; i < nodeDataList.length; i++) {
        const nodeData = nodeDataList[i]
        const progressPercent = 60 + Math.round((i / totalNodes) * 30)

        updateProgress(
          'processing',
          progressPercent,
          `正在处理节点 ${i + 1}/${totalNodes}: ${nodeData.title}...`
        )

        const embedding = await generateDocumentEmbedding(
          nodeData.summary,
          nodeData.key_concepts || []
        )

        nodes.push({
          ...nodeData,
          embedding,
        })
      }
    } else {
      // V2: GPT-4o 语义分析（默认）
      updateProgress('segmentation', 10, '正在使用 GPT-4o 分析视频结构...')

      const { nodes: segmentedNodes, rawAnalysis } = await segmentVideoNodesV2(
        subtitles,
        duration,
        (stage, progress, message) => {
          // 将切分进度 (0-100) 映射到整体进度 (10-50)
          const mappedProgress = 10 + Math.round((progress / 100) * 40)
          updateProgress(stage, mappedProgress, message)
        }
      )

      console.log(`[VideoProcessor] V2 切分完成: ${segmentedNodes.length} 个节点`)
      console.log(`[VideoProcessor] 视频摘要: ${rawAnalysis.videoSummary}`)

      // 删除旧的节点数据
      updateProgress('cleanup', 55, '清理旧数据...')
      await supabase.from('video_nodes').delete().eq('video_id', videoId)

      // 处理每个节点（提取关键概念 + 向量化）
      const totalNodes = segmentedNodes.length

      for (let i = 0; i < segmentedNodes.length; i++) {
        const segment = segmentedNodes[i]
        const progressPercent = 60 + Math.round((i / totalNodes) * 30)

        updateProgress(
          'processing',
          progressPercent,
          `正在处理节点 ${i + 1}/${totalNodes}: ${segment.title}...`
        )

        // 提取该节点的字幕文本
        const transcript = extractTranscript(subtitles, segment.startTime, segment.endTime)

        // 使用 LLM 分析得到的关键概念
        const keyConcepts = segment.keyConcepts || []

        // 生成向量（用于语义检索）
        const embedding = await generateDocumentEmbedding(segment.description, keyConcepts)

        // 构建节点数据
        nodes.push({
          id: `node-${videoId}-${segment.order}`,
          video_id: videoId,
          order: segment.order,
          start_time: Math.round(segment.startTime),
          end_time: Math.round(segment.endTime),
          title: segment.title,
          summary: segment.description,
          key_concepts: keyConcepts,
          transcript,
          embedding,
          // V2 字段
          boundary_confidence: 0.9,  // V2 由强模型直接分析，置信度高
          boundary_signals: ['llm_analysis'],
          boundary_reason: segment.description,
          node_type: segment.nodeType as 'concept' | 'method' | 'example' | 'summary' | 'transition' | null,
          version: 2,
          created_by: 'auto',
        })
      }
    }

    // Step 3: 批量插入节点
    updateProgress('saving', 92, '正在保存节点数据...')

    const { error: nodesError } = await supabase.from('video_nodes').insert(nodes)

    if (nodesError) {
      throw new Error(`保存节点失败: ${nodesError.message}`)
    }

    // Step 4: 更新视频状态
    updateProgress('finalizing', 97, '更新视频状态...')

    const methodLabel = segmentationMethod === 'volcengine' ? '火山引擎视觉切分' : 'GPT-4o 语义分析'
    await supabase.from('videos').update({
      status: 'ready',
      node_count: nodes.length,
      processed_at: new Date().toISOString(),
    }).eq('id', videoId)

    updateProgress('complete', 100, `处理完成！共生成 ${nodes.length} 个知识点节点（${methodLabel}）`)

    return {
      success: true,
      nodeCount: nodes.length,
    }
  } catch (error) {
    console.error('[VideoProcessor] 视频处理失败:', error)

    // 更新视频状态为错误
    await supabase.from('videos').update({
      status: 'error',
    }).eq('id', videoId)

    return {
      success: false,
      nodeCount: 0,
      error: error instanceof Error ? error.message : '未知错误',
    }
  }
}

/**
 * 获取视频处理状态
 */
export async function getVideoProcessingStatus(videoId: string) {
  const { data, error } = await supabase
    .from('videos')
    .select('id, title, status, node_count, processed_at')
    .eq('id', videoId)
    .single()

  if (error) {
    return null
  }

  return data
}
