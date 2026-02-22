/**
 * Shared TTS Sessions Store
 *
 * Extracted from tts/route.ts so that both the main TTS route
 * and the SSE streaming route can access the same session data.
 * Each session includes an EventEmitter for real-time push of audio data.
 */

import { EventEmitter } from "events";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WebSocketInstance = any;

export interface TTSSession {
  ws: WebSocketInstance;
  connectionId: string;
  sessionId: string | null;
  audioChunks: Buffer[];
  isConnectionStarted: boolean;
  isSessionStarted: boolean;
  error: string | null;
  closed: boolean;
  emitter: EventEmitter;
}

// Store active sessions
export const sessions = new Map<string, TTSSession>();

/**
 * Event types emitted by session.emitter:
 *  - "audio"          → Buffer (raw PCM audio chunk)
 *  - "sessionStarted" → void
 *  - "sessionFinished" → void
 *  - "error"          → string
 *  - "closed"         → void
 */
