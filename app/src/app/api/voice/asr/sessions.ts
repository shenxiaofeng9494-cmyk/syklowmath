/**
 * Shared ASR Sessions Store
 *
 * Extracted from asr/route.ts so that both the main ASR route
 * and the SSE streaming route can access the same session data.
 * Each session includes an EventEmitter for real-time push of ASR results.
 */

import { EventEmitter } from "events";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WebSocketInstance = any;

export interface ASRResult {
  text: string;
  definite: boolean;
}

export interface ASRSession {
  ws: WebSocketInstance;
  results: ASRResult[];
  error: string | null;
  closed: boolean;
  emitter: EventEmitter;
}

// Store active sessions (in production, use Redis or similar)
export const sessions = new Map<string, ASRSession>();

/**
 * Event types emitted by session.emitter:
 *  - "result"  → { text: string, definite: boolean }
 *  - "error"   → string
 *  - "closed"  → void
 */
