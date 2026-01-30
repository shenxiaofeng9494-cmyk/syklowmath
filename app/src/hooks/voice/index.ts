/**
 * Voice Interaction Module
 *
 * Three-stage voice pipeline for MathTalkTV:
 * - Doubao ASR (speech recognition)
 * - Doubao LLM (AI responses with function calling)
 * - Doubao TTS (speech synthesis)
 */

// Main hook
export { useVoiceInteraction } from "./useVoiceInteraction";

// Sub-hooks
export { useDoubaoASR } from "./useDoubaoASR";
export { useDoubaoLLM } from "./useDeepSeekLLM";  // 文件名保持不变，但导出新名称
export { useDoubaoTTS } from "./useDoubaoTTS";
export { useAudioCapture } from "./useAudioCapture";
export { useAudioPlayback } from "./useAudioPlayback";

// Types
export type {
  VoiceInteractionState,
  UseVoiceInteractionOptions,
  UseVoiceInteractionReturn,
  ASRConfig,
  TTSConfig,
  LLMConfig,
  ChatMessage,
  ToolCall,
  VideoNode,
  SubtitleCue,
  VoiceSessionResponse,
} from "./types";

// Constants
export {
  ASR_PROXY_URL,
  ASR_DEFAULTS,
  TTS_PROXY_URL,
  TTS_DEFAULTS,
  LLM_DEFAULTS,
  AUDIO_INPUT,
  AUDIO_OUTPUT,
} from "./constants";
