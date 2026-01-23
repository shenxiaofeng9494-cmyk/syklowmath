"use client";

/**
 * useDoubaoASR Hook
 *
 * Doubao Streaming ASR (Automatic Speech Recognition) client.
 * Uses backend proxy for WebSocket connection since browser WebSocket
 * cannot set custom HTTP headers required by Doubao API.
 *
 * Protocol flow:
 * 1. Create session via POST /api/voice/asr (action: create)
 * 2. Send audio chunks via POST /api/voice/asr (action: audio)
 * 3. Poll for results via POST /api/voice/asr (action: results)
 * 4. End session via POST /api/voice/asr (action: end)
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { ASR_PROXY_URL, ASR_AUDIO_CHUNK } from "./constants";
import { arrayBufferToBase64 } from "./doubao-protocol";

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
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioQueueRef = useRef<ArrayBuffer[]>([]);
  const sendingRef = useRef(false);

  // Keep options ref up to date
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  // Poll for results from the backend
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

      if (!response.ok) {
        throw new Error(`Poll failed: ${response.status}`);
      }

      const data = await response.json();

      if (data.error) {
        console.error("ASR error:", data.error);
        optionsRef.current.onError?.(new Error(data.error));
      }

      if (data.results && data.results.length > 0) {
        for (const result of data.results) {
          console.log("ASR result:", result);
          optionsRef.current.onResult?.(result.text, result.definite);
        }
      }

      if (data.closed) {
        console.log("ASR session closed by server");
        setIsConnected(false);
        setIsRecognizing(false);
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
        optionsRef.current.onDisconnected?.();
      }
    } catch (error) {
      console.error("Poll error:", error);
    }
  }, []);

  // Send queued audio chunks
  const processAudioQueue = useCallback(async () => {
    if (sendingRef.current || audioQueueRef.current.length === 0) return;
    if (!sessionIdRef.current) return;

    sendingRef.current = true;

    while (audioQueueRef.current.length > 0) {
      const audioData = audioQueueRef.current.shift();
      if (!audioData) break;

      try {
        const audioBase64 = arrayBufferToBase64(audioData);
        await fetch(ASR_PROXY_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "audio",
            sessionId: sessionIdRef.current,
            audioBase64,
          }),
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

        // Start polling for results
        pollIntervalRef.current = setInterval(pollResults, 200);

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
  }, [pollResults]);

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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "end",
          sessionId: sessionIdRef.current,
        }),
      });

      setIsRecognizing(false);
    } catch (error) {
      console.error("End audio error:", error);
    }
  }, []);

  const disconnect = useCallback(async () => {
    // Only log if there's a session to disconnect
    if (sessionIdRef.current) {
      console.log("Disconnecting ASR...");
    }

    // Stop polling
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }

    // Close session on backend
    if (sessionIdRef.current) {
      try {
        await fetch(ASR_PROXY_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "close",
            sessionId: sessionIdRef.current,
          }),
        });
      } catch (error) {
        console.error("Close session error:", error);
      }

      sessionIdRef.current = null;
    }

    // Clear audio queue
    audioQueueRef.current = [];
    sendingRef.current = false;

    setIsConnected(false);
    setIsRecognizing(false);
    optionsRef.current.onDisconnected?.();
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
      // Note: Cannot call async disconnect here, but sessions auto-cleanup on backend
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

// Legacy export for compatibility - remove ASRConfig from interface
export type { UseDoubaoASROptions, UseDoubaoASRReturn };
