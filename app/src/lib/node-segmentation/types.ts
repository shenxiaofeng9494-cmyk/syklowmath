/**
 * Node Segmentation V1 - Type Definitions
 */

/**
 * Subtitle cue from ASR (existing format)
 */
export interface SubtitleCue {
  start: number   // seconds (float)
  end: number     // seconds (float)
  text: string
}

/**
 * Sentence with ID for tracking
 */
export interface Sentence {
  sid: string        // e.g., "s-001"
  start: number      // seconds
  end: number        // seconds
  text: string
  embedding?: number[]  // Lazy-loaded for semantic drift
}

/**
 * Boundary signal types
 */
export type BoundarySignalType =
  | 'pause'           // Voice pause > threshold
  | 'marker'          // Discourse marker detected
  | 'semantic_drop'   // Embedding similarity drop
  | 'structure'       // Educational structure pattern

/**
 * Individual signal contribution
 */
export interface BoundarySignal {
  type: BoundarySignalType
  score: number                  // Signal-specific score (0-1)
  details?: string               // e.g., "pause=1.8s", "marker:接下来"
}

/**
 * Candidate boundary between two sentences
 */
export interface CandidateBoundary {
  time: number                   // Boundary timestamp (seconds)
  betweenSids: [string, string]  // ["s-012", "s-013"]
  score: number                  // Combined score (0-1)
  signals: BoundarySignal[]      // Contributing signals
}

/**
 * LLM adjudication decision for a candidate
 */
export interface AdjudicationDecision {
  candidateTime: number
  confirmed: boolean
  reason: string
}

/**
 * LLM adjudication result for a chunk
 */
export interface ChunkAdjudicationResult {
  decisions: AdjudicationDecision[]
  nodeBoundaries: NodeBoundary[]
}

/**
 * Node boundary after LLM adjudication
 */
export interface NodeBoundary {
  order: number
  startTime: number
  endTime: number
  boundaryReason: string
  boundaryConfidence: number
  boundarySignals: string[]
  nodeType?: NodeType
}

/**
 * Node type classification
 */
export type NodeType = 'concept' | 'method' | 'example' | 'summary' | 'transition'

/**
 * Quality validation issue types
 */
export type ValidationIssueType =
  | 'half_sentence_start'
  | 'dangling_end'
  | 'duration_anomaly'
  | 'multiple_topics'

/**
 * Quality validation issue
 */
export interface ValidationIssue {
  type: ValidationIssueType
  description: string
  severity: 'warning' | 'error'
  suggestedFix?: {
    startTime?: number
    endTime?: number
  }
}

/**
 * Quality validation result
 */
export interface ValidationResult {
  status: 'PASS' | 'AUTO_FIX' | 'NEED_REVIEW'
  issues: ValidationIssue[]
  fixedBoundary?: NodeBoundary
}

/**
 * Segmentation progress callback
 */
export type SegmentationProgressCallback = (
  stage: string,
  progress: number,
  message: string
) => void

/**
 * Final segmentation result
 */
export interface SegmentationResult {
  boundaries: NodeBoundary[]
  sentences: Sentence[]
  needsReview: number[]
}
