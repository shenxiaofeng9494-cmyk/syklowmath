"use client";

/**
 * useDrawExplainVoice Hook
 *
 * Coordinates the "边画边讲" (Draw and Explain) feature:
 * 1. Generate drawing script from Claude
 * 2. Execute script step by step: TTS + drawing synchronized
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { useDoubaoTTS } from "./useDoubaoTTS";
import { useAudioPlayback } from "./useAudioPlayback";
import {
  DrawingScript,
  DrawExplainState,
  DrawExplainProgress,
} from "@/types/drawing-script";
import { DrawingShape } from "@/components/drawing-canvas";

interface UseDrawExplainVoiceOptions {
  videoContext?: string;
  videoId?: string;
  currentTime?: number;
  onOpenDrawing?: () => void;
  onCloseDrawing?: () => void;
  onDrawShapes?: (shapes: DrawingShape[]) => void;
  onClearDrawing?: () => void;
  onStateChange?: (state: DrawExplainState) => void;
  onProgressChange?: (progress: DrawExplainProgress | null) => void;
  onError?: (error: string) => void;
}

interface UseDrawExplainVoiceReturn {
  state: DrawExplainState;
  progress: DrawExplainProgress | null;
  currentScript: DrawingScript | null;
  generate: (userQuery: string) => Promise<void>;
  execute: () => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  isConnected: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
}

// Delay between TTS start and drawing start (ms)
const DRAW_DELAY_MS = 200;

export function useDrawExplainVoice(
  options: UseDrawExplainVoiceOptions
): UseDrawExplainVoiceReturn {
  const [state, setState] = useState<DrawExplainState>("idle");
  const [progress, setProgress] = useState<DrawExplainProgress | null>(null);
  const [currentScript, setCurrentScript] = useState<DrawingScript | null>(null);

  const optionsRef = useRef(options);
  const scriptRef = useRef<DrawingScript | null>(null);
  const stepIndexRef = useRef(0);
  const phaseRef = useRef<"opening" | "step" | "closing">("opening");
  const isPausedRef = useRef(false);
  const isExecutingRef = useRef(false);

  // Keep refs in sync
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  // Audio playback for TTS output
  const audioPlayback = useAudioPlayback({
    onPlaybackEnd: () => {
      // When TTS finishes, move to next step
      if (isExecutingRef.current && !isPausedRef.current) {
        executeNextPhase();
      }
    },
  });

  // TTS hook
  const tts = useDoubaoTTS({
    onAudio: (audioData) => {
      audioPlayback.enqueue(audioData);
    },
    onSpeakEnd: () => {
      // TTS generation complete, audio will continue playing
    },
    onError: (error) => {
      console.error("TTS error:", error);
      optionsRef.current.onError?.(error.message);
    },
  });

  // Update state and notify
  const updateState = useCallback((newState: DrawExplainState) => {
    setState(newState);
    optionsRef.current.onStateChange?.(newState);
  }, []);

  // Update progress and notify
  const updateProgress = useCallback((newProgress: DrawExplainProgress | null) => {
    setProgress(newProgress);
    optionsRef.current.onProgressChange?.(newProgress);
  }, []);

  // Refs for functions to avoid circular dependencies
  const executeCurrentStepRef = useRef<() => void>(() => {});
  const executeClosingRef = useRef<() => void>(() => {});
  const executeNextPhaseRef = useRef<() => void>(() => {});

  // Execute the next phase (opening -> steps -> closing)
  const executeNextPhase = useCallback(() => {
    if (!scriptRef.current || isPausedRef.current) return;

    const script = scriptRef.current;

    if (phaseRef.current === "opening") {
      // Move to first step
      phaseRef.current = "step";
      stepIndexRef.current = 0;
      executeCurrentStepRef.current();
    } else if (phaseRef.current === "step") {
      // Move to next step or closing
      stepIndexRef.current++;
      if (stepIndexRef.current < script.steps.length) {
        executeCurrentStepRef.current();
      } else {
        // All steps done, play closing
        phaseRef.current = "closing";
        executeClosingRef.current();
      }
    } else if (phaseRef.current === "closing") {
      // Execution complete
      isExecutingRef.current = false;
      updateState("completed");
      updateProgress(null);
    }
  }, [updateState, updateProgress]);

  // Execute current step
  const executeCurrentStep = useCallback(() => {
    if (!scriptRef.current || isPausedRef.current) return;

    const script = scriptRef.current;
    const step = script.steps[stepIndexRef.current];

    if (!step) {
      executeNextPhaseRef.current();
      return;
    }

    // Update progress
    updateProgress({
      currentStepIndex: stepIndexRef.current,
      totalSteps: script.steps.length,
      currentPhase: "step",
      isPlaying: true,
    });

    // Clear canvas if needed
    if (step.clearBefore) {
      optionsRef.current.onClearDrawing?.();
    }

    // Start TTS for narration
    tts.speak(step.narration);

    // Draw shapes after delay
    if (step.shapes && step.shapes.length > 0) {
      setTimeout(() => {
        if (!isPausedRef.current) {
          optionsRef.current.onDrawShapes?.(step.shapes as DrawingShape[]);
        }
      }, step.delayBefore || DRAW_DELAY_MS);
    }
  }, [tts, updateProgress]);

  // Execute opening narration
  const executeOpening = useCallback(() => {
    if (!scriptRef.current) return;

    const script = scriptRef.current;

    // Open drawing canvas
    optionsRef.current.onOpenDrawing?.();
    optionsRef.current.onClearDrawing?.();

    // Update progress
    updateProgress({
      currentStepIndex: -1,
      totalSteps: script.steps.length,
      currentPhase: "opening",
      isPlaying: true,
    });

    // Play opening narration
    tts.speak(script.opening);
  }, [tts, updateProgress]);

  // Execute closing narration
  const executeClosing = useCallback(() => {
    if (!scriptRef.current) return;

    const script = scriptRef.current;

    // Update progress
    updateProgress({
      currentStepIndex: script.steps.length,
      totalSteps: script.steps.length,
      currentPhase: "closing",
      isPlaying: true,
    });

    // Play closing narration
    tts.speak(script.closing);
  }, [tts, updateProgress]);

  // Update refs to break circular dependencies
  useEffect(() => {
    executeCurrentStepRef.current = executeCurrentStep;
    executeClosingRef.current = executeClosing;
    executeNextPhaseRef.current = executeNextPhase;
  }, [executeCurrentStep, executeClosing, executeNextPhase]);

  // Ref for execute to avoid circular dependency
  const executeRef = useRef<() => void>(() => {});

  // Generate drawing script from user query
  const generate = useCallback(
    async (userQuery: string) => {
      updateState("generating");

      try {
        const response = await fetch("/api/voice/draw-explain/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userQuery,
            videoContext: optionsRef.current.videoContext,
            videoId: optionsRef.current.videoId,
            currentTime: optionsRef.current.currentTime,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Failed to generate script");
        }

        const data = await response.json();
        scriptRef.current = data.script;
        setCurrentScript(data.script);
        updateState("idle");

        // Auto-execute after generation
        executeRef.current();
      } catch (error) {
        console.error("Generate error:", error);
        updateState("error");
        optionsRef.current.onError?.(
          error instanceof Error ? error.message : "Failed to generate script"
        );
      }
    },
    [updateState]
  );

  // Start execution
  const execute = useCallback(() => {
    if (!scriptRef.current) {
      console.warn("No script to execute");
      return;
    }

    isExecutingRef.current = true;
    isPausedRef.current = false;
    phaseRef.current = "opening";
    stepIndexRef.current = 0;

    updateState("executing");
    executeOpening();
  }, [updateState, executeOpening]);

  // Update executeRef
  useEffect(() => {
    executeRef.current = execute;
  }, [execute]);

  // Pause execution
  const pause = useCallback(() => {
    isPausedRef.current = true;
    audioPlayback.pause();
    tts.cancel();
    updateState("paused");

    if (progress) {
      updateProgress({ ...progress, isPlaying: false });
    }
  }, [audioPlayback, tts, progress, updateState, updateProgress]);

  // Resume execution
  const resume = useCallback(() => {
    if (!scriptRef.current) return;

    isPausedRef.current = false;
    audioPlayback.resume();
    updateState("executing");

    if (progress) {
      updateProgress({ ...progress, isPlaying: true });
    }

    // Re-execute current phase
    if (phaseRef.current === "opening") {
      executeOpening();
    } else if (phaseRef.current === "step") {
      executeCurrentStep();
    } else if (phaseRef.current === "closing") {
      executeClosing();
    }
  }, [
    audioPlayback,
    progress,
    updateState,
    updateProgress,
    executeOpening,
    executeCurrentStep,
    executeClosing,
  ]);

  // Stop execution
  const stop = useCallback(() => {
    isExecutingRef.current = false;
    isPausedRef.current = false;
    audioPlayback.clear();
    tts.cancel();
    optionsRef.current.onCloseDrawing?.();
    updateState("idle");
    updateProgress(null);
  }, [audioPlayback, tts, updateState, updateProgress]);

  // Connect TTS
  const connect = useCallback(async () => {
    await tts.connect();
  }, [tts]);

  // Disconnect TTS
  const disconnect = useCallback(() => {
    stop();
    tts.disconnect();
  }, [stop, tts]);

  return {
    state,
    progress,
    currentScript,
    generate,
    execute,
    pause,
    resume,
    stop,
    isConnected: tts.isConnected,
    connect,
    disconnect,
  };
}
