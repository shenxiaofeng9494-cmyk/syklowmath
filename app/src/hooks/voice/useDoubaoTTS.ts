"use client";

/**
 * useDoubaoTTS Hook
 *
 * Doubao Bidirectional TTS (Text-to-Speech) client.
 * Uses backend proxy for WebSocket connection since browser WebSocket
 * cannot set custom HTTP headers required by Doubao API.
 *
 * Protocol flow:
 * 1. Create session via POST /api/voice/tts (action: create)
 * 2. Send text via POST /api/voice/tts (action: speak)
 * 3. Poll for audio via POST /api/voice/tts (action: audio)
 * 4. Cancel/close session when done
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { TTS_PROXY_URL } from "./constants";
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
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const textQueueRef = useRef<string[]>([]);
  const isProcessingRef = useRef(false);
  const isSpeakingRef = useRef(false);
  // Track if we've seen SESSION_STARTED for current speak request
  const hasSessionStartedRef = useRef(false);

  // Keep refs in sync
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  useEffect(() => {
    isSpeakingRef.current = isSpeaking;
  }, [isSpeaking]);

  // Poll for audio from backend
  const pollAudio = useCallback(async () => {
    if (!sessionIdRef.current) return;

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

      // Process audio chunks
      if (data.audio && data.audio.length > 0) {
        for (const audioBase64 of data.audio) {
          const audioBuffer = base64ToArrayBuffer(audioBase64);
          optionsRef.current.onAudio?.(audioBuffer);
        }
      }

      // Track if session has started
      if (data.isSessionStarted) {
        hasSessionStartedRef.current = true;
      }

      // Check if session finished (only if it has started first)
      if (hasSessionStartedRef.current && !data.isSessionStarted && isSpeakingRef.current) {
        console.log("TTS session finished");
        setIsSpeaking(false);
        isProcessingRef.current = false;
        hasSessionStartedRef.current = false;
        optionsRef.current.onSpeakEnd?.();

        // Process next item in queue
        processQueue();
      }

      if (data.closed) {
        console.log("TTS connection closed by server");
        setIsConnected(false);
        setIsSpeaking(false);
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
        optionsRef.current.onDisconnected?.();
      }
    } catch (error) {
      console.error("TTS poll error:", error);
    }
  }, []);

  // Process text queue
  const processQueue = useCallback(async () => {
    if (isProcessingRef.current || textQueueRef.current.length === 0) {
      return;
    }

    if (!sessionIdRef.current) {
      return;
    }

    isProcessingRef.current = true;
    hasSessionStartedRef.current = false;  // Reset for new speak request

    const text = textQueueRef.current.shift();
    if (!text) {
      isProcessingRef.current = false;
      return;
    }

    try {
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
        const error = await response.json();
        throw new Error(error.error || `Speak failed: ${response.status}`);
      }

      console.log("TTS speak request sent:", text.substring(0, 50));
    } catch (error) {
      console.error("TTS speak error:", error);
      setIsSpeaking(false);
      isProcessingRef.current = false;
      optionsRef.current.onError?.(
        error instanceof Error ? error : new Error("Speak failed")
      );

      // Try next item in queue
      processQueue();
    }
  }, []);

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

        // Start polling for audio
        pollIntervalRef.current = setInterval(pollAudio, 100);

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
  }, [pollAudio]);

  // Speak text (clears queue and starts immediately)
  const speak = useCallback((text: string) => {
    if (!text.trim()) return;

    // Clear queue
    textQueueRef.current = [];

    // Cancel current if speaking
    if (isSpeakingRef.current) {
      cancel();
    }

    // Queue and process
    textQueueRef.current.push(text);
    processQueue();
  }, [processQueue]);

  // Queue text for playback
  const queueText = useCallback((text: string) => {
    if (!text.trim()) return;

    textQueueRef.current.push(text);

    // Start processing if not already
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

    setIsSpeaking(false);
  }, []);

  // Disconnect
  const disconnect = useCallback(async () => {
    // Only log if there's a session to disconnect
    if (sessionIdRef.current) {
      console.log("Disconnecting TTS...");
    }

    // Stop polling
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }

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

    // Clear state
    textQueueRef.current = [];
    isProcessingRef.current = false;

    setIsConnected(false);
    setIsSpeaking(false);
    optionsRef.current.onDisconnected?.();
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
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
