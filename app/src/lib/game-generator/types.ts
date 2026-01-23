/**
 * 游戏生成器类型定义
 */

// 游戏类型枚举
export type GameType =
  | 'parameter-slider'    // 参数调节器（调整参数观察变化）
  | 'drag-match'          // 拖拽匹配（公式与图像配对）
  | 'number-line'         // 数轴估算（点击估计数值位置）
  | 'coordinate-plot'     // 坐标绘图（在坐标系上绘点/画线）
  | 'equation-balance'    // 方程天平（理解等式平衡）
  | 'geometry-construct'  // 几何构造（构建几何图形）
  | 'sequence-puzzle'     // 数列谜题（找规律填数）
  | 'fraction-visual'     // 分数可视化（拖拽分割图形）
  | 'graph-transform'     // 图像变换（拖拽变换函数图像）
  | 'custom'              // 自定义类型

// 游戏难度
export type GameDifficulty = 'easy' | 'medium' | 'hard'

// 生成的游戏数据结构
export interface GeneratedGame {
  // 游戏标识
  id: string
  videoId: string
  nodeId: string

  // 游戏元数据
  title: string
  description: string
  gameType: GameType
  difficulty: GameDifficulty
  estimatedPlayTime: number  // 预计游玩时间（秒）

  // 数学内容关联
  mathConcepts: string[]     // 相关数学概念
  learningObjectives: string[] // 学习目标

  // 游戏代码
  componentCode: string      // React 组件代码

  // 游戏说明
  instructions: string       // 玩法说明
  hints: string[]            // 提示列表

  // 元信息
  generatedAt: string
  agentModel: string
  generationTimeMs: number
}

// Agent 输入：视频节点内容
export interface GameGeneratorInput {
  // 视频信息
  videoId: string
  videoTitle: string

  // 节点信息
  nodeId: string
  nodeTitle: string
  nodeSummary: string
  nodeTranscript: string
  keyConcepts: string[]
  nodeType: string

  // 上下文
  targetAgeGroup: string     // 目标年龄段
  subjectArea: string        // 学科领域

  // 可选配置
  preferredGameTypes?: GameType[]  // 偏好的游戏类型
  difficulty?: GameDifficulty      // 指定难度

  // 反馈信息（用于重新生成）
  feedback?: string            // 老师反馈
  previousGameId?: string      // 之前的游戏ID
}

// Agent 生成进度
export interface GameGenerationProgress {
  stage: 'analyzing' | 'designing' | 'coding' | 'validating' | 'complete' | 'error'
  progress: number  // 0-100
  message: string
  details?: string
  thinking?: string[]      // Agent 思考过程
  steps?: string[]         // 生成步骤
  currentTurn?: number     // 当前轮次
  maxTurns?: number       // 最大轮次
}

// Agent 配置
export interface GameGeneratorConfig {
  // Claude Agent SDK 配置
  model?: string
  maxTurns?: number

  // 生成配置
  enableWebSearch?: boolean   // 是否允许搜索游戏设计灵感
  strictMode?: boolean        // 严格模式：要求代码必须可运行

  // 回调
  onProgress?: (progress: GameGenerationProgress) => void
}

// 数据库存储结构
export interface VideoGameInsert {
  id: string
  video_id: string
  node_id: string
  title: string
  description: string
  game_type: GameType
  difficulty: GameDifficulty
  math_concepts: string[]
  learning_objectives: string[]
  component_code: string
  instructions: string
  hints: string[]
  estimated_play_time: number
  agent_model: string
  generation_time_ms: number
}

export interface VideoGameRow extends VideoGameInsert {
  created_at: string
  updated_at: string
}
