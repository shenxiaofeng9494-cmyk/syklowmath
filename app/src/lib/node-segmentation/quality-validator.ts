/**
 * Node Segmentation V1 - Quality Validation
 *
 * Detect potential issues with node boundaries:
 * - Half-sentence starts: Node begins with "所以/因此/然后" etc.
 * - Dangling ends: Node ends with "接下来/下一步" etc.
 * - Duration anomalies: Unusual length compared to average
 *
 * Returns validation status: PASS / AUTO_FIX / NEED_REVIEW
 */

import type {
  Sentence,
  NodeBoundary,
  ValidationResult,
  ValidationIssue,
} from './types'
import {
  HALF_SENTENCE_STARTERS,
  DANGLING_ENDINGS,
  DURATION,
} from './constants'

/**
 * Get the first sentence within a node's time range
 */
function getFirstSentence(
  boundary: NodeBoundary,
  sentences: Sentence[]
): Sentence | undefined {
  return sentences.find(
    s => s.start >= boundary.startTime && s.start < boundary.endTime
  )
}

/**
 * Get the last sentence within a node's time range
 */
function getLastSentence(
  boundary: NodeBoundary,
  sentences: Sentence[]
): Sentence | undefined {
  const nodeSentences = sentences.filter(
    s => s.start >= boundary.startTime && s.end <= boundary.endTime
  )
  return nodeSentences[nodeSentences.length - 1]
}

/**
 * Get the sentence before a node starts
 */
function getPreviousSentence(
  boundary: NodeBoundary,
  sentences: Sentence[]
): Sentence | undefined {
  const prevSentences = sentences.filter(s => s.end <= boundary.startTime)
  return prevSentences[prevSentences.length - 1]
}

/**
 * Get the sentence after a node ends
 */
function getNextSentence(
  boundary: NodeBoundary,
  sentences: Sentence[]
): Sentence | undefined {
  return sentences.find(s => s.start >= boundary.endTime)
}

/**
 * Check for half-sentence start
 *
 * Nodes starting with transitional words often need
 * context from the previous content
 */
function checkHalfSentenceStart(
  boundary: NodeBoundary,
  sentences: Sentence[]
): ValidationIssue | null {
  const firstSentence = getFirstSentence(boundary, sentences)
  if (!firstSentence) return null

  const text = firstSentence.text.trim()

  for (const starter of HALF_SENTENCE_STARTERS) {
    if (text.startsWith(starter)) {
      // Find the previous sentence for suggested fix
      const prevSentence = getPreviousSentence(boundary, sentences)

      return {
        type: 'half_sentence_start',
        description: `节点以"${starter}"开头，可能需要向前扩展以包含上下文`,
        severity: 'warning',
        suggestedFix: prevSentence
          ? { startTime: prevSentence.start }
          : undefined,
      }
    }
  }

  return null
}

/**
 * Check for dangling end
 *
 * Nodes ending with transitional words suggest the
 * following content might belong to this node
 */
function checkDanglingEnd(
  boundary: NodeBoundary,
  sentences: Sentence[]
): ValidationIssue | null {
  const lastSentence = getLastSentence(boundary, sentences)
  if (!lastSentence) return null

  const text = lastSentence.text.trim()

  for (const ending of DANGLING_ENDINGS) {
    // Check if ends with or contains the ending phrase near the end
    if (text.endsWith(ending) || text.slice(-20).includes(ending)) {
      // Find the next sentence for suggested fix
      const nextSentence = getNextSentence(boundary, sentences)

      return {
        type: 'dangling_end',
        description: `节点以"${ending}"结尾，后续内容可能属于本节点`,
        severity: 'warning',
        suggestedFix: nextSentence
          ? { endTime: nextSentence.end }
          : undefined,
      }
    }
  }

  return null
}

/**
 * Check for duration anomalies
 *
 * Flags nodes that are significantly different from the average
 */
function checkDurationAnomaly(
  boundary: NodeBoundary,
  allBoundaries: NodeBoundary[]
): ValidationIssue | null {
  const duration = boundary.endTime - boundary.startTime

  // Calculate mean and std of all durations
  const durations = allBoundaries.map(b => b.endTime - b.startTime)
  const mean = durations.reduce((a, b) => a + b, 0) / durations.length

  // If only one node, can't calculate anomaly
  if (allBoundaries.length <= 1) return null

  const std = Math.sqrt(
    durations.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / durations.length
  )

  // Avoid division by zero
  if (std === 0) return null

  // Check if more than 2 standard deviations from mean
  const zScore = Math.abs(duration - mean) / std

  if (zScore > 2) {
    const isLong = duration > mean

    // Determine severity based on hard limits
    const severity: 'warning' | 'error' =
      (duration > DURATION.SPLIT_THRESHOLD || duration < DURATION.MERGE_THRESHOLD)
        ? 'error'
        : 'warning'

    return {
      type: 'duration_anomaly',
      description: isLong
        ? `节点时长 ${Math.round(duration)}s 明显超过平均值 ${Math.round(mean)}s (z=${zScore.toFixed(1)})`
        : `节点时长 ${Math.round(duration)}s 明显低于平均值 ${Math.round(mean)}s (z=${zScore.toFixed(1)})`,
      severity,
    }
  }

  return null
}

/**
 * Validate a single node boundary
 *
 * @returns ValidationResult with status and any issues found
 */
