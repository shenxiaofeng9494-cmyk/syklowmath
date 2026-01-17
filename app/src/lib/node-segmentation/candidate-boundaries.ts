/**
 * Node Segmentation V1 - Candidate Boundary Generation
 *
 * Multi-signal scoring for boundary candidates:
 * - Signal A: Voice pause duration
 * - Signal B: Discourse markers (transition words)
 * - Signal C: Semantic drift (embedding similarity drop)
 * - Signal D: Educational structure patterns
 */

import { generateEmbedding } from '@/lib/embedding'
import type {
  SubtitleCue,
  Sentence,
  CandidateBoundary,
  BoundarySignal,
} from './types'
import {
  PAUSE_THRESHOLDS,
  SIGNAL_WEIGHTS,
  CANDIDATE_THRESHOLD,
  SEMANTIC,
  DISCOURSE_MARKERS,
  STRUCTURE_PATTERNS,
  MIN_CANDIDATE_GAP,
  EMBEDDING_BATCH_SIZE,
} from './constants'

/**
 * Convert SubtitleCues to Sentences with IDs
 */
export function cuesToSentences(cues: SubtitleCue[]): Sentence[] {
  return cues.map((cue, index) => ({
    sid: `s-${String(index + 1).padStart(3, '0')}`,
    start: cue.start,
    end: cue.end,
    text: cue.text.trim(),
  }))
}

/**
 * Calculate pause score between two sentences
 * Returns 0-1 score based on pause duration
 */
function scorePause(pause: number): number {
  if (pause >= PAUSE_THRESHOLDS.STRONG) {
    return 1.0
  } else if (pause >= PAUSE_THRESHOLDS.MEDIUM) {
    // Linear interpolation between 0.5 and 1.0
    return 0.5 + 0.5 * (pause - PAUSE_THRESHOLDS.MEDIUM) /
           (PAUSE_THRESHOLDS.STRONG - PAUSE_THRESHOLDS.MEDIUM)
  } else if (pause >= PAUSE_THRESHOLDS.WEAK) {
    // Linear interpolation between 0.2 and 0.5
    return 0.2 + 0.3 * (pause - PAUSE_THRESHOLDS.WEAK) /
           (PAUSE_THRESHOLDS.MEDIUM - PAUSE_THRESHOLDS.WEAK)
  }
  return 0.1
}

/**
 * Check for discourse markers in text
 * Returns marker info if found
 */
function detectMarkers(text: string): { hit: boolean; marker?: string; type?: string } {
  for (const [type, markers] of Object.entries(DISCOURSE_MARKERS)) {
    for (const marker of markers) {
      // Check if text starts with marker (most indicative)
      if (text.startsWith(marker)) {
        return { hit: true, marker, type }
      }
    }
  }
  return { hit: false }
}

/**
 * Check for structural patterns (题号, 已知, 解, etc.)
 */
function detectStructure(text: string): { hit: boolean; pattern?: string } {
  for (const pattern of STRUCTURE_PATTERNS) {
    if (pattern.test(text)) {
      return { hit: true, pattern: pattern.source }
    }
  }
  return { hit: false }
}

/**
 * Calculate cosine similarity between two embeddings
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0

  let dotProduct = 0
  let normA = 0
  let normB = 0

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB)
  if (denominator === 0) return 0

  return dotProduct / denominator
}

/**
 * Aggregate text from a window of sentences
 */
function aggregateWindow(
  sentences: Sentence[],
  centerIndex: number,
  direction: 'prev' | 'next',
  windowSize: number
): string {
  const texts: string[] = []

  if (direction === 'prev') {
    const start = Math.max(0, centerIndex - windowSize + 1)
    for (let i = start; i <= centerIndex; i++) {
      texts.push(sentences[i].text)
    }
  } else {
    const end = Math.min(sentences.length - 1, centerIndex + windowSize)
    for (let i = centerIndex + 1; i <= end; i++) {
      texts.push(sentences[i].text)
    }
  }

  return texts.join(' ')
}

/**
 * Generate embeddings in batches to avoid rate limits
 */
async function batchGenerateEmbeddings(
  texts: string[],
  batchSize: number = EMBEDDING_BATCH_SIZE
): Promise<number[][]> {
  const results: number[][] = []

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize)
    const batchResults = await Promise.all(
      batch.map(text => generateEmbedding(text))
    )
    results.push(...batchResults)
  }

  return results
}

/**
 * Options for candidate boundary generation
 */
export interface CandidateBoundaryOptions {
  enableSemanticDrift?: boolean  // Default: true
  semanticBatchSize?: number     // Default: 20
  onProgress?: (current: number, total: number) => void
}

/**
 * Generate candidate boundaries with multi-signal scoring
 *
 * This is the core function that identifies potential node boundaries
 * by combining multiple signals (pause, markers, semantic drift, structure)
 */
