/**
 * Node Segmentation V1 - Main Entry Point
 *
 * V1 Pipeline:
 * 1. Convert subtitle cues to sentences
 * 2. Generate candidate boundaries with multi-signal scoring
 * 3. LLM adjudicates candidates (per chunk)
 * 4. Apply merge/split for duration constraints
 * 5. Validate quality and auto-fix where possible
 *
 * Key improvements over V0:
 * - Multi-signal boundary detection (pause, markers, semantic drift, structure)
 * - LLM only adjudicates candidates, doesn't guess from scratch
 * - Duration constraints ensure reasonable node lengths
 * - Quality validation catches common issues
 */

// Re-export types
export * from './types'
export * from './constants'

// Re-export modules
export {
  cuesToSentences,
  generateCandidateBoundaries,
  filterTopCandidates,
  getCandidatesInRange,
} from './candidate-boundaries'

export {
  chunkSentences,
  adjudicateBoundaries,
} from './llm-adjudicator'

export {
  applyDurationConstraints,
  addOverlap,
  logDurationStats,
} from './merge-split'

export {
  validateNode,
  validateAllNodes,
  applyAutoFixes,
  generateValidationReport,
} from './quality-validator'

// Main pipeline imports
import type {
  SubtitleCue,
  Sentence,
  NodeBoundary,
  SegmentationProgressCallback,
  SegmentationResult,
} from './types'
import { MIN_CANDIDATE_GAP } from './constants'
import { cuesToSentences, generateCandidateBoundaries, filterTopCandidates } from './candidate-boundaries'
import { adjudicateBoundaries } from './llm-adjudicator'
import { applyDurationConstraints, addOverlap, logDurationStats } from './merge-split'
import { validateAllNodes, applyAutoFixes } from './quality-validator'

/**
 * V1 Node Segmentation Pipeline
 *
 * This is the main function that replaces the V0 segmentIntoNodes().
 *
 * Steps:
 * 1. Convert subtitle cues to sentences (with IDs)
 * 2. Generate candidate boundaries using multi-signal scoring
 * 3. Filter to top candidates to avoid over-segmentation
 * 4. LLM adjudicates candidates (confirms or rejects)
 * 5. Apply merge/split to ensure duration constraints
 * 6. Add overlap for context continuity
 * 7. Validate quality and auto-fix where possible
 *
 * @param subtitles - Array of subtitle cues from ASR
 * @param videoDuration - Total video duration in seconds
 * @param onProgress - Optional progress callback
 * @returns Segmentation result with boundaries and review list
 */
export async function segmentVideoNodesV1(
  subtitles: SubtitleCue[],
  videoDuration: number,
  onProgress?: SegmentationProgressCallback
): Promise<SegmentationResult> {
  const updateProgress = (stage: string, progress: number, message: string) => {
    onProgress?.(stage, progress, message)
    console.log(`[V1 Segmentation] ${stage}: ${progress}% - ${message}`)
  }

  // Step 1: Convert to sentences with IDs
  updateProgress('preprocessing', 5, '转换字幕为句子序列...')
  const sentences = cuesToSentences(subtitles)
  console.log(`[V1 Segmentation] Generated ${sentences.length} sentences from ${subtitles.length} subtitle cues`)

  if (sentences.length === 0) {
    console.warn('[V1 Segmentation] No sentences found, returning single node')
    return {
      boundaries: [{
        order: 1,
        startTime: 0,
        endTime: videoDuration,
        boundaryReason: '无字幕内容',
        boundaryConfidence: 0.1,
        boundarySignals: ['empty_subtitles'],
      }],
      sentences: [],
      needsReview: [1],
    }
  }

  // Step 2: Generate candidate boundaries with multi-signal scoring
  updateProgress('candidates', 10, '生成候选边界（多信号打分）...')

  const allCandidates = await generateCandidateBoundaries(sentences, {
    enableSemanticDrift: true,
    semanticBatchSize: 20,
  })

  updateProgress('candidates', 30, `发现 ${allCandidates.length} 个候选边界`)

  // Step 3: Filter to top candidates to avoid over-segmentation
  const filteredCandidates = filterTopCandidates(allCandidates, MIN_CANDIDATE_GAP)
  console.log(`[V1 Segmentation] Filtered to ${filteredCandidates.length} top candidates (min gap: ${MIN_CANDIDATE_GAP}s)`)

  // Step 4: LLM adjudication
  updateProgress('adjudication', 40, 'LLM 裁决候选边界...')

  const rawBoundaries = await adjudicateBoundaries(
    sentences,
    filteredCandidates,
    videoDuration
  )

  updateProgress('adjudication', 60, `LLM 确认 ${rawBoundaries.length} 个边界`)

  // Step 5: Apply duration constraints (merge short, split long)
  updateProgress('constraints', 65, '应用时长约束（合并/拆分）...')

  const constrainedBoundaries = applyDurationConstraints(
    rawBoundaries,
    sentences,
    filteredCandidates
  )

  // Step 6: Add overlap for context continuity
  const overlappedBoundaries = addOverlap(constrainedBoundaries)

  updateProgress('constraints', 75, `调整后 ${overlappedBoundaries.length} 个节点`)

  // Log duration statistics
  logDurationStats(overlappedBoundaries)

  // Step 7: Quality validation
  updateProgress('validation', 80, '质量校验...')

  const { results, needsReview, autoFixed, passed } = validateAllNodes(
    overlappedBoundaries,
    sentences
  )

  // Apply auto-fixes
  let finalBoundaries = overlappedBoundaries
  if (autoFixed.length > 0) {
    updateProgress('validation', 85, `自动修复 ${autoFixed.length} 个节点`)
    finalBoundaries = applyAutoFixes(overlappedBoundaries, results)
  }

  // Final status message
  if (needsReview.length > 0) {
    updateProgress('validation', 90, `${needsReview.length} 个节点需要人工复核`)
  } else {
    updateProgress('validation', 90, '所有节点通过质量校验')
  }

  updateProgress('complete', 100, `切分完成：${finalBoundaries.length} 个节点`)

  return {
    boundaries: finalBoundaries,
    sentences,
    needsReview,
  }
}

/**
 * Options for V1 segmentation (future extension)
 */
export interface SegmentationV1Options {
  enableSemanticDrift?: boolean
  minCandidateGap?: number
  enableAutoFix?: boolean
  targetDurationMin?: number
  targetDurationMax?: number
}

/**
 * Extended segmentation with options (for future use)
 */
export async function segmentVideoNodesV1Extended(
  subtitles: SubtitleCue[],
  videoDuration: number,
  options?: SegmentationV1Options,
  onProgress?: SegmentationProgressCallback
): Promise<SegmentationResult> {
  // For now, just call the main function
  // Options can be implemented later for fine-tuning
  return segmentVideoNodesV1(subtitles, videoDuration, onProgress)
}
