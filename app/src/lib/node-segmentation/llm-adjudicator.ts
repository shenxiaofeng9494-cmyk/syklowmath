/**
 * Node Segmentation V1 - LLM Boundary Adjudication
 *
 * The LLM's role changes from "guessing boundaries from scratch"
 * to "adjudicating candidate boundaries" - confirm or reject.
 *
 * This makes the output more stable and consistent.
 */

import OpenAI from 'openai'
import type {
  Sentence,
  CandidateBoundary,
  NodeBoundary,
  ChunkAdjudicationResult,
} from './types'
import { LLM_CHUNK_DURATION, DURATION } from './constants'
import { getCandidatesInRange } from './candidate-boundaries'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

/**
 * Format time as MM:SS
 */
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

/**
 * Split sentences into chunks for LLM processing
 * Each chunk is approximately chunkDuration seconds
 */
export function chunkSentences(
  sentences: Sentence[],
  chunkDuration: number = LLM_CHUNK_DURATION
): Sentence[][] {
  const chunks: Sentence[][] = []
  let currentChunk: Sentence[] = []
  let chunkStartTime = 0

  for (const sentence of sentences) {
    // Start new chunk if current one exceeds duration
    if (sentence.start - chunkStartTime > chunkDuration && currentChunk.length > 0) {
      chunks.push(currentChunk)
      currentChunk = []
      chunkStartTime = sentence.start
    }
    currentChunk.push(sentence)
  }

  // Add remaining sentences
  if (currentChunk.length > 0) {
    chunks.push(currentChunk)
  }

  return chunks
}

/**
 * Format sentences for LLM prompt
 */
function formatSentencesForPrompt(sentences: Sentence[]): string {
  return sentences
    .map(s => `[${s.sid}] ${formatTime(s.start)}-${formatTime(s.end)}: ${s.text}`)
    .join('\n')
}

/**
 * Format candidate boundaries for LLM prompt
 */
function formatCandidatesForPrompt(candidates: CandidateBoundary[]): string {
  if (candidates.length === 0) {
    return '(无候选边界 - 请根据内容判断是否需要在此块内切分)'
  }

  return candidates.map(c => {
    const signalStrs = c.signals.map(s => s.details || s.type).join(', ')
    return `- 时间 ${formatTime(c.time)} (${c.betweenSids[0]}/${c.betweenSids[1]}之间), ` +
           `综合分=${c.score.toFixed(2)}, 信号=[${signalStrs}]`
  }).join('\n')
}

/**
 * Build LLM adjudication prompt
 */
function buildAdjudicationPrompt(
  sentences: Sentence[],
  candidates: CandidateBoundary[],
  chunkIndex: number,
  totalChunks: number,
  previousBoundary?: NodeBoundary
): string {
  const chunkStart = sentences[0]?.start || 0
  const chunkEnd = sentences[sentences.length - 1]?.end || 0
  const startOrder = previousBoundary ? previousBoundary.order + 1 : 1
  const startTime = previousBoundary ? previousBoundary.endTime : 0

  return `你是初中数学教学视频节点切分专家。你的任务是审核候选边界，决定哪些应该成为正式的知识点节点边界。

## 当前任务
这是第 ${chunkIndex + 1}/${totalChunks} 块内容，时间范围 ${formatTime(chunkStart)} - ${formatTime(chunkEnd)}。
${previousBoundary ? `上一个确认的边界在 ${formatTime(previousBoundary.endTime)}。` : '这是视频开头。'}

## 知识点节点的定义
一个节点应该是一个语义相对完整的教学片段，时长适中便于学生消化：
- 概念讲解：定义、性质、特点（可以拆成多个小节点）
- 例题演示：一道例题的分析和求解
- 易错分析：易错点说明
- 总结过渡：知识回顾或引入下一部分

## 节点时长约束（重要！）
- **理想时长：${DURATION.TARGET_MIN}-${DURATION.TARGET_MAX} 秒（45-90秒）**
- 合并阈值：< ${DURATION.MERGE_THRESHOLD} 秒才需要合并
- **如果一段内容超过 ${DURATION.SPLIT_THRESHOLD} 秒，必须拆分！**
- 倾向于切分得更细一些，让学生更容易定位和回顾

## 字幕内容
${formatSentencesForPrompt(sentences)}

## 候选边界（由信号算法生成）
${formatCandidatesForPrompt(candidates)}

## 你的任务
1. **积极审核**：如果候选边界的分数 >= 0.35 且语义上合理，应该确认
2. **不要过于保守**：宁可切细一点，也不要让单个节点太长
3. 判断每个节点的类型（concept/method/example/summary/transition）
4. 每个节点都需要有一个清晰的 boundaryReason 说明这个节点讲了什么

## 输出格式
请输出 JSON（不要包含 markdown 代码块）：
{
  "decisions": [
    {
      "candidateTime": 95.5,
      "confirmed": true,
      "reason": "从概念讲解转换到例题演示"
    }
  ],
  "nodeBoundaries": [
    {
      "order": ${startOrder},
      "startTime": ${startTime},
      "endTime": 95.5,
      "boundaryReason": "概念讲解：介绍了一元二次方程的定义和标准形式",
      "boundaryConfidence": 0.85,
      "boundarySignals": ["pause>1.2s", "marker:接下来", "semantic_drop"],
      "nodeType": "concept"
    }
  ]
}

注意：
- nodeBoundaries 中的 order 从 ${startOrder} 开始递增
- startTime 应该从 ${startTime.toFixed(1)} 开始
- **如果本块内有多个候选边界都合理，可以全部确认**
- boundarySignals 从候选边界的 signals 中提取
- nodeType 可选值：concept（概念）、method（方法）、example（例题）、summary（总结）、transition（过渡）`
}

