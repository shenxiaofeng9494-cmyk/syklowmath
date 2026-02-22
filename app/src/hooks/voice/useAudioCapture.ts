"use client";

/**
 * useAudioCapture Hook
 *
 * Captures audio from the microphone, resamples it from browser's native rate
 * (usually 48kHz) to 16kHz, and outputs PCM 16-bit chunks suitable for ASR.
 *
 * Uses AudioWorklet for efficient, jitter-free audio processing.
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { AUDIO_INPUT, ASR_AUDIO_CHUNK } from "./constants";

interface UseAudioCaptureOptions {
  onAudioChunk: (chunk: ArrayBuffer) => void;
  onError?: (error: Error) => void;
}

interface UseAudioCaptureReturn {
  isCapturing: boolean;
  start: () => Promise<void>;
  stop: () => void;
}

export function useAudioCapture(options: UseAudioCaptureOptions): UseAudioCaptureReturn {
  const [isCapturing, setIsCapturing] = useState(false);

  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const isCapturingRef = useRef(false);
  const optionsRef = useRef(options);

  // Keep options ref up to date
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  const start = useCallback(async () => {
    // Use ref for guard check to avoid stale closure issues (React Strict Mode)
    if (isCapturingRef.current) {
      console.log("Audio capture already running");
      return;
    }

    try {
      console.log("Requesting microphone access...");

      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: AUDIO_INPUT.CHANNELS,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      console.log("Microphone access granted");
      mediaStreamRef.current = stream;

      // Create AudioContext
      // Don't specify sampleRate - let browser use native rate
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;

      console.log(`AudioContext created with sample rate: ${audioContext.sampleRate}`);

      // Load and register the AudioWorklet
      try {
        await audioContext.audioWorklet.addModule("/audio-worklets/resampler-processor.js");
        console.log("AudioWorklet module loaded");
      } catch (e) {
        console.error("Failed to load AudioWorklet, falling back to ScriptProcessor:", e);
        // Fallback to ScriptProcessor if AudioWorklet is not available
        await startWithScriptProcessor(audioContext, stream);
        return;
      }

      // Create the resampler worklet node
      const workletNode = new AudioWorkletNode(audioContext, "resampler-processor");
      workletNodeRef.current = workletNode;

      // Configure the resampler
      workletNode.port.postMessage({
        type: "config",
        targetSampleRate: AUDIO_INPUT.TARGET_SAMPLE_RATE,
        chunkDurationMs: ASR_AUDIO_CHUNK.DURATION_MS,
      });

      // Handle audio chunks from the worklet
      workletNode.port.onmessage = (event) => {
        if (event.data.type === "audio" && event.data.buffer) {
          optionsRef.current.onAudioChunk(event.data.buffer);
        }
      };

      // Connect the audio pipeline
      const sourceNode = audioContext.createMediaStreamSource(stream);
      sourceNodeRef.current = sourceNode;

      sourceNode.connect(workletNode);
      // Don't connect workletNode to destination - we don't want to hear ourselves

      isCapturingRef.current = true;
      setIsCapturing(true);
      console.log("Audio capture started with AudioWorklet");
    } catch (error) {
      console.error("Failed to start audio capture:", error);
      optionsRef.current.onError?.(
        error instanceof Error ? error : new Error("Failed to start audio capture")
      );
    }
  }, []);

  // Fallback using ScriptProcessor for browsers without AudioWorklet support
  const startWithScriptProcessor = async (
    audioContext: AudioContext,
    stream: MediaStream
  ) => {
    const sourceNode = audioContext.createMediaStreamSource(stream);
    sourceNodeRef.current = sourceNode;

    // Calculate buffer size for ~200ms at native sample rate
    const nativeSampleRate = audioContext.sampleRate;
    const bufferSize = 4096; // Standard buffer size

    // Create ScriptProcessor
    const scriptProcessor = audioContext.createScriptProcessor(bufferSize, 1, 1);

    // Resampling state
    const targetSampleRate = AUDIO_INPUT.TARGET_SAMPLE_RATE;
    const resampleRatio = nativeSampleRate / targetSampleRate;
    const samplesPerChunk = Math.floor((targetSampleRate * ASR_AUDIO_CHUNK.DURATION_MS) / 1000);

    const buffer = new Float32Array(samplesPerChunk * 2);
    let bufferIndex = 0;
    let resampleIndex = 0;

    scriptProcessor.onaudioprocess = (e) => {
      const inputData = e.inputBuffer.getChannelData(0);

      // Resample using linear interpolation
      while (resampleIndex < inputData.length) {
        const srcIndexFloor = Math.floor(resampleIndex);
        const srcIndexCeil = Math.min(srcIndexFloor + 1, inputData.length - 1);
        const fraction = resampleIndex - srcIndexFloor;

        const sample = inputData[srcIndexFloor] * (1 - fraction) +
                       inputData[srcIndexCeil] * fraction;

        buffer[bufferIndex++] = sample;
        resampleIndex += resampleRatio;

        // Output chunk when buffer is full
        if (bufferIndex >= samplesPerChunk) {
          // Convert to PCM 16-bit
          const pcmBuffer = new ArrayBuffer(samplesPerChunk * 2);
          const pcmView = new DataView(pcmBuffer);

          for (let i = 0; i < samplesPerChunk; i++) {
            const s = Math.max(-1, Math.min(1, buffer[i]));
            const value = s < 0 ? s * 0x8000 : s * 0x7fff;
            pcmView.setInt16(i * 2, value, true);
          }

          optionsRef.current.onAudioChunk(pcmBuffer);

          // Move remaining samples
          const remaining = bufferIndex - samplesPerChunk;
          if (remaining > 0) {
            buffer.copyWithin(0, samplesPerChunk, bufferIndex);
          }
          bufferIndex = remaining;
        }
      }

      resampleIndex -= inputData.length;
    };

    sourceNode.connect(scriptProcessor);
    scriptProcessor.connect(audioContext.destination);

    // Store reference for cleanup (using generic approach)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (audioContextRef.current as any)._scriptProcessor = scriptProcessor;

    isCapturingRef.current = true;
    setIsCapturing(true);
    console.log("Audio capture started with ScriptProcessor fallback");
  };

  const stop = useCallback(() => {
    // Only log if actually capturing
    if (mediaStreamRef.current || workletNodeRef.current || audioContextRef.current) {
      console.log("Stopping audio capture...");
    }

    // Disconnect worklet
    if (workletNodeRef.current) {
      workletNodeRef.current.disconnect();
      workletNodeRef.current = null;
    }

    // Disconnect source
    if (sourceNodeRef.current) {
      sourceNodeRef.current.disconnect();
      sourceNodeRef.current = null;
    }

    // Stop media stream tracks
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }

    // Close audio context
    if (audioContextRef.current) {
      // Clean up ScriptProcessor if using fallback
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const scriptProcessor = (audioContextRef.current as any)._scriptProcessor;
      if (scriptProcessor) {
        scriptProcessor.disconnect();
      }

      if (audioContextRef.current.state !== "closed") {
        audioContextRef.current.close();
      }
      audioContextRef.current = null;
    }

    const wasCapturing = isCapturingRef.current;
    isCapturingRef.current = false;
    setIsCapturing(false);
    if (wasCapturing) {
      console.log("Audio capture stopped");
    }
  }, []);

  // Store stop in ref for cleanup
  const stopRef = useRef(stop);
  useEffect(() => {
    stopRef.current = stop;
  }, [stop]);

  // Cleanup on unmount only (empty deps)
  useEffect(() => {
    return () => {
      stopRef.current();
    };
  }, []);

  return {
    isCapturing,
    start,
    stop,
  };
}
