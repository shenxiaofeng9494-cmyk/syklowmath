/**
 * Voice Interaction Types
 * Definitions for the three-stage voice pipeline: Doubao ASR → DeepSeek LLM → Doubao TTS
 */

// ============================================================================
// State Machine Types
// ============================================================================

export type VoiceInteractionState =
  | "idle"           // 未连接
  | "connecting"     // 正在连接
  | "ready"          // 就绪，等待用户开始说话
  | "listening"      // 正在录音
  | "processing"     // ASR 识别中
  | "thinking"       // LLM 处理中
  | "speaking"       // TTS 播放中
  | "error";         // 错误状态

// ============================================================================
// ASR Types (Doubao Streaming ASR)
// ============================================================================

export interface ASRConfig {
  appId: string;          // Doubao App ID
  accessKey: string;      // Volcengine Access Key ID (used as token)
  resourceId: string;
  sampleRate?: number;    // Default: 16000
  bitsPerSample?: number; // Default: 16
  channel?: number;       // Default: 1
}

export interface ASRResult {
  text: string;
  isDefinite: boolean;   // 是否是最终结果
  confidence?: number;
}

export type ASREventType = "partial" | "final" | "error" | "connected" | "disconnected";

export interface ASREvent {
  type: ASREventType;
  text?: string;
  error?: string;
  isDefinite?: boolean;
}

// ============================================================================
// LLM Types (DeepSeek V3)
// ============================================================================

export interface LLMConfig {
  systemPrompt: string;
  tools: ToolDefinition[];
  guides: Record<string, string>;
  nodeList: VideoNode[];
}

export interface ToolDefinition {
  type: "function";
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface VideoNode {
  order: number;
  title: string;
  startTime: number;
  endTime: number;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
}

export interface ToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

export interface LLMStreamChunk {
  type: "content" | "tool_call" | "done" | "error";
  content?: string;
  toolCall?: {
    id: string;
    name: string;
    arguments: string;
  };
  error?: string;
}

export type LLMEventType = "content" | "tool_call_start" | "tool_call_args" | "tool_call_done" | "done" | "error";

export interface LLMEvent {
  type: LLMEventType;
  content?: string;
  toolCall?: {
    id: string;
    name: string;
    arguments: string;
  };
  error?: string;
}

// ============================================================================
// TTS Types (Doubao Bidirectional TTS)
// ============================================================================

export interface TTSConfig {
  appId: string;         // Doubao App ID
  accessKey: string;     // Volcengine Access Key ID (used as token)
  resourceId: string;
  voice?: string;  // Default: zh_female_tianmeixiaoyuan_moon_bigtts
  speed?: number;  // Default: 1.0
  volume?: number; // Default: 1.0
  pitch?: number;  // Default: 1.0
}

export type TTSEventType = "audio" | "done" | "error" | "connected" | "disconnected";

export interface TTSEvent {
  type: TTSEventType;
  audio?: ArrayBuffer;
  error?: string;
}

// ============================================================================
// Audio Types
// ============================================================================

export interface AudioCaptureConfig {
  inputSampleRate: number;   // Source sample rate (usually 44100 or 48000)
  outputSampleRate: number;  // Target sample rate (16000 for ASR)
  chunkDurationMs: number;   // Chunk duration in milliseconds (200ms recommended)
}

export interface AudioPlaybackConfig {
  sampleRate: number;  // 24000 for TTS playback
  channels: number;    // 1 (mono)
}

// ============================================================================
// Session Types
// ============================================================================

export interface VoiceSessionConfig {
  asr: ASRConfig;
  tts: TTSConfig;
  llm: LLMConfig;
}

export interface VoiceSessionRequest {
  videoContext: string;
  videoId?: string;
  currentTime?: number;
}

export interface VoiceSessionResponse {
  // Doubao credentials
  doubaoAppId: string;
  doubaoAccessKey: string;
  asrResourceId: string;
  ttsResourceId: string;
  ttsVoice: string;
  systemPrompt: string;
  tools: ToolDefinition[];
  guides: Record<string, string>;
  nodeList: VideoNode[];
}

// ============================================================================
// Hook Interface Types
// ============================================================================

export interface SubtitleCue {
  start: number;
  end: number;
  text: string;
}

export interface UseVoiceInteractionOptions {
  videoContext: string;
  videoId?: string;
  currentTime?: number;
  subtitles?: SubtitleCue[];
  studentId?: string;  // V2 自适应：学生ID，用于获取画像
  learningSessionId?: string;  // 跨模式上下文共享：学习会话ID
  interventionConfig?: any;  // 介入模式配置（包含 checkpoint 信息）
  onSpeechStart?: () => void;
  onSpeechEnd?: () => void;
  onTranscript?: (text: string, isFinal: boolean) => void;
  onAnswer?: (text: string) => void;
  onAnswerComplete?: (text: string) => void;
  onToolCall?: (tool: string, params: Record<string, unknown>, callId?: string) => void;
  onComplete?: () => void;
  /** Fires when LLM is complete AND all TTS audio has been played back */
  onAllDone?: () => void;
  onResumeVideo?: () => void;
  onJumpToTime?: (time: number) => void;
}

export interface UseVoiceInteractionReturn {
  // State
  isConnected: boolean;
  isListening: boolean;
  isSpeaking: boolean;
  isPushToTalk: boolean;
  isPushToTalkActive: boolean;
  state: VoiceInteractionState;

