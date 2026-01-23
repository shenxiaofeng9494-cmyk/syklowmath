/**
 * Voice Interaction Constants
 * Configuration for Doubao ASR, DeepSeek LLM, and Doubao TTS
 */

// ============================================================================
// ASR Constants (Doubao Streaming ASR)
// ============================================================================

// Direct WebSocket URL (requires custom headers - use backend proxy instead)
// See: https://www.volcengine.com/docs/6561/1329505
export const ASR_WEBSOCKET_URL_DIRECT = "wss://openspeech.bytedance.com/api/v3/sauc/bigmodel";

// Backend proxy endpoint (recommended - handles auth headers server-side)
export const ASR_PROXY_URL = "/api/voice/asr";

export const ASR_DEFAULTS = {
  SAMPLE_RATE: 16000,
  BITS_PER_SAMPLE: 16,
  CHANNEL: 1,
  FORMAT: "pcm",
  LANGUAGE: "zh-CN",
  MODEL_NAME: "bigmodel",
  RESULT_TYPE: "single",
  ENABLE_ITN: true,
  ENABLE_PUNC: true,  // Correct field name per Doubao docs (not "enable_punctuation")
} as const;

// Audio chunk configuration
export const ASR_AUDIO_CHUNK = {
  DURATION_MS: 200,           // 200ms per chunk (optimal for Doubao ASR)
  get SAMPLES_PER_CHUNK() {
    return Math.floor((ASR_DEFAULTS.SAMPLE_RATE * this.DURATION_MS) / 1000);
  },
  get BYTES_PER_CHUNK() {
    return this.SAMPLES_PER_CHUNK * (ASR_DEFAULTS.BITS_PER_SAMPLE / 8);
  },
} as const;

// ============================================================================
// TTS Constants (Doubao Bidirectional TTS)
// ============================================================================

// Direct WebSocket URL (requires custom headers - use backend proxy instead)
export const TTS_WEBSOCKET_URL_DIRECT = "wss://openspeech.bytedance.com/api/v3/tts/bidirection";

// Backend proxy endpoint (recommended - handles auth headers server-side)
export const TTS_PROXY_URL = "/api/voice/tts";

export const TTS_DEFAULTS = {
  SAMPLE_RATE: 24000,
  FORMAT: "pcm",
  VOICE: "zh_female_xiaohe_uranus_bigtts",  // 小禾女声
  SPEED: 1.0,
  VOLUME: 1.0,
  PITCH: 1.0,
} as const;

// TTS Event Codes
export const TTS_EVENT = {
  // Upstream
  START_CONNECTION: 1,
  START_SESSION: 100,
  TASK_REQUEST: 200,
  FINISH_SESSION: 102,
  CANCEL_SESSION: 103,

  // Downstream
  CONNECTION_STARTED: 50,
  SESSION_STARTED: 150,
  TTS_RESPONSE: 352,
  SESSION_FINISHED: 152,
  SESSION_CANCELLED: 153,
  CONNECTION_FAILED: 51,
  SESSION_FAILED: 151,
} as const;

// ============================================================================
// LLM Constants (DeepSeek V3)
// ============================================================================

export const LLM_API_URL = "https://api.deepseek.com/chat/completions";

export const LLM_DEFAULTS = {
  MODEL: "deepseek-chat",  // DeepSeek-V3
  MAX_TOKENS: 2048,
  TEMPERATURE: 0.7,
  TOP_P: 0.9,
  STREAM: true,
} as const;

// ============================================================================
// Audio Constants
// ============================================================================

export const AUDIO_INPUT = {
  BROWSER_SAMPLE_RATE: 48000,    // Most browsers default to 48kHz
  TARGET_SAMPLE_RATE: 16000,     // ASR requires 16kHz
  CHANNELS: 1,
  BITS_PER_SAMPLE: 16,
} as const;

export const AUDIO_OUTPUT = {
  SAMPLE_RATE: 24000,            // TTS outputs 24kHz
  CHANNELS: 1,
  BITS_PER_SAMPLE: 16,
} as const;

// ============================================================================
// Protocol Constants (Doubao Binary Protocol)
// ============================================================================

export const PROTOCOL = {
  VERSION: 0b0001,               // Protocol version 1
  HEADER_SIZE: 0b0001,           // 4 bytes (size in 4-byte units)

  // Message types (message_type field, 4 bits)
  MSG_FULL_CLIENT_REQUEST: 0b0001,   // Client sends config JSON
  MSG_AUDIO_ONLY_REQUEST: 0b0010,    // Client sends audio data
  MSG_FULL_SERVER_RESPONSE: 0b1001,  // Server sends recognition result
  MSG_SERVER_ACK: 0b1011,            // Server acknowledgment
  MSG_SERVER_ERROR: 0b1111,          // Server error

  // Compression (message_compression field, 4 bits)
  COMPRESS_NONE: 0b0000,
  COMPRESS_GZIP: 0b0001,

  // Serialization (message_serialization_method field, 4 bits)
  SERIAL_NONE: 0b0000,
  SERIAL_JSON: 0b0001,

  // Flags (message_type_specific_flags field, 4 bits)
  FLAG_NONE: 0b0000,             // Header后4个字节不为sequence number
  FLAG_HAS_SEQUENCE: 0b0001,     // Header后4个字节为sequence number且为正
  FLAG_LAST_PACKET: 0b0010,      // 最后一包（负包），无sequence number
  FLAG_LAST_WITH_SEQ: 0b0011,    // 最后一包且有sequence number
} as const;

// ============================================================================
// Timing Constants
// ============================================================================

export const TIMING = {
  // Connection timeouts
  CONNECTION_TIMEOUT_MS: 10000,
  RECONNECT_DELAY_MS: 1000,
  MAX_RECONNECT_ATTEMPTS: 3,

  // Audio processing
  PLAYBACK_QUEUE_MAX_SIZE: 50,

  // Interruption
  INTERRUPT_FADE_MS: 50,

  // Session
  SESSION_IDLE_TIMEOUT_MS: 300000,  // 5 minutes
} as const;

// ============================================================================
// Math Terms for ASR Hints
// ============================================================================

export const MATH_TERMS_HINT = `一元二次方程、二次函数、配方法、求根公式、判别式、delta、根与系数的关系、韦达定理、
因式分解、完全平方公式、平方差公式、十字相乘法、换元法、
ax²+bx+c=0、x的平方、x²、x³、根号、√、分之、分数、负数、正数、
系数、常数项、一次项、二次项、未知数、方程的根、方程的解、
大于、小于、等于、不等于、大于等于、小于等于、
加、减、乘、除、乘以、除以、等于零、解方程、化简、移项、合并同类项`;
