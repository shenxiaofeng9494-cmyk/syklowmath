/**
 * Node Segmentation V2 - 简化版节点切分
 *
 * 核心思路：让强模型直接分析全文，输出节点结构
 * 然后根据节点描述定位时间戳
 *
 * 相比 V1 的优势：
 * - 无需复杂的信号计算和 embedding
 * - LLM 看到全局，切分更合理
 * - 代码简单，结果稳定
 */

import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// 使用强模型
const MODEL = 'gpt-4o'

export interface SubtitleCue {
  start: number
  end: number
  text: string
}

export interface NodeSegment {
  order: number
  startTime: number
  endTime: number
  title: string
  description: string
  keyConcepts: string[]  // 关键概念
  nodeType: 'intro' | 'concept' | 'example' | 'pitfall' | 'summary' | 'other'
}

export interface SegmentationResult {
  nodes: NodeSegment[]
  rawAnalysis: LLMAnalysisResult
}

interface LLMNodeAnalysis {
  title: string
  description: string
  keyConcepts: string[]  // 关键概念（用于检索）
  nodeType: 'intro' | 'concept' | 'example' | 'pitfall' | 'summary' | 'other'
  startText: string  // 节点开始的文字（用于定位）
  endText: string    // 节点结束的文字（用于定位）
}

interface LLMAnalysisResult {
  videoSummary: string
  nodes: LLMNodeAnalysis[]
}

/**
 * 构建分析 prompt
 */
function buildAnalysisPrompt(fullText: string): string {
  return `你是初中数学教学视频分析专家。请仔细阅读以下视频字幕全文，将其切分成知识点节点。

## 切分原则
1. **按教学逻辑切分**：每个节点应该是一个相对完整的教学单元
2. **节点类型包括**：
   - intro: 引入/背景介绍
   - concept: 概念讲解/定义说明
   - example: 例题演示/练习
   - pitfall: 易错点分析/注意事项
   - summary: 总结/回顾
   - other: 其他
3. **不要机械地按时长切分**：根据内容的逻辑完整性来划分，一个节点可长可短
4. **保持语义完整**：不要把一句话切成两半

## 字幕全文
${fullText}

## 输出要求
请输出 JSON 格式（不要包含 markdown 代码块）：
{
  "videoSummary": "这个视频主要讲了...",
  "nodes": [
    {
      "title": "节点标题（具体、有信息量，如：用长方形面积问题引出一元二次方程）",
      "description": "这个节点讲了什么（一句话概括核心内容）",
      "keyConcepts": ["关键概念1", "关键概念2", "关键概念3"],
      "nodeType": "concept",
      "startText": "节点开头的几个字（用于定位，10-20字）",
      "endText": "节点结尾的几个字（用于定位，10-20字）"
    }
  ]
}

## 重要提示
- **title 要具体有信息量**，不要用泛泛的"概念讲解"、"例题演示"，而是写清楚讲的是什么具体内容
- **keyConcepts 必须填写 2-5 个数学术语**，用于后续检索匹配
- startText 和 endText 必须是字幕中真实存在的文字片段
- 确保相邻节点的内容是连续的，不要有遗漏
- 第一个节点的 startText 应该是视频开头
- 最后一个节点的 endText 应该是视频结尾`
}

/**
 * 在字幕中查找文字对应的时间
 * 使用模糊匹配，找到最佳匹配位置
 */
function findTimeForText(
  subtitles: SubtitleCue[],
  searchText: string,
  searchFrom: number = 0,
  preferStart: boolean = true
): { time: number; index: number } | null {
  const normalizedSearch = searchText.replace(/\s+/g, '')

  // 构建完整的字幕文本用于搜索
  let fullText = ''
  const positions: { index: number; charStart: number; charEnd: number }[] = []

  for (let i = 0; i < subtitles.length; i++) {
    const sub = subtitles[i]
    if (sub.end < searchFrom) continue

    const charStart = fullText.length
    fullText += sub.text.replace(/\s+/g, '')
    const charEnd = fullText.length

    positions.push({ index: i, charStart, charEnd })
  }

  // 查找搜索文本在完整文本中的位置
  const searchPos = fullText.indexOf(normalizedSearch)
  if (searchPos === -1) {
    // 尝试部分匹配（取前 10 个字符）
    const partialSearch = normalizedSearch.slice(0, 10)
    const partialPos = fullText.indexOf(partialSearch)
    if (partialPos === -1) {
      console.warn(`[V2 Segmentation] 未找到文本: "${searchText.slice(0, 20)}..."`)
      return null
    }

    // 找到对应的字幕
    for (const pos of positions) {
      if (partialPos >= pos.charStart && partialPos < pos.charEnd) {
        return {
          time: preferStart ? subtitles[pos.index].start : subtitles[pos.index].end,
          index: pos.index,
        }
      }
    }
  }

  // 找到对应的字幕
  const targetPos = preferStart ? searchPos : searchPos + normalizedSearch.length - 1
  for (const pos of positions) {
    if (targetPos >= pos.charStart && targetPos < pos.charEnd) {
      return {
        time: preferStart ? subtitles[pos.index].start : subtitles[pos.index].end,
        index: pos.index,
      }
    }
  }

  return null
}

/**
 * V2 节点切分主函数
 */
