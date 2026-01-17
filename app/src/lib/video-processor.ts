import { supabase } from './supabase'
import { generateDocumentEmbedding } from './embedding'
import { segmentVideoNodesV2 } from './node-segmentation-v2'
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
 * 完整的视频预处理 Pipeline (V2)
 *
 * V2 简化版：
 * - 直接让强模型 (GPT-4o) 分析全文
 * - 输出节点结构，定位时间戳
 * - 不需要复杂的信号计算
 */
export async function processVideo(
  videoId: string,
  title: string,
  description: string,
  videoUrl: string,
  duration: number,
  subtitles: SubtitleCue[],
  teacher?: string,
  onProgress?: ProgressCallback
): Promise<{ success: boolean; nodeCount: number; error?: string }> {
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

    // Step 2: V2 节点切分（GPT-4o 直接分析全文）
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

    // Step 3: 删除旧的节点数据
    updateProgress('cleanup', 55, '清理旧数据...')

    await supabase.from('video_nodes').delete().eq('video_id', videoId)

    // Step 4: 处理每个节点（提取关键概念 + 向量化）
    const nodes: VideoNodeInsert[] = []
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

    // Step 5: 批量插入节点
    updateProgress('saving', 92, '正在保存节点数据...')

    const { error: nodesError } = await supabase.from('video_nodes').insert(nodes)

    if (nodesError) {
      throw new Error(`保存节点失败: ${nodesError.message}`)
    }

    // Step 6: 更新视频状态
    updateProgress('finalizing', 97, '更新视频状态...')

    await supabase.from('videos').update({
      status: 'ready',
      node_count: nodes.length,
      processed_at: new Date().toISOString(),
    }).eq('id', videoId)

    updateProgress('complete', 100, `处理完成！共生成 ${nodes.length} 个知识点节点`)

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