  // Actions
  connect: () => Promise<void>;
  disconnect: () => void;
  startListening: () => Promise<void>;
  stopListening: () => void;
  sendTextMessage: (text: string) => void;
  startPushToTalk: () => void;
  stopPushToTalk: () => void;
  setIsPushToTalk: (value: boolean) => void;

  // Interrupt
  interrupt: () => void;

  // Update session config without reconnecting (for intervention mode optimization)
  updateSessionConfig: (updates: Partial<Pick<VoiceSessionResponse, 'systemPrompt' | 'tools'>>) => void;
}

// ============================================================================
// Doubao Protocol Types
// ============================================================================

export interface DoubaoFrameHeader {
  version: number;        // 4 bits, always 1
  headerSize: number;     // 4 bits, size in 4-byte units
  messageType: number;    // 4 bits
  flags: number;          // 4 bits
  serial: number;         // 4 bits
  compress: number;       // 4 bits
  reserved: number;       // 8 bits
}

export enum DoubaoMessageType {
  // Common
  FULL_CLIENT_REQUEST = 0b0001,   // 1
  AUDIO_ONLY_REQUEST = 0b0010,    // 2
  FULL_SERVER_RESPONSE = 0b1001,  // 9
  SERVER_ACK = 0b1011,            // 11
  SERVER_ERROR = 0b1111,          // 15
}

export enum DoubaoCompressType {
  NONE = 0b0000,
  GZIP = 0b0001,
}

export enum DoubaoSerialMethod {
  NONE = 0b0000,
  JSON = 0b0001,
}

// ASR specific
export interface ASRFullClientRequest {
  user: {
    uid: string;
  };
  audio: {
    format: string;       // "pcm"
    rate: number;         // 16000 (note: "rate" not "sample_rate" per Doubao docs)
    bits: number;         // 16
    channel: number;      // 1
    language?: string;    // Optional, only for nostream mode
  };
  request: {
    model_name: string;   // "bigmodel"
    enable_itn: boolean;
    enable_punc: boolean; // Note: "enable_punc" not "enable_punctuation"
    result_type: string;  // "single" or "full"
    show_utterances?: boolean;
  };
}

export interface ASRServerResponse {
  result?: {
    text?: string;
    utterances?: Array<{
      text: string;
      definite: boolean;
      start_time?: number;
      end_time?: number;
    }>;
  };
  addition?: {
    duration?: string;
  };
}

// TTS specific
export enum TTSEventCode {
  // Upstream
  START_CONNECTION = 1,
  START_SESSION = 100,
  TASK_REQUEST = 200,
  FINISH_SESSION = 102,
  CANCEL_SESSION = 103,

  // Downstream
  CONNECTION_STARTED = 50,
  SESSION_STARTED = 150,
  TTS_RESPONSE = 352,
  SESSION_FINISHED = 152,
  SESSION_CANCELLED = 153,
  CONNECTION_FAILED = 51,
  SESSION_FAILED = 151,
}

export interface TTSStartConnectionRequest {
  event: TTSEventCode.START_CONNECTION;
  header: {
    namespace: string;
    name: string;
    appkey: string;
    token: string;
  };
  payload: Record<string, unknown>;
}

export interface TTSStartSessionRequest {
  event: TTSEventCode.START_SESSION;
  header: {
    task_id: string;
    session_id: string;
  };
  payload: {
    tts_config: {
      resource_id: string;
      voice_type: string;
      speed: number;
      volume: number;
      pitch: number;
      format: string;       // "pcm"
      sample_rate: number;  // 24000
    };
  };
}

export interface TTSTaskRequest {
  event: TTSEventCode.TASK_REQUEST;
  header: {
    task_id: string;
    session_id: string;
  };
  payload: {
    text: string;
    is_end: boolean;
  };
}

export interface TTSFinishSessionRequest {
  event: TTSEventCode.FINISH_SESSION;
  header: {
    task_id: string;
    session_id: string;
  };
}

export interface TTSResponse {
  event: TTSEventCode;
  header?: {
    task_id?: string;
    session_id?: string;
    message_id?: string;
  };
  payload?: {
    audio?: string;  // base64 encoded
    is_end?: boolean;
    index?: number;
  };
}
