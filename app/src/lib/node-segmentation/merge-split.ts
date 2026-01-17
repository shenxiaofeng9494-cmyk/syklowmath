/**
 * Node Segmentation V1 - Merge/Split Strategies
 *
 * Apply duration constraints to ensure nodes are within reasonable length:
 * - Merge: Nodes < 45s should be merged with neighbors
 * - Split: Nodes > 240s should be split at internal candidates
 * - Overlap: Add 2s overlap for context continuity when jumping
 */

import type { Sentence, NodeBoundary, CandidateBoundary } from './types'
import { DURATION } from './constants'
import { getCandidatesInRange } from './candidate-boundaries'

/**
 * Calculate node duration in seconds
 */
function getDuration(boundary: NodeBoundary): number {
  return boundary.endTime - boundary.startTime
}

/**
 * Renumber boundaries with consecutive order values
 */
function renumberBoundaries(boundaries: NodeBoundary[]): NodeBoundary[] {
  return boundaries.map((b, i) => ({
    ...b,
    order: i + 1,
  }))
}

/**
 * Merge nodes that are too short (< MERGE_THRESHOLD)
 *
 * Strategy:
 * - Short nodes merge with adjacent nodes
 * - Prefer merging with next node if at the start
 * - Combine boundary reasons and signals
 */
function mergeShortNodes(boundaries: NodeBoundary[]): NodeBoundary[] {
  if (boundaries.length <= 1) return boundaries

  const result: NodeBoundary[] = []

  for (let i = 0; i < boundaries.length; i++) {
    const current = boundaries[i]
    const duration = getDuration(current)

    if (duration < DURATION.MERGE_THRESHOLD) {
      if (result.length > 0) {
        // Merge with previous node
        const prev = result[result.length - 1]
        prev.endTime = current.endTime
        prev.boundaryReason = `${prev.boundaryReason} + ${current.boundaryReason}`

        // Combine signals (deduplicate)
        const combinedSignals = [...new Set([...prev.boundarySignals, ...current.boundarySignals])]
        prev.boundarySignals = combinedSignals

        // Average confidence
        prev.boundaryConfidence = (prev.boundaryConfidence + current.boundaryConfidence) / 2

        console.log(`[Merge/Split] Merged short node ${current.order} (${duration.toFixed(0)}s) with previous`)
      } else if (i < boundaries.length - 1) {
        // First node is short - merge with next
        const next = boundaries[i + 1]
        next.startTime = current.startTime
        next.boundaryReason = `${current.boundaryReason} + ${next.boundaryReason}`
        next.boundarySignals = [...new Set([...current.boundarySignals, ...next.boundarySignals])]
        next.boundaryConfidence = (current.boundaryConfidence + next.boundaryConfidence) / 2

        console.log(`[Merge/Split] Merged short node ${current.order} (${duration.toFixed(0)}s) with next`)
        // Skip current, next will be processed
      } else {
        // Only node and it's short - keep it
        result.push({ ...current })
      }
    } else {
      result.push({ ...current })
    }
  }

  return result
}

/**
 * Find best split points within a long node
 *
 * Uses candidate boundaries within the node's range,
 * selecting the highest-scoring ones with minimum gap
 */
function findSplitPoints(
  boundary: NodeBoundary,
  candidates: CandidateBoundary[]
): number[] {
  // Get candidates within this node's range
  const inRangeCandidates = getCandidatesInRange(
    candidates,
    boundary.startTime + DURATION.TARGET_MIN,  // Ensure first segment is long enough
    boundary.endTime - DURATION.TARGET_MIN     // Ensure last segment is long enough
  )

  if (inRangeCandidates.length === 0) {
    return []
  }

  // Sort by score descending
  const sorted = [...inRangeCandidates].sort((a, b) => b.score - a.score)

  // Calculate how many splits we need
  const duration = getDuration(boundary)
  const targetCount = Math.ceil(duration / DURATION.TARGET_MAX)
  const neededSplits = targetCount - 1

  if (neededSplits <= 0) {
    return []
  }

  // Select top candidates with minimum gap
  const selected: number[] = []
  const minGap = DURATION.TARGET_MIN

  for (const candidate of sorted) {
    if (selected.length >= neededSplits) break

    // Check minimum gap from already selected points
    const tooCloseToSelected = selected.some(t => Math.abs(t - candidate.time) < minGap)

    // Check minimum gap from node boundaries
    const tooCloseToStart = candidate.time - boundary.startTime < minGap
    const tooCloseToEnd = boundary.endTime - candidate.time < minGap

    if (!tooCloseToSelected && !tooCloseToStart && !tooCloseToEnd) {
      selected.push(candidate.time)
    }
  }

  // Sort by time for sequential processing
  return selected.sort((a, b) => a - b)
}

/**
 * Split nodes that are too long (> SPLIT_THRESHOLD)
 *
 * Strategy:
 * - Find internal candidate boundaries
 * - Split at highest-scoring candidates
 * - Maintain minimum segment length
 */
