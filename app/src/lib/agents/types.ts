// ============================================================
// V2 学习分析系统 - 类型定义
// ============================================================

// 学生画像
export interface StudentProfile {
  student_id: string;
  overall_level: number; // 0-100
  dimensions: {
    conceptUnderstanding: number;
    procedureExecution: number;
    reasoning: number;
    transfer: number;
    selfExplanation: number;
  };
  preferred_style: QuestionStyle;
  total_sessions: number;
  recent_trend: 'improving' | 'stable' | 'declining';
  knowledge_gaps: string[];
  recent_problem_tags: string[];
  created_at: string;
  updated_at: string;
}

// 学习快照
export interface LearningSnapshot {
  id: string;
  student_id: string;
  video_id: string;
  overall_level: number;
  dimensions: StudentProfile['dimensions'];
  problem_tags: string[];
  preferred_style: QuestionStyle;
  next_strategy: NextStrategy;
  key_observations: string[];
  conversation_summary?: string;
  created_at: string;
}

// 下次策略
export interface NextStrategy {
  introQuestionCount: number; // 1 或 2
  midpointQuestion: boolean;
  difficulty: number; // 1-10
  focusAreas: string[];
}

// 情景记忆
export interface EpisodicMemory {
  id: string;
  student_id: string;
  video_id?: string;
  event: string;
  importance: number; // 1-5
  created_at: string;
}

// 对话日志
export interface ConversationLog {
  id?: string;
  student_id: string;
  video_id: string;
  session_id: string;
  messages: ChatMessage[];
  total_duration_seconds?: number;
  silence_count?: number;
  active_question_count?: number;
  checkpoint_responses?: CheckpointResponse[];
}

// 聊天消息
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

// 检查点回答
export interface CheckpointResponse {
  nodeId: string;
  question: string;
  answer: string;
  isCorrect?: boolean;
  responseTimeMs?: number;
}

// 提问风格
export type QuestionStyle =
  | '条件核对'
  | '判断+理由'
  | '参与感选择'
  | '一句话复述'
  | '迁移应用'
  | '反例举证';

// 问题标签
export type ProblemTag =
  | '假懂'
  | '条件遗漏'
  | '易走神'
  | '超纲倾向'
  | '计算失误'
  | '表达困难';

// ============================================================
// Agent 相关类型
// ============================================================

// 主控 Agent 请求
export interface OrchestratorRequest {
  intent: 'enter_video' | 'video_ended' | 'checkpoint_reached' | 'voice_input';
  studentId: string;
  videoId: string;
  payload?: {
    // 视频信息
    videoTitle?: string;
    currentNodeTitle?: string;
    currentNodeSummary?: string;
    keyConcepts?: string[];
    videoNodes?: string[];
    // 对话数据
    conversationLog?: ChatMessage[];
    checkpointResponses?: CheckpointResponse[];
    sessionId?: string;
    // 语音输入
    asrText?: string;
    dialogState?: DialogState;
    lastAiMessage?: string;
    // 检查点
    currentTime?: number;
    checkpointNode?: {
      title: string;
      summary?: string;
      keyConcepts?: string[];
    };
  };
}

// 主控 Agent 响应
export interface OrchestratorResponse {
  action: 'ask_questions' | 'analysis_complete' | 'respond' | 'ignore' | 'error';
  data?: {
    questions?: GeneratedQuestion[];
    analysis?: LearningAnalysis | null;
    response?: string;
    reason?: string;
    intentType?: 'QUESTION' | 'ANSWER' | 'FEEDBACK' | 'COMMAND' | 'UNKNOWN';
  };
  reasoning?: string;
}

// 学习分析结果
export interface LearningAnalysis {
  overallLevel: number;
  dimensions: StudentProfile['dimensions'];
  problemTags: ProblemTag[];
  preferredQuestionStyle: QuestionStyle;
  nextStrategy: NextStrategy;
  keyObservations: string[];
  shouldSaveEpisode?: boolean;
  episodeEvent?: string;
}

// 生成的问题
export interface GeneratedQuestion {
  content: string;
  style: QuestionStyle;
  difficulty: number;
  expectedAnswerType: 'yes_no' | 'short_answer' | 'multiple_choice' | 'open_ended';
  followUp?: string;
  targetConcept?: string;
  hints?: string[];
}

// 对话状态
export type DialogState = 'idle' | 'waiting_answer' | 'ai_speaking';

// 意图识别结果
export interface IntentResult {
  action: 'RESPOND' | 'IGNORE';
  confidence: number;
  reason: string;
  intentType?: 'QUESTION' | 'ANSWER' | 'FEEDBACK' | 'COMMAND' | 'UNKNOWN';
}

// ============================================================
// 记忆系统类型
// ============================================================

export interface MemoryReadParams {
  studentId: string;
  memoryType: 'profile' | 'history' | 'episodes' | 'all';
  limit?: number;
}

export interface MemoryData {
  profile?: StudentProfile | null;
  history?: LearningSnapshot[];
  episodes?: EpisodicMemory[];
}

export interface MemoryWriteParams {
  studentId: string;
  memoryType: 'profile' | 'episode' | 'snapshot';
  data: any;
}