export function validateNode(
  boundary: NodeBoundary,
  sentences: Sentence[],
  allBoundaries: NodeBoundary[]
): ValidationResult {
  const issues: ValidationIssue[] = []

  // Check half-sentence start
  const halfStart = checkHalfSentenceStart(boundary, sentences)
  if (halfStart) issues.push(halfStart)

  // Check dangling end
  const danglingEnd = checkDanglingEnd(boundary, sentences)
  if (danglingEnd) issues.push(danglingEnd)

  // Check duration anomaly
  const durationAnomaly = checkDurationAnomaly(boundary, allBoundaries)
  if (durationAnomaly) issues.push(durationAnomaly)

  // Determine status
  const hasErrors = issues.some(i => i.severity === 'error')
  const hasWarnings = issues.some(i => i.severity === 'warning')
  const canAutoFix = issues.every(i => i.suggestedFix !== undefined)

  let status: 'PASS' | 'AUTO_FIX' | 'NEED_REVIEW' = 'PASS'
  let fixedBoundary: NodeBoundary | undefined

  if (hasErrors) {
    status = 'NEED_REVIEW'
  } else if (hasWarnings) {
    if (canAutoFix && issues.length > 0) {
      status = 'AUTO_FIX'

      // Apply auto-fix by adjusting boundaries
      fixedBoundary = { ...boundary }
      for (const issue of issues) {
        if (issue.suggestedFix?.startTime !== undefined) {
          fixedBoundary.startTime = issue.suggestedFix.startTime
        }
        if (issue.suggestedFix?.endTime !== undefined) {
          fixedBoundary.endTime = issue.suggestedFix.endTime
        }
      }

      // Update confidence to reflect auto-fix
      fixedBoundary.boundaryConfidence = Math.max(0.3, fixedBoundary.boundaryConfidence - 0.1)
      fixedBoundary.boundarySignals = [...fixedBoundary.boundarySignals, 'auto_fixed']
    } else {
      status = 'NEED_REVIEW'
    }
  }

  return {
    status,
    issues,
    fixedBoundary,
  }
}

/**
 * Validate all node boundaries
 *
 * @returns Map of validation results and lists of nodes needing attention
 */
export function validateAllNodes(
  boundaries: NodeBoundary[],
  sentences: Sentence[]
): {
  results: Map<number, ValidationResult>
  needsReview: number[]
  autoFixed: number[]
  passed: number[]
} {
  const results = new Map<number, ValidationResult>()
  const needsReview: number[] = []
  const autoFixed: number[] = []
  const passed: number[] = []

  for (const boundary of boundaries) {
    const result = validateNode(boundary, sentences, boundaries)
    results.set(boundary.order, result)

    switch (result.status) {
      case 'NEED_REVIEW':
        needsReview.push(boundary.order)
        break
      case 'AUTO_FIX':
        autoFixed.push(boundary.order)
        break
      case 'PASS':
        passed.push(boundary.order)
        break
    }
  }

  console.log(`[Quality Validator] Results: ${passed.length} PASS, ${autoFixed.length} AUTO_FIX, ${needsReview.length} NEED_REVIEW`)

  return {
    results,
    needsReview,
    autoFixed,
    passed,
  }
}

/**
 * Apply auto-fixes and return updated boundaries
 */
export function applyAutoFixes(
  boundaries: NodeBoundary[],
  validationResults: Map<number, ValidationResult>
): NodeBoundary[] {
  let fixCount = 0

  const fixed = boundaries.map(boundary => {
    const result = validationResults.get(boundary.order)
    if (result?.status === 'AUTO_FIX' && result.fixedBoundary) {
      fixCount++
      console.log(`[Quality Validator] Auto-fixed node ${boundary.order}: ${result.issues.map(i => i.type).join(', ')}`)
      return result.fixedBoundary
    }
    return boundary
  })

  if (fixCount > 0) {
    console.log(`[Quality Validator] Applied ${fixCount} auto-fixes`)
  }

  return fixed
}

/**
 * Generate a human-readable validation report
 */
export function generateValidationReport(
  boundaries: NodeBoundary[],
  results: Map<number, ValidationResult>
): string {
  const lines: string[] = ['## 节点质量验证报告\n']

  for (const boundary of boundaries) {
    const result = results.get(boundary.order)
    if (!result) continue

    const statusEmoji = {
      'PASS': '✅',
      'AUTO_FIX': '🔧',
      'NEED_REVIEW': '⚠️',
    }[result.status]

    lines.push(`### 节点 ${boundary.order} ${statusEmoji} ${result.status}`)
    lines.push(`- 时间: ${formatTime(boundary.startTime)} - ${formatTime(boundary.endTime)}`)
    lines.push(`- 原因: ${boundary.boundaryReason}`)

    if (result.issues.length > 0) {
      lines.push('- 问题:')
      for (const issue of result.issues) {
        lines.push(`  - [${issue.severity}] ${issue.description}`)
        if (issue.suggestedFix) {
          const fixes: string[] = []
          if (issue.suggestedFix.startTime !== undefined) {
            fixes.push(`startTime → ${issue.suggestedFix.startTime.toFixed(1)}s`)
          }
          if (issue.suggestedFix.endTime !== undefined) {
            fixes.push(`endTime → ${issue.suggestedFix.endTime.toFixed(1)}s`)
          }
          lines.push(`    建议修复: ${fixes.join(', ')}`)
        }
      }
    }

    lines.push('')
  }

  return lines.join('\n')
}

/**
 * Format time as MM:SS
 */
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}