function splitLongNodes(
  boundaries: NodeBoundary[],
  candidates: CandidateBoundary[]
): NodeBoundary[] {
  const result: NodeBoundary[] = []

  for (const boundary of boundaries) {
    const duration = getDuration(boundary)

    if (duration > DURATION.SPLIT_THRESHOLD) {
      console.log(`[Merge/Split] Node ${boundary.order} is too long (${duration.toFixed(0)}s), attempting split...`)

      // Find best split points within this node
      const splitPoints = findSplitPoints(boundary, candidates)

      if (splitPoints.length > 0) {
        console.log(`[Merge/Split] Found ${splitPoints.length} split points: ${splitPoints.map(t => t.toFixed(0)).join(', ')}`)

        // Create sub-nodes
        let prevEnd = boundary.startTime
        for (let i = 0; i <= splitPoints.length; i++) {
          const splitTime = i < splitPoints.length
            ? splitPoints[i]
            : boundary.endTime

          result.push({
            order: 0, // Will be renumbered later
            startTime: prevEnd,
            endTime: splitTime,
            boundaryReason: `${boundary.boundaryReason} (分段 ${i + 1}/${splitPoints.length + 1})`,
            boundaryConfidence: boundary.boundaryConfidence * 0.9, // Slightly lower confidence
            boundarySignals: i === 0
              ? boundary.boundarySignals
              : ['auto_split'],
            nodeType: boundary.nodeType,
          })

          prevEnd = splitTime
        }
      } else {
        console.log(`[Merge/Split] No suitable split points found, keeping as single node`)
        // No good split point found, keep as is
        result.push(boundary)
      }
    } else {
      result.push(boundary)
    }
  }

  return result
}

/**
 * Apply merge/split constraints to boundaries
 *
 * Iteratively applies merge and split operations until
 * all nodes are within acceptable duration range
 */
export function applyDurationConstraints(
  boundaries: NodeBoundary[],
  sentences: Sentence[],
  candidates: CandidateBoundary[]
): NodeBoundary[] {
  let result = [...boundaries]

  // Iteratively apply merge and split until stable
  let changed = true
  let iterations = 0
  const maxIterations = 10

  while (changed && iterations < maxIterations) {
    changed = false
    iterations++

    const beforeMerge = result.length

    // Pass 1: Merge short nodes
    result = mergeShortNodes(result)
    if (result.length !== beforeMerge) {
      changed = true
    }

    const beforeSplit = result.length

    // Pass 2: Split long nodes
    result = splitLongNodes(result, candidates)
    if (result.length !== beforeSplit) {
      changed = true
    }
  }

  if (iterations >= maxIterations) {
    console.warn(`[Merge/Split] Reached max iterations (${maxIterations}), stopping`)
  }

  // Renumber orders
  result = renumberBoundaries(result)

  console.log(`[Merge/Split] Final: ${result.length} nodes after ${iterations} iteration(s)`)

  return result
}

/**
 * Add overlap between adjacent nodes for context continuity
 *
 * This helps users understand context when jumping to a node start,
 * by including a few seconds from the previous content.
 */
export function addOverlap(
  boundaries: NodeBoundary[],
  overlapSeconds: number = DURATION.OVERLAP
): NodeBoundary[] {
  return boundaries.map((boundary, index) => {
    // First node doesn't need overlap
    if (index === 0) return boundary

    return {
      ...boundary,
      startTime: Math.max(0, boundary.startTime - overlapSeconds),
    }
  })
}

/**
 * Validate duration distribution and log statistics
 */
export function logDurationStats(boundaries: NodeBoundary[]): void {
  if (boundaries.length === 0) {
    console.log('[Duration Stats] No boundaries to analyze')
    return
  }

  const durations = boundaries.map(b => getDuration(b))
  const min = Math.min(...durations)
  const max = Math.max(...durations)
  const avg = durations.reduce((a, b) => a + b, 0) / durations.length
  const std = Math.sqrt(
    durations.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / durations.length
  )

  const tooShort = durations.filter(d => d < DURATION.MERGE_THRESHOLD).length
  const tooLong = durations.filter(d => d > DURATION.SPLIT_THRESHOLD).length
  const ideal = durations.filter(d => d >= DURATION.TARGET_MIN && d <= DURATION.TARGET_MAX).length

  console.log(`[Duration Stats] ${boundaries.length} nodes:`)
  console.log(`  - Min: ${min.toFixed(0)}s, Max: ${max.toFixed(0)}s, Avg: ${avg.toFixed(0)}s, Std: ${std.toFixed(0)}s`)
  console.log(`  - Too short (<${DURATION.MERGE_THRESHOLD}s): ${tooShort}`)
  console.log(`  - Too long (>${DURATION.SPLIT_THRESHOLD}s): ${tooLong}`)
  console.log(`  - Ideal (${DURATION.TARGET_MIN}-${DURATION.TARGET_MAX}s): ${ideal}`)
}