export async function generateCandidateBoundaries(
  sentences: Sentence[],
  options?: CandidateBoundaryOptions
): Promise<CandidateBoundary[]> {
  const {
    enableSemanticDrift = true,
    semanticBatchSize = EMBEDDING_BATCH_SIZE,
    onProgress,
  } = options || {}

  const candidates: CandidateBoundary[] = []

  // Pre-compute window texts for semantic drift
  const windowTexts: { index: number; prevText: string; nextText: string }[] = []

  if (enableSemanticDrift) {
    for (let i = 0; i < sentences.length - 1; i++) {
      const prevText = aggregateWindow(sentences, i, 'prev', SEMANTIC.WINDOW_SIZE)
      const nextText = aggregateWindow(sentences, i, 'next', SEMANTIC.WINDOW_SIZE)
      if (prevText && nextText) {
        windowTexts.push({ index: i, prevText, nextText })
      }
    }
  }

  // Batch generate embeddings for semantic drift
  const embeddings: Map<number, { prev: number[]; next: number[] }> = new Map()

  if (enableSemanticDrift && windowTexts.length > 0) {
    console.log(`[Candidate Boundaries] Generating embeddings for ${windowTexts.length} boundary points...`)

    const allTexts = windowTexts.flatMap(item => [item.prevText, item.nextText])
    const allEmbeddings = await batchGenerateEmbeddings(allTexts, semanticBatchSize)

    // Map back to indices
    for (let j = 0; j < windowTexts.length; j++) {
      embeddings.set(windowTexts[j].index, {
        prev: allEmbeddings[j * 2],
        next: allEmbeddings[j * 2 + 1],
      })
    }

    console.log(`[Candidate Boundaries] Embeddings generated for ${embeddings.size} points`)
  }

  // Score each potential boundary
  for (let i = 0; i < sentences.length - 1; i++) {
    const current = sentences[i]
    const next = sentences[i + 1]
    const signals: BoundarySignal[] = []

    // Signal A: Pause duration
    const pause = next.start - current.end
    const pauseScore = scorePause(pause)
    signals.push({
      type: 'pause',
      score: pauseScore,
      details: `pause=${pause.toFixed(2)}s`,
    })

    // Signal B: Discourse markers (check start of next sentence)
    const markerNext = detectMarkers(next.text)
    const markerScore = markerNext.hit ? 1.0 : 0.0
    if (markerNext.hit) {
      signals.push({
        type: 'marker',
        score: markerScore,
        details: `marker:${markerNext.marker}`,
      })
    }

    // Signal C: Semantic drift
    let semanticScore = 0
    if (enableSemanticDrift && embeddings.has(i)) {
      const { prev, next: nextEmb } = embeddings.get(i)!
      const similarity = cosineSimilarity(prev, nextEmb)

      // Convert similarity drop to score
      // Lower similarity = higher boundary score
      if (similarity < SEMANTIC.LOW_SIMILARITY) {
        semanticScore = 1.0
      } else if (similarity < SEMANTIC.HIGH_SIMILARITY) {
        semanticScore = (SEMANTIC.HIGH_SIMILARITY - similarity) /
                        (SEMANTIC.HIGH_SIMILARITY - SEMANTIC.LOW_SIMILARITY)
      }

      if (semanticScore > 0.3) {
        signals.push({
          type: 'semantic_drop',
          score: semanticScore,
          details: `sim=${similarity.toFixed(3)}`,
        })
      }
    }

    // Signal D: Structural patterns (check next sentence for new structure)
    const structNext = detectStructure(next.text)
    const structScore = structNext.hit ? 1.0 : 0.0
    if (structNext.hit) {
      signals.push({
        type: 'structure',
        score: structScore,
        details: `pattern:${structNext.pattern}`,
      })
    }

    // Combined score using weights
    const combinedScore =
      SIGNAL_WEIGHTS.pause * pauseScore +
      SIGNAL_WEIGHTS.marker * markerScore +
      SIGNAL_WEIGHTS.semantic_drop * semanticScore +
      SIGNAL_WEIGHTS.structure * structScore

    // Only include if above threshold
    if (combinedScore >= CANDIDATE_THRESHOLD) {
      candidates.push({
        time: current.end,  // Boundary is at end of current sentence
        betweenSids: [current.sid, next.sid],
        score: combinedScore,
        signals,
      })
    }

    // Progress callback
    if (onProgress) {
      onProgress(i + 1, sentences.length - 1)
    }
  }

  console.log(`[Candidate Boundaries] Found ${candidates.length} candidates above threshold ${CANDIDATE_THRESHOLD}`)

  return candidates
}

/**
 * Filter top candidates per time window to avoid over-segmentation
 *
 * Selects the highest-scoring candidates while maintaining minimum gap
 */
export function filterTopCandidates(
  candidates: CandidateBoundary[],
  minGapSeconds: number = MIN_CANDIDATE_GAP
): CandidateBoundary[] {
  if (candidates.length === 0) return []

  // Sort by score descending
  const sorted = [...candidates].sort((a, b) => b.score - a.score)
  const selected: CandidateBoundary[] = []

  for (const candidate of sorted) {
    // Check if too close to already selected candidates
    const tooClose = selected.some(
      s => Math.abs(s.time - candidate.time) < minGapSeconds
    )
    if (!tooClose) {
      selected.push(candidate)
    }
  }

  // Sort back by time for sequential processing
  return selected.sort((a, b) => a.time - b.time)
}

/**
 * Get candidates within a specific time range
 */
export function getCandidatesInRange(
  candidates: CandidateBoundary[],
  startTime: number,
  endTime: number
): CandidateBoundary[] {
  return candidates.filter(c => c.time >= startTime && c.time <= endTime)
}
