"use client";

/**
 * useAudioPlayback Hook
 *
 * Manages audio playback queue for TTS output.
 * Features:
 * - Sequential playback of audio chunks
 * - Support for interruption (clear queue, stop current playback)
 * - PCM 16-bit @ 24kHz input
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { AUDIO_OUTPUT, TIMING } from "./constants";
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
  const queueRef = useRef<ArrayBuffer[]>([]);
  const isProcessingRef = useRef(false);
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const isPausedRef = useRef(false);
  const optionsRef = useRef(options);
  const isPlayingRef = useRef(false);

  // Ref for processQueue to avoid circular dependency
  const processQueueRef = useRef<() => void>(() => {});

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

  // Process the next item in the queue
  const processQueue = useCallback(async () => {
    if (isProcessingRef.current || queueRef.current.length === 0 || isPausedRef.current) {
      return;
    }

    isProcessingRef.current = true;

    // Notify playback start on first item
    if (!isPlayingRef.current) {
      setIsPlaying(true);
      optionsRef.current.onPlaybackStart?.();
    }

    const audioData = queueRef.current.shift();
    setQueueLength(queueRef.current.length);

    if (!audioData) {
      isProcessingRef.current = false;
      return;
    }

    try {
      const audioContext = getAudioContext();

      // Resume if suspended (browser autoplay policy)
      if (audioContext.state === "suspended") {
        await audioContext.resume();
      }

      // Convert PCM 16-bit to Float32
      const floatData = pcm16ToFloat32(audioData);

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
      currentSourceRef.current = source;

      // Handle playback completion
      source.onended = () => {
        currentSourceRef.current = null;
        isProcessingRef.current = false;

        // Process next item in queue using ref
        if (queueRef.current.length > 0 && !isPausedRef.current) {
          setTimeout(() => processQueueRef.current(), 0);
        } else if (queueRef.current.length === 0) {
          // Queue empty, playback complete
          setIsPlaying(false);
          optionsRef.current.onPlaybackEnd?.();
        }
      };

      // Start playback
      source.start();
    } catch (error) {
      console.error("Audio playback error:", error);
      currentSourceRef.current = null;
      isProcessingRef.current = false;
      optionsRef.current.onError?.(
        error instanceof Error ? error : new Error("Audio playback failed")
      );

      // Continue processing queue despite error
      if (queueRef.current.length > 0) {
        setTimeout(() => processQueueRef.current(), 0);
      } else {
        setIsPlaying(false);
        optionsRef.current.onPlaybackEnd?.();
      }
    }
  }, [getAudioContext]);

  // Update processQueueRef
  useEffect(() => {
    processQueueRef.current = processQueue;
  }, [processQueue]);

  // Enqueue audio data for playback
  const enqueue = useCallback((audioData: ArrayBuffer) => {
    // Enforce maximum queue size
    if (queueRef.current.length >= TIMING.PLAYBACK_QUEUE_MAX_SIZE) {
      console.warn("Audio playback queue full, dropping oldest chunk");
      queueRef.current.shift();
    }

    queueRef.current.push(audioData);
    setQueueLength(queueRef.current.length);

    // Start processing if not already running
    if (!isProcessingRef.current && !isPausedRef.current) {
      processQueue();
    }
  }, [processQueue]);

  // Clear the queue and stop current playback
  const clear = useCallback(() => {
    // Stop current source
    if (currentSourceRef.current) {
      try {
        currentSourceRef.current.stop();
        currentSourceRef.current.disconnect();
      } catch {
        // Source may have already ended
      }
      currentSourceRef.current = null;
    }

    // Clear queue
    queueRef.current = [];
    setQueueLength(0);
    isProcessingRef.current = false;
    isPausedRef.current = false;
    setIsPlaying(false);
  }, []);

  // Pause playback (doesn't clear queue)
  const pause = useCallback(() => {
    isPausedRef.current = true;

    // Stop current source
    if (currentSourceRef.current) {
      try {
        currentSourceRef.current.stop();
        currentSourceRef.current.disconnect();
      } catch {
        // Source may have already ended
      }
      currentSourceRef.current = null;
    }

    isProcessingRef.current = false;
  }, []);

  // Resume playback
  const resume = useCallback(() => {
    if (!isPausedRef.current) return;

    isPausedRef.current = false;

    // Continue processing queue
    if (queueRef.current.length > 0) {
      processQueue();
    }
  }, [processQueue]);

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
