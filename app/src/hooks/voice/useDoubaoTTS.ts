"use client";

/**
 * useDoubaoTTS Hook
 *
 * Doubao Bidirectional TTS (Text-to-Speech) client.
 * Uses backend proxy for WebSocket connection since browser WebSocket
 * cannot set custom HTTP headers required by Doubao API.
 *
 * Optimized protocol flow (v2 - SSE):
 * 1. Create session via POST /api/voice/tts (action: create)
 * 2. Subscribe to audio via SSE  GET /api/voice/tts/stream?sessionId=xxx
 * 3. Send text via POST /api/voice/tts (action: speak)
 * 4. Cancel/close session when done
 *
 * Key improvement over v1:
 * - SSE push replaces 200ms polling (eliminates ~200ms average latency per chunk)
 * - Audio chunks arrive in real-time as Doubao generates them
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { TTS_PROXY_URL, TTS_STREAM_URL } from "./constants";
import { base64ToArrayBuffer } from "./doubao-protocol";

interface UseDoubaoTTSOptions {
  onAudio?: (audioData: ArrayBuffer) => void;
  onSpeakStart?: () => void;
  onSpeakEnd?: () => void;
  onError?: (error: Error) => void;
  onConnected?: () => void;
  onDisconnected?: () => void;
}

interface UseDoubaoTTSReturn {
  isConnected: boolean;
  isSpeaking: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
  speak: (text: string) => void;
  cancel: () => void;
  queueText: (text: string) => void;
}

export function useDoubaoTTS(options: UseDoubaoTTSOptions): UseDoubaoTTSReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const sessionIdRef = useRef<string | null>(null);
  const optionsRef = useRef(options);
  const sseAbortRef = useRef<AbortController | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const textQueueRef = useRef<string[]>([]);
  const isProcessingRef = useRef(false);
  const isSpeakingRef = useRef(false);
  const hasSessionStartedRef = useRef(false);

  // Keep refs in sync
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  useEffect(() => {
    isSpeakingRef.current = isSpeaking;
  }, [isSpeaking]);

  // Handle session finished event (shared between SSE and polling)
  const handleSessionFinished = useCallback(() => {
    console.log("TTS session finished");
    isSpeakingRef.current = false;
    setIsSpeaking(false);
    isProcessingRef.current = false;
    hasSessionStartedRef.current = false;
    optionsRef.current.onSpeakEnd?.();

    // Process next item in queue (use setTimeout to avoid calling processQueue during render)
    setTimeout(() => processQueueRef.current(), 0);
  }, []);

  // Ref for processQueue to break circular dependency
  const processQueueRef = useRef<() => void>(() => {});

  // Poll for audio from backend (fallback when SSE is unavailable)
  const pollAudio = useCallback(async () => {
    if (!sessionIdRef.current) return;
    if (!isSpeakingRef.current) return;

    try {
      const response = await fetch(TTS_PROXY_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "audio",
          sessionId: sessionIdRef.current,
        }),
      });

      if (!response.ok) {
        throw new Error(`Poll failed: ${response.status}`);
      }

      const data = await response.json();

      if (data.error) {
        console.error("TTS error:", data.error);
        optionsRef.current.onError?.(new Error(data.error));
      }

      if (data.audio && data.audio.length > 0) {
        for (const audioBase64 of data.audio) {
          const audioBuffer = base64ToArrayBuffer(audioBase64);
          optionsRef.current.onAudio?.(audioBuffer);
        }
      }

      if (data.isSessionStarted) {
        hasSessionStartedRef.current = true;
      }

      if (hasSessionStartedRef.current && !data.isSessionStarted && isSpeakingRef.current) {
        handleSessionFinished();
      }

      if (data.closed) {
        console.log("TTS connection closed by server (idle timeout)");
        sessionIdRef.current = null;
        isSpeakingRef.current = false;
        setIsSpeaking(false);
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
      }
    } catch (error) {
      console.error("TTS poll error:", error);
    }
  }, [handleSessionFinished]);

  const pollAudioRef = useRef(pollAudio);
  useEffect(() => {
    pollAudioRef.current = pollAudio;
  }, [pollAudio]);

  const startPolling = useCallback((interval = 200) => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }
    console.log("TTS: falling back to polling");
    pollIntervalRef.current = setInterval(() => pollAudioRef.current(), interval);
  }, []);

  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);

  // Start SSE streaming for TTS audio (replaces polling)
  const startSSE = useCallback((sessionId: string) => {
    const abort = new AbortController();
    sseAbortRef.current = abort;

    const url = `${TTS_STREAM_URL}?sessionId=${encodeURIComponent(sessionId)}`;

    fetch(url, { signal: abort.signal })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`TTS SSE connection failed: ${response.status}`);
        }

        console.log("TTS SSE connected");

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error("No response body for SSE");
        }

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // Parse SSE events from buffer
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const dataStr = line.slice(6);

              try {
                const data = JSON.parse(dataStr);

                if (data.error) {
                  console.error("TTS SSE error:", data.error);
                  optionsRef.current.onError?.(new Error(data.error));
                } else if (data.event === "sessionStarted") {
                  hasSessionStartedRef.current = true;
                } else if (data.event === "sessionFinished") {
                  if (isSpeakingRef.current) {
                    handleSessionFinished();
                  }
                } else if (data.audio) {
                  // Audio chunk received — push to playback immediately
                  const audioBuffer = base64ToArrayBuffer(data.audio);
                  optionsRef.current.onAudio?.(audioBuffer);
                }
              } catch {
                // Ignore malformed JSON
              }
            } else if (line.startsWith("event: closed")) {
              console.log("TTS session closed via SSE");
              sessionIdRef.current = null;
              isSpeakingRef.current = false;
              setIsSpeaking(false);
              return;
            }
          }
        }

        // Stream ended normally
        console.log("TTS SSE stream ended");
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        console.warn("TTS SSE failed, falling back to polling:", err.message);
        startPolling();
      });
  }, [handleSessionFinished, startPolling]);

  // Internal reconnect
  const reconnectInternal = useCallback(async (): Promise<boolean> => {
    console.log("TTS reconnecting (session lost)...");

    // Stop old SSE/polling
    if (sseAbortRef.current) {
      sseAbortRef.current.abort();
      sseAbortRef.current = null;
    }
    stopPolling();
    sessionIdRef.current = null;

    try {
      const response = await fetch(TTS_PROXY_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create" }),
      });

      if (!response.ok) {
        throw new Error(`Reconnect create failed: ${response.status}`);
      }

      const data = await response.json();
      if (data.sessionId) {
        sessionIdRef.current = data.sessionId;
        setIsConnected(true);
        startSSE(data.sessionId);
        console.log("TTS reconnected:", data.sessionId);
        return true;
      }
      throw new Error("No session ID on reconnect");
    } catch (error) {
      console.error("TTS reconnect failed:", error);
      setIsConnected(false);
      return false;
    }
  }, [startSSE, stopPolling]);

  // Process text queue
  const processQueue = useCallback(async () => {
    if (isProcessingRef.current || textQueueRef.current.length === 0) {
      return;
    }

    isProcessingRef.current = true;

    // Auto-reconnect if session was lost
    if (!sessionIdRef.current) {
      console.log("TTS session lost, auto-reconnecting before speak...");
      const ok = await reconnectInternal();
      if (!ok) {
        console.error("TTS auto-reconnect failed, dropping queued text");
        textQueueRef.current = [];
        isProcessingRef.current = false;
        return;
      }
    }

    hasSessionStartedRef.current = false;

    const text = textQueueRef.current.shift();
    if (!text) {
      isProcessingRef.current = false;
      return;
    }

    try {
      isSpeakingRef.current = true;
      setIsSpeaking(true);
      optionsRef.current.onSpeakStart?.();

      const response = await fetch(TTS_PROXY_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "speak",
          sessionId: sessionIdRef.current,
          text,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        const errorMsg = errorBody.error || `Speak failed: ${response.status}`;

        if (response.status === 410 || response.status === 404) {
          console.log("TTS session expired, reconnecting and retrying...");
          const ok = await reconnectInternal();
          if (ok) {
            const retryResponse = await fetch(TTS_PROXY_URL, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                action: "speak",
                sessionId: sessionIdRef.current,
                text,
              }),
            });
            if (retryResponse.ok) {
              console.log("TTS speak retry succeeded:", text.substring(0, 50));
              return;
            }
          }
        }

        throw new Error(errorMsg);
      }

      console.log("TTS speak request sent:", text.substring(0, 50));
    } catch (error) {
      console.error("TTS speak error:", error);
      isSpeakingRef.current = false;
      setIsSpeaking(false);
      isProcessingRef.current = false;
      optionsRef.current.onError?.(
        error instanceof Error ? error : new Error("Speak failed")
      );

      // Try next item in queue
      processQueue();
    }
  }, [reconnectInternal]);

  // Keep processQueueRef in sync
  useEffect(() => {
    processQueueRef.current = processQueue;
  }, [processQueue]);

  // Connect to TTS
  const connect = useCallback(async () => {
    if (sessionIdRef.current) {
      console.log("TTS session already exists");
      return;
    }

    console.log("Creating TTS session...");

    try {
      const response = await fetch(TTS_PROXY_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create" }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `Create failed: ${response.status}`);
      }

      const data = await response.json();

      if (data.sessionId) {
        sessionIdRef.current = data.sessionId;
        setIsConnected(true);
        optionsRef.current.onConnected?.();

        // Start SSE for real-time audio (replaces 200ms polling)
        startSSE(data.sessionId);

        console.log("TTS session created:", data.sessionId);
      } else {
        throw new Error("No session ID returned");
      }
    } catch (error) {
      console.error("Failed to create TTS session:", error);
      optionsRef.current.onError?.(
        error instanceof Error ? error : new Error("Failed to create session")
      );
      throw error;
    }
  }, [startSSE]);

  // Speak text (clears queue and starts immediately)
  const speak = useCallback((text: string) => {
    if (!text.trim()) return;

    textQueueRef.current = [];

    if (isSpeakingRef.current) {
      cancel();
    }

    textQueueRef.current.push(text);
    processQueue();
  }, [processQueue]);

  // Queue text for playback
  const queueText = useCallback((text: string) => {
    if (!text.trim()) return;

    textQueueRef.current.push(text);

    if (!isProcessingRef.current) {
      processQueue();
    }
  }, [processQueue]);

  // Cancel current playback
  const cancel = useCallback(async () => {
    textQueueRef.current = [];
    isProcessingRef.current = false;
    hasSessionStartedRef.current = false;

    if (sessionIdRef.current && isSpeakingRef.current) {
      try {
        await fetch(TTS_PROXY_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "cancel",
            sessionId: sessionIdRef.current,
          }),
        });
      } catch (error) {
        console.error("TTS cancel error:", error);
      }
    }

    isSpeakingRef.current = false;
    setIsSpeaking(false);
  }, []);

  // Disconnect
  const disconnect = useCallback(async () => {
    if (sessionIdRef.current) {
      console.log("Disconnecting TTS...");
    }

    // Stop SSE stream
    if (sseAbortRef.current) {
      sseAbortRef.current.abort();
      sseAbortRef.current = null;
    }

    // Stop polling fallback
    stopPolling();

    // Close session on backend
    if (sessionIdRef.current) {
      try {
        await fetch(TTS_PROXY_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "close",
            sessionId: sessionIdRef.current,
          }),
        });
      } catch (error) {
        console.error("TTS close error:", error);
      }

      sessionIdRef.current = null;
    }

    textQueueRef.current = [];
    isProcessingRef.current = false;

    isSpeakingRef.current = false;
    setIsConnected(false);
    setIsSpeaking(false);
    optionsRef.current.onDisconnected?.();
  }, [stopPolling]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (sseAbortRef.current) {
        sseAbortRef.current.abort();
      }
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  return {
    isConnected,
    isSpeaking,
    connect,
    disconnect,
    speak,
    cancel,
    queueText,
  };
}
