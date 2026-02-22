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

  // Internal reconnect: create a fresh TTS session (used by processQueue when session is lost)
  const reconnectInternal = useCallback(async (): Promise<boolean> => {
    console.log("TTS reconnecting (session lost)...");

    // Stop old polling
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
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
        // Start new polling (pollAudioRef used to avoid circular dep)
        pollIntervalRef.current = setInterval(() => pollAudioRef.current(), 200);
        console.log("TTS reconnected:", data.sessionId);
        return true;
      }
      throw new Error("No session ID on reconnect");
    } catch (error) {
      console.error("TTS reconnect failed:", error);
      setIsConnected(false);
      return false;
    }
  }, []);

  // Use ref for pollAudio to break circular dependency
  const pollAudioRef = useRef<() => Promise<void>>(async () => {});

  // Poll for audio from backend
  const pollAudio = useCallback(async () => {
    if (!sessionIdRef.current) return;
    // Skip polling when not speaking (no data to fetch)
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
        isSpeakingRef.current = false;
        setIsSpeaking(false);
        isProcessingRef.current = false;
        hasSessionStartedRef.current = false;
        optionsRef.current.onSpeakEnd?.();

        // Process next item in queue
        processQueue();
      }

      if (data.closed) {
        console.log("TTS connection closed by server (idle timeout)");
        // Don't set isConnected=false here — allow processQueue to auto-reconnect
        // Just clear the session and stop polling
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
  }, []);

  // Keep pollAudioRef in sync
  useEffect(() => {
    pollAudioRef.current = pollAudio;
  }, [pollAudio]);

  // Process text queue (with auto-reconnect on session loss)
  // IMPORTANT: isProcessingRef is set at the TOP to prevent concurrent calls.
  // Multiple queueText calls can arrive while reconnect is async — without this
  // guard, each would start its own reconnect, creating orphaned TTS sessions.
  const processQueue = useCallback(async () => {
    if (isProcessingRef.current || textQueueRef.current.length === 0) {
      return;
    }

    // Lock immediately to prevent concurrent processQueue calls during async reconnect
    isProcessingRef.current = true;

    // Auto-reconnect if session was lost (e.g., WebSocket idle timeout during intervention)
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

    hasSessionStartedRef.current = false;  // Reset for new speak request

    const text = textQueueRef.current.shift();
    if (!text) {
      isProcessingRef.current = false;
      return;
    }

    try {
      // Set ref immediately (before async) to ensure polling starts without 1-frame delay
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

        // If session closed (410) or not found (404), try reconnect + retry once
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
              return; // Success after retry
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

        // Start polling for audio (200ms interval, skips when not speaking)
        pollIntervalRef.current = setInterval(() => pollAudioRef.current(), 200);

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
  }, []);

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

    isSpeakingRef.current = false;
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

    isSpeakingRef.current = false;
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
