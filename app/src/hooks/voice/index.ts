/**
 * Voice Interaction Module
 *
 * Three-stage voice pipeline for MathTalkTV:
 * - Doubao ASR (speech recognition)
 * - DeepSeek LLM (AI responses with function calling)
 * - Doubao TTS (speech synthesis)
 */

// Main hook
export { useVoiceInteraction } from "./useVoiceInteraction";

// Sub-hooks
export { useDoubaoASR } from "./useDoubaoASR";
export { useDeepSeekLLM } from "./useDeepSeekLLM";
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
  ASR_WEBSOCKET_URL,
  ASR_DEFAULTS,
  TTS_WEBSOCKET_URL,
  TTS_DEFAULTS,
  LLM_DEFAULTS,
  AUDIO_INPUT,
  AUDIO_OUTPUT,
} from "./constants";
