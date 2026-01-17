/**
 * Node Segmentation V1 - Configuration Constants
 */

/**
 * Duration constraints (in seconds)
 * 调整为更细粒度的切分：目标 45-90 秒
 */
export const DURATION = {
  TARGET_MIN: 45,       // Ideal minimum (原 60)
  TARGET_MAX: 90,       // Ideal maximum (原 180)
  MERGE_THRESHOLD: 30,  // Merge if below this (原 45)
  SPLIT_THRESHOLD: 120, // Split if above this (原 240)
  OVERLAP: 2,           // Overlap for context continuity
} as const

/**
 * Pause scoring thresholds (in seconds)
 */
export const PAUSE_THRESHOLDS = {
  STRONG: 1.2,    // > 1.2s = strong candidate
  MEDIUM: 0.6,    // 0.6-1.2s = medium candidate
  WEAK: 0.3,      // < 0.6s = weak (but not rejected)
} as const

/**
 * Signal weights for combined scoring
 */
export const SIGNAL_WEIGHTS = {
  pause: 0.25,
  marker: 0.30,
  semantic_drop: 0.35,
  structure: 0.10,
} as const

/**
 * Candidate threshold - minimum score to be considered
 * 降低阈值以获得更多候选边界
 */
export const CANDIDATE_THRESHOLD = 0.35  // 原 0.4

/**
 * Minimum gap between selected candidates (seconds)
 * 降低最小间隔以允许更密集的切分
 */
export const MIN_CANDIDATE_GAP = 15  // 原 30

/**
 * Semantic similarity thresholds
 */
export const SEMANTIC = {
  WINDOW_SIZE: 3,        // Sentences to aggregate for comparison
  DROP_THRESHOLD: 0.2,   // Similarity drop that signals boundary
  HIGH_SIMILARITY: 0.85,
  LOW_SIMILARITY: 0.65,
} as const

/**
 * Discourse markers for Chinese math education
 */
export const DISCOURSE_MARKERS = {
  transition: [
    '接下来',
    '下面我们',
    '好现在',
    '然后我们',
    '我们再来看',
    '总结一下',
    '回顾一下',
    '现在我们',
    '接着我们',
    '下面',
    '好',
  ],
  concept_intro: [
    '什么是',
    '定义是',
    '我们先定义',
    '概念是',
    '所谓',
    '叫做',
  ],
  example: [
    '来看一道例题',
    '例题',
    '例1',
    '例2',
    '例3',
    '我们看一个例子',
    '题目是',
    '我们做这道题',
    '看这道题',
    '比如说',
    '举个例子',
  ],
  summary: [
    '所以',
    '因此',
    '结论是',
    '最后我们得到',
    '综上所述',
    '这就是',
    '总之',
    '归纳一下',
  ],
  step: [
    '第一步',
    '第二步',
    '第三步',
    '首先',
    '其次',
    '最后',
    '步骤一',
    '步骤二',
  ],
} as const

/**
 * Structure patterns for math content (RegExp sources)
 */
export const STRUCTURE_PATTERNS = [
  /[(（]\s*[1-9一二三四五六七八九十]\s*[)）]/,  // (1) (2) or (一) (二)
  /已知[:：]/,
  /求[:：]|求证/,
  /解[:：]/,
  /证[:：]|证明/,
  /设\s/,
] as const

/**
 * Half-sentence start indicators (likely needs context from previous)
 */
export const HALF_SENTENCE_STARTERS = [
  '所以',
  '因此',
  '然后',
  '我们继续',
  '接着',
  '那么',
  '这个',
  '这样',
  '那',
  '也就是说',
  '就是',
  '这就',
]

/**
 * Dangling end indicators (likely needs continuation)
 */
export const DANGLING_ENDINGS = [
  '下一步',
  '接下来我们',
  '然后呢',
  '那我们',
  '所以呢',
  '接着呢',
  '我们来',
  '下面',
  '那',
]

/**
 * Chunk size for LLM processing (seconds)
 */
export const LLM_CHUNK_DURATION = 300  // 5 minutes per chunk

/**
 * Embedding batch size for semantic drift calculation
 */
export const EMBEDDING_BATCH_SIZE = 20
