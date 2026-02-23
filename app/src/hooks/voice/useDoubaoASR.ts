"use client";

/**
 * useDoubaoASR Hook
 *
 * Doubao Streaming ASR (Automatic Speech Recognition) client.
 * Uses backend proxy for WebSocket connection since browser WebSocket
 * cannot set custom HTTP headers required by Doubao API.
 *
 * Optimized protocol flow (v2):
 * 1. Create session via POST /api/voice/asr (action: create)
 * 2. Subscribe to results via SSE  GET /api/voice/asr/stream?sessionId=xxx
 * 3. Send audio chunks via POST /api/voice/asr (binary octet-stream)
 * 4. End session via POST /api/voice/asr (action: end)
 *
 * Key improvements over v1:
 * - SSE push replaces 200ms polling (eliminates ~100ms average latency)
 * - Binary audio replaces base64 JSON (saves ~33% bandwidth)
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { ASR_PROXY_URL, ASR_STREAM_URL } from "./constants";

interface UseDoubaoASROptions {
  onResult?: (text: string, isFinal: boolean) => void;
  onError?: (error: Error) => void;
  onConnected?: () => void;
  onDisconnected?: () => void;
}

interface UseDoubaoASRReturn {
  isConnected: boolean;
  isRecognizing: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
  sendAudio: (audioData: ArrayBuffer) => void;
  endAudio: () => void;
}

export function useDoubaoASR(options: UseDoubaoASROptions): UseDoubaoASRReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [isRecognizing, setIsRecognizing] = useState(false);

  const sessionIdRef = useRef<string | null>(null);
  const optionsRef = useRef(options);
  const sseAbortRef = useRef<AbortController | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioQueueRef = useRef<ArrayBuffer[]>([]);
  const sendingRef = useRef(false);

  // Keep options ref up to date
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  // Poll for ASR results (fallback when SSE is unavailable)
  const pollResults = useCallback(async () => {
    if (!sessionIdRef.current) return;

    try {
      const response = await fetch(ASR_PROXY_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "results",
          sessionId: sessionIdRef.current,
        }),
      });

      if (!response.ok) return;

      const data = await response.json();

      if (data.results && data.results.length > 0) {
        for (const result of data.results) {
          console.log("ASR poll result:", result);
          optionsRef.current.onResult?.(result.text, result.definite);
        }
      }

      if (data.error) {
        console.error("ASR poll error:", data.error);
        optionsRef.current.onError?.(new Error(data.error));
      }

      if (data.closed) {
        console.log("ASR session closed (poll)");
        stopPolling();
        setIsConnected(false);
        setIsRecognizing(false);
        optionsRef.current.onDisconnected?.();
      }
    } catch (error) {
      console.error("ASR poll fetch error:", error);
    }
  }, []);

  const startPolling = useCallback((interval = 200) => {
    stopPolling();
    console.log("ASR: falling back to polling");
    pollIntervalRef.current = setInterval(pollResults, interval);
  }, [pollResults]);

  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);

  // Start SSE streaming for results, with polling fallback
  const startSSE = useCallback((sessionId: string) => {
    const abort = new AbortController();
    sseAbortRef.current = abort;

    const url = `${ASR_STREAM_URL}?sessionId=${encodeURIComponent(sessionId)}`;

    fetch(url, { signal: abort.signal })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`SSE connection failed: ${response.status}`);
        }

        console.log("ASR SSE connected");

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
          buffer = lines.pop() || ""; // Keep incomplete line in buffer

          let currentEvent = "message";

          for (const line of lines) {
            if (line.startsWith("event: ")) {
              currentEvent = line.slice(7).trim();
            } else if (line.startsWith("data: ")) {
              const dataStr = line.slice(6);

              try {
                const data = JSON.parse(dataStr);

                if (currentEvent === "error") {
                  console.error("ASR SSE error:", data.error);
                  optionsRef.current.onError?.(new Error(data.error));
                } else if (currentEvent === "closed") {
                  console.log("ASR session closed via SSE");
                  setIsConnected(false);
                  setIsRecognizing(false);
                  optionsRef.current.onDisconnected?.();
                  return;
                } else {
                  // Default "message" event = ASR result
                  if (data.text !== undefined) {
                    console.log("ASR SSE result:", data);
                    optionsRef.current.onResult?.(data.text, data.definite);
                  }
                }
              } catch {
                // Ignore malformed JSON
              }

              currentEvent = "message"; // Reset for next event
            }
          }
        }

        // Stream ended normally
        console.log("ASR SSE stream ended");
        setIsConnected(false);
        setIsRecognizing(false);
        optionsRef.current.onDisconnected?.();
      })
      .catch((err) => {
        if (err.name === "AbortError") return; // Normal disconnect
        console.warn("ASR SSE failed, falling back to polling:", err.message);
        // Fallback to polling when SSE is unavailable
        startPolling();
      });
  }, [startPolling]);

  // Send queued audio chunks as binary (batched to avoid sequential fetch bottleneck)
  const processAudioQueue = useCallback(async () => {
    if (sendingRef.current || audioQueueRef.current.length === 0) return;
    if (!sessionIdRef.current) return;

    sendingRef.current = true;

    while (audioQueueRef.current.length > 0) {
      // Batch all queued chunks into a single request
      const chunks = audioQueueRef.current.splice(0, audioQueueRef.current.length);
      const totalSize = chunks.reduce((sum, c) => sum + c.byteLength, 0);
      const combined = new Uint8Array(totalSize);
      let offset = 0;
      for (const chunk of chunks) {
        combined.set(new Uint8Array(chunk), offset);
        offset += chunk.byteLength;
      }

      try {
        await fetch(ASR_PROXY_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/octet-stream",
            "X-Session-Id": sessionIdRef.current!,
            "X-Is-Last": "false",
          },
          body: combined.buffer,
        });
      } catch (error) {
        console.error("Send audio error:", error);
      }
    }

    sendingRef.current = false;
  }, []);

  const connect = useCallback(async () => {
    if (sessionIdRef.current) {
      console.log("ASR session already exists");
      return;
    }

    console.log("Creating ASR session...");

    try {
      const response = await fetch(ASR_PROXY_URL, {
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
        setIsRecognizing(true);
        optionsRef.current.onConnected?.();

        // Start SSE for real-time results (replaces polling)
        startSSE(data.sessionId);

        console.log("ASR session created:", data.sessionId);
      } else {
        throw new Error("No session ID returned");
      }
    } catch (error) {
      console.error("Failed to create ASR session:", error);
      optionsRef.current.onError?.(
        error instanceof Error ? error : new Error("Failed to create session")
      );
      throw error;
    }
  }, [startSSE]);

  const sendAudio = useCallback((audioData: ArrayBuffer) => {
    if (!sessionIdRef.current) {
      console.warn("ASR session not created, cannot send audio");
      return;
    }

    // Queue audio chunk and process
    audioQueueRef.current.push(audioData);
    processAudioQueue();
  }, [processAudioQueue]);

  const endAudio = useCallback(async () => {
    if (!sessionIdRef.current) return;

    console.log("Sending ASR end signal");

    try {
      await fetch(ASR_PROXY_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/octet-stream",
          "X-Session-Id": sessionIdRef.current,
          "X-Is-Last": "true",
        },
        body: new ArrayBuffer(0),
      });

      setIsRecognizing(false);
    } catch (error) {
      console.error("End audio error:", error);
    }
  }, []);

  const disconnect = useCallback(async () => {
    // Capture and clear session ID immediately (before async operations)
    const sessionId = sessionIdRef.current;
    sessionIdRef.current = null;

    if (sessionId) {
      console.log("Disconnecting ASR...");
    }

    // Abort SSE stream
    if (sseAbortRef.current) {
      sseAbortRef.current.abort();
      sseAbortRef.current = null;
    }

    // Stop polling fallback
    stopPolling();

    // Close session on backend
    if (sessionId) {
      try {
        await fetch(ASR_PROXY_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "close",
            sessionId,
          }),
        });
      } catch (error) {
        console.error("Close session error:", error);
      }
    }

    // Clear audio queue
    audioQueueRef.current = [];
    sendingRef.current = false;

    setIsConnected(false);
    setIsRecognizing(false);
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
    isRecognizing,
    connect,
    disconnect,
    sendAudio,
    endAudio,
  };
}

// Legacy export for compatibility
export type { UseDoubaoASROptions, UseDoubaoASRReturn };
