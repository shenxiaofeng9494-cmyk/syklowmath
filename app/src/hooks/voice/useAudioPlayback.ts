"use client";

/**
 * useAudioPlayback Hook
 *
 * Manages audio playback for TTS output using Web Audio API scheduled playback.
 * Features:
 * - Gapless playback: chunks are pre-scheduled at precise times (eliminates 断断续续)
 * - Support for interruption (clear all scheduled sources)
 * - PCM 16-bit @ 24kHz input
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { AUDIO_OUTPUT } from "./constants";
import { pcm16ToFloat32 } from "./doubao-protocol";

interface UseAudioPlaybackOptions {
  onPlaybackStart?: () => void;
  onPlaybackEnd?: () => void;
  onError?: (error: Error) => void;
}

interface UseAudioPlaybackReturn {
  isPlaying: boolean;
  queueLength: number;
  enqueue: (audioData: ArrayBuffer) => void;
  clear: () => void;
  pause: () => void;
  resume: () => void;
}

export function useAudioPlayback(options: UseAudioPlaybackOptions = {}): UseAudioPlaybackReturn {
  const [isPlaying, setIsPlaying] = useState(false);
  const [queueLength, setQueueLength] = useState(0);

  const audioContextRef = useRef<AudioContext | null>(null);
  const isPausedRef = useRef(false);
  const optionsRef = useRef(options);
  const isPlayingRef = useRef(false);

  // Scheduled playback: track when the next chunk should start
  const nextPlayTimeRef = useRef(0);
  // All currently scheduled sources (for clear/pause)
  const scheduledSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  // Count of active (playing or scheduled) sources
  const activeCountRef = useRef(0);

  // Keep refs in sync
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  // Get or create AudioContext
  const getAudioContext = useCallback((): AudioContext => {
    if (!audioContextRef.current || audioContextRef.current.state === "closed") {
      audioContextRef.current = new AudioContext({
        sampleRate: AUDIO_OUTPUT.SAMPLE_RATE,
      });
    }
    return audioContextRef.current;
  }, []);

  // Enqueue audio data — immediately schedule for gapless playback
  const enqueue = useCallback((audioData: ArrayBuffer) => {
    if (isPausedRef.current) return;

    try {
      const audioContext = getAudioContext();

      // Resume if suspended (browser autoplay policy)
      if (audioContext.state === "suspended") {
        audioContext.resume();
      }

      // Convert PCM 16-bit to Float32
      const floatData = pcm16ToFloat32(audioData);
      if (floatData.length === 0) return;

      // Create AudioBuffer
      const audioBuffer = audioContext.createBuffer(
        AUDIO_OUTPUT.CHANNELS,
        floatData.length,
        AUDIO_OUTPUT.SAMPLE_RATE
      );
      audioBuffer.getChannelData(0).set(floatData);

      // Create source node
      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContext.destination);

      // Schedule: play right after the previous chunk ends, or now if we've fallen behind
      const now = audioContext.currentTime;
      // Small lead time (5ms) to avoid scheduling in the past
      const startTime = Math.max(now + 0.005, nextPlayTimeRef.current);
      source.start(startTime);
      nextPlayTimeRef.current = startTime + audioBuffer.duration;

      // Track for cleanup
      activeCountRef.current++;
      scheduledSourcesRef.current.push(source);

      source.onended = () => {
        // Remove from tracked sources
        const idx = scheduledSourcesRef.current.indexOf(source);
        if (idx >= 0) scheduledSourcesRef.current.splice(idx, 1);
        activeCountRef.current--;

        // If no more scheduled sources, playback is done
        if (activeCountRef.current <= 0 && scheduledSourcesRef.current.length === 0) {
          activeCountRef.current = 0;
          setIsPlaying(false);
          optionsRef.current.onPlaybackEnd?.();
        }
      };

      // Notify playback start on first chunk
      if (!isPlayingRef.current) {
        setIsPlaying(true);
        optionsRef.current.onPlaybackStart?.();
      }

      setQueueLength(activeCountRef.current);
    } catch (error) {
      console.error("Audio playback error:", error);
      optionsRef.current.onError?.(
        error instanceof Error ? error : new Error("Audio playback failed")
      );
    }
  }, [getAudioContext]);

  // Clear all scheduled sources and stop playback
  const clear = useCallback(() => {
    // Stop all scheduled/playing sources
    for (const source of scheduledSourcesRef.current) {
      try {
        source.onended = null;
        source.stop();
        source.disconnect();
      } catch {
        // Source may have already ended
      }
    }
    scheduledSourcesRef.current = [];
    activeCountRef.current = 0;
    nextPlayTimeRef.current = 0;

    isPausedRef.current = false;
    setQueueLength(0);
    setIsPlaying(false);
  }, []);

  // Pause playback
  const pause = useCallback(() => {
    isPausedRef.current = true;

    // Stop all scheduled sources
    for (const source of scheduledSourcesRef.current) {
      try {
        source.onended = null;
        source.stop();
        source.disconnect();
      } catch {
        // Source may have already ended
      }
    }
    scheduledSourcesRef.current = [];
    activeCountRef.current = 0;
    nextPlayTimeRef.current = 0;
  }, []);

  // Resume playback
  const resume = useCallback(() => {
    if (!isPausedRef.current) return;
    isPausedRef.current = false;
    nextPlayTimeRef.current = 0;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clear();
      if (audioContextRef.current && audioContextRef.current.state !== "closed") {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
    };
  }, [clear]);

  return {
    isPlaying,
    queueLength,
    enqueue,
    clear,
    pause,
    resume,
  };
}