/**
 * Adjudicate a single chunk of sentences
 */
async function adjudicateChunk(
  sentences: Sentence[],
  candidates: CandidateBoundary[],
  chunkIndex: number,
  totalChunks: number,
  previousBoundary?: NodeBoundary
): Promise<ChunkAdjudicationResult> {
  const prompt = buildAdjudicationPrompt(
    sentences,
    candidates,
    chunkIndex,
    totalChunks,
    previousBoundary
  )

  console.log(`[LLM Adjudicator] Processing chunk ${chunkIndex + 1}/${totalChunks}...`)

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
  })

  const content = response.choices[0].message.content
  if (!content) {
    throw new Error('LLM returned empty content')
  }

  try {
    const result = JSON.parse(content) as ChunkAdjudicationResult

    // Ensure nodeBoundaries is an array
    if (!Array.isArray(result.nodeBoundaries)) {
      result.nodeBoundaries = []
    }

    // Ensure decisions is an array
    if (!Array.isArray(result.decisions)) {
      result.decisions = []
    }

    console.log(`[LLM Adjudicator] Chunk ${chunkIndex + 1}: ${result.nodeBoundaries.length} nodes confirmed`)

    return result
  } catch (e) {
    console.error('[LLM Adjudicator] Failed to parse response:', content)
    throw new Error(`Failed to parse LLM response: ${e}`)
  }
}

/**
 * Main adjudication function - processes all chunks sequentially
 *
 * @param sentences All sentences from the video
 * @param candidates All candidate boundaries (pre-filtered)
 * @param videoDuration Total video duration in seconds
 * @returns Array of confirmed node boundaries
 */
export async function adjudicateBoundaries(
  sentences: Sentence[],
  candidates: CandidateBoundary[],
  videoDuration: number
): Promise<NodeBoundary[]> {
  // Split into chunks
  const chunks = chunkSentences(sentences)
  const allBoundaries: NodeBoundary[] = []
  let lastBoundary: NodeBoundary | undefined

  console.log(`[LLM Adjudicator] Processing ${chunks.length} chunks...`)

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]
    const chunkStart = chunk[0]?.start || 0
    const chunkEnd = chunk[chunk.length - 1]?.end || 0

    // Get candidates for this chunk
    const chunkCandidates = getCandidatesInRange(candidates, chunkStart, chunkEnd)

    // Adjudicate
    const result = await adjudicateChunk(
      chunk,
      chunkCandidates,
      i,
      chunks.length,
      lastBoundary
    )

    // Collect boundaries
    for (const boundary of result.nodeBoundaries) {
      // Validate boundary has required fields
      if (typeof boundary.order === 'number' &&
          typeof boundary.startTime === 'number' &&
          typeof boundary.endTime === 'number') {

        // Set defaults for missing fields
        const normalizedBoundary: NodeBoundary = {
          order: boundary.order,
          startTime: boundary.startTime,
          endTime: boundary.endTime,
          boundaryReason: boundary.boundaryReason || '',
          boundaryConfidence: boundary.boundaryConfidence || 0.5,
          boundarySignals: boundary.boundarySignals || [],
          nodeType: boundary.nodeType,
        }

        allBoundaries.push(normalizedBoundary)
        lastBoundary = normalizedBoundary
      }
    }
  }

  // Ensure the last boundary extends to video end
  if (allBoundaries.length > 0) {
    const lastIdx = allBoundaries.length - 1
    const gap = videoDuration - allBoundaries[lastIdx].endTime

    // If there's a significant gap, extend or add final node
    if (gap > 5) {
      // Check if we should extend the last node or create a new one
      if (gap < DURATION.MERGE_THRESHOLD) {
        // Small gap - extend last node
        allBoundaries[lastIdx].endTime = videoDuration
      } else {
        // Large gap - add a final node
        allBoundaries.push({
          order: allBoundaries[lastIdx].order + 1,
          startTime: allBoundaries[lastIdx].endTime,
          endTime: videoDuration,
          boundaryReason: '视频结尾部分',
          boundaryConfidence: 0.5,
          boundarySignals: ['video_end'],
          nodeType: 'summary',
        })
      }
    }
  } else {
    // No boundaries found - create single node for entire video
    allBoundaries.push({
      order: 1,
      startTime: 0,
      endTime: videoDuration,
      boundaryReason: '完整视频内容',
      boundaryConfidence: 0.3,
      boundarySignals: ['single_node'],
    })
  }

  console.log(`[LLM Adjudicator] Total ${allBoundaries.length} nodes confirmed`)

  return allBoundaries
}
