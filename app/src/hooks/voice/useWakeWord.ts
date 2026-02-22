"use client";

import { useCallback, useRef, useEffect, useState } from "react";
import { useDoubaoASR } from "./useDoubaoASR";
import { useAudioCapture } from "./useAudioCapture";

interface UseWakeWordOptions {
  /** Whether wake word listening should be active */
  enabled: boolean;
  /** Called when wake word "小尺老师" is detected */
  onWakeWordDetected: () => void;
  /** Called when "继续" or similar resume command is detected */
  onResumeCommand?: () => void;
}

/**
 * 唤醒词检测 Hook（使用豆包 ASR）
 *
 * 通过豆包 ASR 做语音识别，检测到"小尺老师"后触发回调。
 * Web Speech API 在国内被墙无法使用，改用豆包 ASR 替代。
 *
 * Uses an effect-scoped session counter to handle React Strict Mode
 * double-mount (mount→cleanup→mount) without race conditions.
 */
export function useWakeWord({
  enabled,
  onWakeWordDetected,
  onResumeCommand,
}: UseWakeWordOptions) {
  const [isListening, setIsListening] = useState(false);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  // Use refs for callbacks to avoid re-creating on callback changes
  const callbacksRef = useRef({ onWakeWordDetected, onResumeCommand });
  callbacksRef.current = { onWakeWordDetected, onResumeCommand };

  // Track if wake word was detected (to avoid double-trigger)
  const detectedRef = useRef(false);

  // Session counter: incremented on each cleanup to invalidate stale async operations
  const sessionRef = useRef(0);

  // Reconnect timer for auto-reconnect after ASR disconnect (idle timeout etc.)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Wake word pattern: 小尺 with homophone variations
  const containsWakeWord = (text: string): boolean => {
    return /[小消笑校晓肖萧][尺池吃齿迟赤耻持翅斥]/.test(text);
  };

  // Resume command pattern
  const containsResumeCommand = (text: string): boolean => {
    return /继续|播放|明白了?|懂了|好的?|知道了|没问题/.test(text);
  };

  // Doubao ASR for wake word detection
  const asr = useDoubaoASR({
    onResult: (text, isFinal) => {
      if (!enabledRef.current || detectedRef.current) return;

      console.log(`[WakeWord] ASR: "${text}" final=${isFinal}`);

      if (containsWakeWord(text)) {
        console.log("[WakeWord] Wake word detected via Doubao ASR!");
        detectedRef.current = true;
        // Stop ASR and audio capture
        captureRef.current.stop();
        asrRef.current.disconnect();
        setIsListening(false);
        callbacksRef.current.onWakeWordDetected();
        return;
      }

      // Check for resume command (only on final results)
      if (isFinal && containsResumeCommand(text)) {
        console.log("[WakeWord] Resume command detected:", text);
        callbacksRef.current.onResumeCommand?.();
      }
    },
    onError: (error) => {
      console.warn("[WakeWord] ASR error:", error.message);
    },
    onDisconnected: () => {
      console.log("[WakeWord] ASR disconnected");
      setIsListening(false);
      // Auto-reconnect if still enabled and wake word not yet detected
      // (handles Doubao ASR idle timeout, network drops, etc.)
      if (enabledRef.current && !detectedRef.current) {
        console.log("[WakeWord] Auto-reconnecting ASR in 500ms...");
        reconnectTimerRef.current = setTimeout(() => {
          reconnectTimerRef.current = null;
          if (!enabledRef.current || detectedRef.current) return;
          console.log("[WakeWord] Reconnecting ASR...");
          asrRef.current.connect()
            .then(async () => {
              if (!enabledRef.current || detectedRef.current) {
                asrRef.current.disconnect();
                return;
              }
              // Audio capture may still be running; restart if stopped
              if (!captureRef.current.isCapturing) {
                await captureRef.current.start();
              }
              setIsListening(true);
              console.log("[WakeWord] ASR reconnected successfully");
            })
            .catch((err) => {
              console.error("[WakeWord] ASR reconnect failed:", err);
              // Will try again on next disconnect or after delay
              if (enabledRef.current && !detectedRef.current) {
                reconnectTimerRef.current = setTimeout(() => {
                  reconnectTimerRef.current = null;
                  // Trigger another reconnect attempt
                  asrRef.current.connect().catch(() => {});
                }, 3000);
              }
            });
        }, 500);
      }
    },
  });

  // Audio capture to feed ASR
  const capture = useAudioCapture({
    onAudioChunk: (chunk) => {
      if (asrRef.current.isConnected) {
        asrRef.current.sendAudio(chunk);
      }
    },
    onError: (error) => {
      console.error("[WakeWord] Audio capture error:", error);
    },
  });

  // Stable refs for accessing latest hook values without re-triggering effects
  const asrRef = useRef(asr);
  asrRef.current = asr;
  const captureRef = useRef(capture);
  captureRef.current = capture;

  // Main effect: start/stop wake word detection based on `enabled`
  useEffect(() => {
    if (!enabled) {
      // Clean up when disabled
      captureRef.current.stop();
      asrRef.current.disconnect();
      setIsListening(false);
      return;
    }

    // New session - invalidates any stale async operations from previous mount
    const currentSession = ++sessionRef.current;
    detectedRef.current = false;
    let retryTimeout: ReturnType<typeof setTimeout> | null = null;

    const isSessionValid = () =>
      sessionRef.current === currentSession &&
      enabledRef.current &&
      !detectedRef.current;

    const startListening = async () => {
      if (!isSessionValid()) return;

      try {
        console.log("[WakeWord] Starting Doubao ASR wake word detection...");
        await asrRef.current.connect();
        if (!isSessionValid()) {
          asrRef.current.disconnect();
          return;
        }

        await captureRef.current.start();
        if (!isSessionValid()) {
          captureRef.current.stop();
          asrRef.current.disconnect();
          return;
        }

        setIsListening(true);
        console.log("[WakeWord] Wake word detection active (Doubao ASR)");
      } catch (err) {
        console.error("[WakeWord] Failed to start:", err);
        setIsListening(false);
        // Retry after delay if session is still valid
        if (isSessionValid()) {
          retryTimeout = setTimeout(startListening, 3000);
        }
      }
    };

    // Delay start slightly to allow React Strict Mode cleanup to complete.
    // In Strict Mode, React does mount→cleanup→mount. The cleanup's async
    // disconnect needs time to clear resources before we reconnect.
    const startDelay = setTimeout(startListening, 150);

    return () => {
      // Invalidate this session so any in-flight async operations bail out
      sessionRef.current++;
      clearTimeout(startDelay);
      if (retryTimeout) clearTimeout(retryTimeout);
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      captureRef.current.stop();
      asrRef.current.disconnect();
      setIsListening(false);
    };
  }, [enabled]);

  // Manual start/stop for external control
  const manualStart = useCallback(async () => {
    detectedRef.current = false;
    try {
      await asrRef.current.connect();
      await captureRef.current.start();
      setIsListening(true);
    } catch (err) {
      console.error("[WakeWord] Manual start failed:", err);
    }
  }, []);

  const manualStop = useCallback(() => {
    captureRef.current.stop();
    asrRef.current.disconnect();
    setIsListening(false);
  }, []);

  return {
    isListening,
    start: manualStart,
    stop: manualStop,
  };
}