export async function segmentVideoNodesV2(
  subtitles: SubtitleCue[],
  videoDuration: number,
  onProgress?: (stage: string, progress: number, message: string) => void
): Promise<SegmentationResult> {
  const updateProgress = (stage: string, progress: number, message: string) => {
    onProgress?.(stage, progress, message)
    console.log(`[V2 Segmentation] ${stage}: ${progress}% - ${message}`)
  }

  updateProgress('init', 0, '开始分析视频内容...')

  // Step 1: 构建全文
  const fullText = subtitles.map(s => s.text).join('')
  console.log(`[V2 Segmentation] 全文长度: ${fullText.length} 字符`)

  // Step 2: 调用 LLM 分析
  updateProgress('analysis', 20, `正在使用 ${MODEL} 分析视频结构...`)

  const prompt = buildAnalysisPrompt(fullText)

  const response = await openai.chat.completions.create({
    model: MODEL,
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
    temperature: 0.3,  // 低温度，结果更稳定
  })

  const content = response.choices[0].message.content
  if (!content) {
    throw new Error('LLM 返回空内容')
  }

  let analysis: LLMAnalysisResult
  try {
    analysis = JSON.parse(content) as LLMAnalysisResult
  } catch (e) {
    console.error('[V2 Segmentation] JSON 解析失败:', content)
    throw new Error(`JSON 解析失败: ${e}`)
  }

  console.log(`[V2 Segmentation] LLM 分析完成: ${analysis.nodes.length} 个节点`)
  console.log(`[V2 Segmentation] 视频摘要: ${analysis.videoSummary}`)

  updateProgress('locating', 60, `正在定位 ${analysis.nodes.length} 个节点的时间戳...`)

  // Step 3: 定位每个节点的时间戳
  const nodes: NodeSegment[] = []
  let lastEndIndex = 0

  for (let i = 0; i < analysis.nodes.length; i++) {
    const nodeAnalysis = analysis.nodes[i]

    // 查找开始时间
    const startResult = findTimeForText(
      subtitles,
      nodeAnalysis.startText,
      i === 0 ? 0 : subtitles[lastEndIndex]?.start || 0,
      true
    )

    // 查找结束时间
    const endResult = findTimeForText(
      subtitles,
      nodeAnalysis.endText,
      startResult?.index || lastEndIndex,
      false
    )

    let startTime: number
    let endTime: number

    if (startResult) {
      startTime = startResult.time
    } else if (nodes.length > 0) {
      // 使用上一个节点的结束时间
      startTime = nodes[nodes.length - 1].endTime
    } else {
      startTime = 0
    }

    if (endResult) {
      endTime = endResult.time
      lastEndIndex = endResult.index
    } else if (i === analysis.nodes.length - 1) {
      // 最后一个节点，使用视频结束时间
      endTime = videoDuration
    } else {
      // 估算：平均分配剩余时间
      const remainingNodes = analysis.nodes.length - i
      const remainingTime = videoDuration - startTime
      endTime = startTime + remainingTime / remainingNodes
    }

    // 确保时间有效
    if (endTime <= startTime) {
      endTime = startTime + 10  // 至少 10 秒
    }

    nodes.push({
      order: i + 1,
      startTime,
      endTime,
      title: nodeAnalysis.title,
      description: nodeAnalysis.description,
      keyConcepts: nodeAnalysis.keyConcepts || [],
      nodeType: nodeAnalysis.nodeType,
    })

    console.log(`[V2 Segmentation] 节点 ${i + 1}: ${formatTime(startTime)}-${formatTime(endTime)} "${nodeAnalysis.title}"`)
  }

  // Step 4: 按开始时间排序
  nodes.sort((a, b) => a.startTime - b.startTime)

  // Step 5: 修正时间连续性（确保相邻节点无缝衔接，无重叠）
  for (let i = 0; i < nodes.length; i++) {
    // 确保 endTime > startTime
    if (nodes[i].endTime <= nodes[i].startTime) {
      nodes[i].endTime = nodes[i].startTime + 30  // 至少 30 秒
    }

    // 确保不与下一个节点重叠
    if (i < nodes.length - 1) {
      if (nodes[i].endTime > nodes[i + 1].startTime) {
        // 取中间值
        const midTime = (nodes[i].startTime + nodes[i + 1].startTime) / 2
        nodes[i].endTime = midTime
      }
      // 确保下一个节点从当前节点结束开始
      nodes[i + 1].startTime = nodes[i].endTime
    }
  }

  // 重新编号
  nodes.forEach((node, index) => {
    node.order = index + 1
  })

  // 确保第一个节点从 0 开始
  if (nodes.length > 0 && nodes[0].startTime > 2) {
    nodes[0].startTime = 0
  }

  // 确保最后一个节点到视频结束
  if (nodes.length > 0) {
    const lastNode = nodes[nodes.length - 1]
    if (videoDuration - lastNode.endTime > 2) {
      lastNode.endTime = videoDuration
    }
  }

  updateProgress('complete', 100, `切分完成：${nodes.length} 个节点`)

  // 输出统计
  logNodeStats(nodes)

  return {
    nodes,
    rawAnalysis: analysis,
  }
}

/**
 * 格式化时间为 MM:SS
 */
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

/**
 * 输出节点统计信息
 */
function logNodeStats(nodes: NodeSegment[]): void {
  if (nodes.length === 0) return

  const durations = nodes.map(n => n.endTime - n.startTime)
  const min = Math.min(...durations)
  const max = Math.max(...durations)
  const avg = durations.reduce((a, b) => a + b, 0) / durations.length

  const typeCounts: Record<string, number> = {}
  for (const node of nodes) {
    typeCounts[node.nodeType] = (typeCounts[node.nodeType] || 0) + 1
  }

  console.log(`[V2 Segmentation] 统计:`)
  console.log(`  - 节点数: ${nodes.length}`)
  console.log(`  - 时长: 最短 ${min.toFixed(0)}s, 最长 ${max.toFixed(0)}s, 平均 ${avg.toFixed(0)}s`)
  console.log(`  - 类型分布: ${Object.entries(typeCounts).map(([k, v]) => `${k}:${v}`).join(', ')}`)
}
