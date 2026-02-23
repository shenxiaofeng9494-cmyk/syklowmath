"use client";

/**
 * useDoubaoRealtimeVoice Hook
 *
 * Connects to Doubao Realtime (S2S) via backend proxy.
 * Uses polling to fetch events and audio, and streams microphone audio.
 * Supports Function Calling for tool invocations.
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { useAudioCapture } from "./useAudioCapture";
import { useAudioPlayback } from "./useAudioPlayback";
import { arrayBufferToBase64 } from "./doubao-protocol";
import type { UseVoiceInteractionOptions, ToolDefinition, VideoNode } from "./types";

const REALTIME_PROXY_URL = "/api/voice/doubao-realtime";

// Heartbeat interval to prevent DialogAudioIdleTimeoutError (60s server timeout)
// Send silent audio every 30 seconds to keep connection alive
const HEARTBEAT_INTERVAL_MS = 30000;

// Generate a silent audio chunk (200ms of silence at 16kHz, 16-bit PCM)
function generateSilentAudioChunk(): ArrayBuffer {
  const sampleRate = 16000;
  const durationMs = 200;
  const samples = Math.floor((sampleRate * durationMs) / 1000);
  const buffer = new ArrayBuffer(samples * 2); // 16-bit = 2 bytes per sample
  // Buffer is already initialized to zeros, which represents silence
  return buffer;
}

// Event IDs from Doubao Realtime API
const EVENTS = {
  ASR_INFO: 450,
  ASR_RESPONSE: 451,
  ASR_ENDED: 459,
  CHAT_RESPONSE: 550,
  FUNCTION_CALL: 551,
  CHAT_ENDED: 559,
  TTS_RESPONSE: 352,
  TTS_ENDED: 359,
} as const;

type RealtimeEvent = {
  eventId: number;
  payload?: Record<string, unknown>;
  audioBase64?: string;
};

// Check if transcript is a video resume command (short utterances only)
const RESUME_PATTERN = /继续(视频|看|播放|吧)?|好了|懂了|可以了|知道了|行了/;
function isResumeCommand(text: string): boolean {
  return text.length < 15 && RESUME_PATTERN.test(text);
}

interface SessionConfig {
  systemPrompt: string;
  tools: ToolDefinition[];
  guides: Record<string, string>;
  nodeList: VideoNode[];
}

interface UseDoubaoRealtimeVoiceReturn {
  isConnected: boolean;
  isListening: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
  startListening: () => Promise<void>;
  stopListening: () => void;
  sendTextMessage: (text: string) => void;
}

export function useDoubaoRealtimeVoice(options: UseVoiceInteractionOptions): UseDoubaoRealtimeVoiceReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [isListening, setIsListening] = useState(false);

  const sessionIdRef = useRef<string | null>(null);
  const optionsRef = useRef(options);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioQueueRef = useRef<ArrayBuffer[]>([]);
  const sendingRef = useRef(false);
  const currentAnswerRef = useRef("");
  const currentUserMessageRef = useRef("");
  const pollErrorCountRef = useRef(0); // Track consecutive poll errors for auto-reconnect
  const sessionConfigRef = useRef<SessionConfig | null>(null);
  const toolDetectionTriggeredRef = useRef(false); // Prevent duplicate detection
  const disconnectingRef = useRef(false); // Prevent audio enqueue during disconnect
  const lastAudioSentTimeRef = useRef<number>(0); // Track last audio sent time for heartbeat

  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  const playback = useAudioPlayback();

  // Detect tools using DeepSeek Chat (fallback for when Doubao doesn't trigger Function Calling)
  const detectAndExecuteTools = useCallback(async (aiResponse: string, userMessage: string) => {
    try {
      console.log("=== Calling tool detection API ===");
      const response = await fetch("/api/voice/tool-detect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aiResponse, userMessage }),
      });

      if (!response.ok) {
        console.error("Tool detection API failed:", response.status);
        return;
      }

      const { toolCalls } = await response.json();
      console.log("Tool detection response:", toolCalls);

      if (toolCalls && toolCalls.length > 0) {
        for (const call of toolCalls) {
          console.log("Executing tool call:", call.name, call.arguments);

          if (call.name === "resume_video") {
            console.log("Calling onResumeVideo");
            optionsRef.current.onResumeVideo?.();
          } else if (call.name === "use_whiteboard") {
            console.log("Calling onToolCall for whiteboard");
            optionsRef.current.onToolCall?.(call.name, call.arguments, call.id || "deepseek-" + Date.now());
          } else if (call.name === "use_drawing_board") {
            console.log("Calling onToolCall for drawing board");
            optionsRef.current.onToolCall?.(call.name, call.arguments, call.id || "deepseek-" + Date.now());
          } else if (call.name === "jump_to_video_node") {
            const query = call.arguments?.query as string;
            const nodeList = sessionConfigRef.current?.nodeList || [];
            const matchedNode = nodeList.find(n =>
              n.title.includes(query) || query.includes(n.title)
            );
            if (matchedNode) {
              console.log("Calling onJumpToTime:", matchedNode.startTime);
              optionsRef.current.onJumpToTime?.(matchedNode.startTime);
            }
          }
        }
      } else {
        console.log("No tool calls detected");
      }
    } catch (error) {
      console.error("Tool detection error:", error);
    }
  }, []);

  // Send function call result back to Doubao
  const sendFunctionResult = useCallback(async (callId: string, result: string) => {
    if (!sessionIdRef.current) return;

    try {
      await fetch(REALTIME_PROXY_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "function_result",
          sessionId: sessionIdRef.current,
          callId,
          result,
        }),
      });
    } catch (error) {
      console.error("Failed to send function result:", error);
    }
  }, []);

  // Handle tool calls
  const handleToolCall = useCallback(async (
    name: string,
    args: Record<string, unknown>,
    callId: string
  ) => {
    console.log("Doubao Realtime tool call:", name, args, callId);

    // Handle special tools internally
    if (name === "resume_video") {
      optionsRef.current.onResumeVideo?.();
      await sendFunctionResult(callId, "视频已恢复播放");
      return;
    }

    if (name === "jump_to_video_node") {
      const query = args.query as string;
      const nodeList = sessionConfigRef.current?.nodeList || [];

      // Find matching node
      const matchedNode = nodeList.find(n =>
        n.title.includes(query) || query.includes(n.title)
      );

      if (matchedNode) {
        optionsRef.current.onJumpToTime?.(matchedNode.startTime);
        await sendFunctionResult(callId, `已跳转到：${matchedNode.title}`);
      } else {
        await sendFunctionResult(callId, `未找到匹配的知识点：${query}`);
      }
      return;
    }

    if (name === "load_tool_guide") {
      const guideName = args.guide_name as string;
      const guides = sessionConfigRef.current?.guides || {};
      const guide = guides[guideName];

      if (guide) {
        await sendFunctionResult(callId, guide);
      } else {
        await sendFunctionResult(callId, `未找到指南：${guideName}`);
      }
      return;
    }

    // For other tools (like use_whiteboard), notify the UI
    optionsRef.current.onToolCall?.(name, args, callId);

    // Send success result for UI-handled tools
    await sendFunctionResult(callId, "success");
  }, [sendFunctionResult]);

  const processEvents = useCallback((events: RealtimeEvent[]) => {
    for (const event of events) {
      // Debug: log all events
      console.log("Doubao Realtime event:", event.eventId, event.payload);

      switch (event.eventId) {
        case EVENTS.ASR_INFO: {
          // User started speaking
          optionsRef.current.onSpeechStart?.();
          break;
        }
        case EVENTS.ASR_RESPONSE: {
          const results = (event.payload?.results as Array<{ text: string; is_interim: boolean }> | undefined) || [];
          for (const result of results) {
            // Resume keyword detection (quick shortcut without waiting for AI)
            if (!result.is_interim && result.text && isResumeCommand(result.text)) {
              console.log('[Realtime] Resume command detected:', result.text);
              optionsRef.current.onTranscript?.(result.text, true);
              optionsRef.current.onResumeVideo?.();
              continue;
            }
            // Forward transcript directly (no gating)
            optionsRef.current.onTranscript?.(result.text, !result.is_interim);
            if (!result.is_interim && result.text) {
              currentUserMessageRef.current = result.text;
            }
          }
          break;
        }
        case EVENTS.ASR_ENDED: {
          optionsRef.current.onSpeechEnd?.();
          break;
        }
        case EVENTS.CHAT_RESPONSE: {
          const content = String(event.payload?.content || "");
          if (content) {
            currentAnswerRef.current += content;
            optionsRef.current.onAnswer?.(content);
          }
          break;
        }
        case EVENTS.FUNCTION_CALL: {
          // Handle function call from Doubao
          const toolCalls = event.payload?.tool_calls as Array<{
            id: string;
            function: { name: string; arguments: string };
          }> | undefined;

          if (toolCalls) {
            for (const call of toolCalls) {
              try {
                const args = JSON.parse(call.function.arguments);
                handleToolCall(call.function.name, args, call.id);
              } catch (e) {
                console.error("Failed to parse function arguments:", e);
              }
            }
          }
          break;
        }
        case EVENTS.CHAT_ENDED: {
          if (currentAnswerRef.current) {
            const answer = currentAnswerRef.current;
            const userMessage = currentUserMessageRef.current;

            // Use Doubao Chat to detect tool calls, then complete the answer
            detectAndExecuteTools(answer, userMessage).then(() => {
              optionsRef.current.onAnswerComplete?.(answer);
              optionsRef.current.onComplete?.();
            });

            currentAnswerRef.current = "";
            currentUserMessageRef.current = "";
          } else {
            optionsRef.current.onComplete?.();
          }
          break;
        }
        case EVENTS.TTS_RESPONSE: {
          // Skip audio if disconnecting
          if (event.audioBase64 && !disconnectingRef.current) {
            const audioBuffer = Uint8Array.from(atob(event.audioBase64), (c) => c.charCodeAt(0)).buffer;
            playback.enqueue(audioBuffer);
          }
          break;
        }
        case EVENTS.TTS_ENDED: {
          break;
        }
        default:
          break;
      }
    }
  }, [playback, handleToolCall, detectAndExecuteTools]);

  const pollEvents = useCallback(async () => {
    if (!sessionIdRef.current) return;

    try {
      const response = await fetch(REALTIME_PROXY_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "events",
          sessionId: sessionIdRef.current,
        }),
      });

      if (!response.ok) {
        throw new Error(`Poll failed: ${response.status}`);
      }

      const data = await response.json();
      pollErrorCountRef.current = 0; // Reset error counter on success

      // Check for fatal session errors (e.g. DialogAudioIdleTimeoutError)
      const isFatalError = data.error && (
        typeof data.error === 'string'
          ? data.error.includes('TimeoutError') || data.error.includes('SessionExpired') || data.error.includes('SessionClosed')
          : (data.error.error && (
              String(data.error.error).includes('TimeoutError') ||
              String(data.error.error).includes('SessionExpired') ||
              String(data.error.error).includes('SessionClosed')
            ))
      );

      if (data.error) {
        console.error("Realtime error:", data.error);
      }

      if (data.events && data.events.length > 0) {
        processEvents(data.events as RealtimeEvent[]);
      }

      if (data.closed || isFatalError) {
        console.warn(`[Realtime] Session dead (closed=${data.closed}, fatalError=${isFatalError}), cleaning up for auto-reconnect`);
        // Clear ALL state so connect() can create a fresh session
        sessionIdRef.current = null;
        audioQueueRef.current = [];
        sendingRef.current = false;
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
        if (heartbeatIntervalRef.current) {
          clearInterval(heartbeatIntervalRef.current);
          heartbeatIntervalRef.current = null;
        }
        // Setting isConnected=false triggers auto-reconnect via VoiceInteraction's isActive effect
        setIsConnected(false);
        setIsListening(false);
      }
    } catch (error) {
      console.error("Realtime poll error:", error);
      pollErrorCountRef.current++;
      // After 5 consecutive poll errors, assume session is dead and clean up
      if (pollErrorCountRef.current >= 5) {
        console.warn(`[Realtime] ${pollErrorCountRef.current} consecutive poll errors, session likely dead. Cleaning up.`);
        sessionIdRef.current = null;
        audioQueueRef.current = [];
        sendingRef.current = false;
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
        if (heartbeatIntervalRef.current) {
          clearInterval(heartbeatIntervalRef.current);
          heartbeatIntervalRef.current = null;
        }
        pollErrorCountRef.current = 0;
        setIsConnected(false);
        setIsListening(false);
      }
    }
  }, [processEvents]);

  const processAudioQueue = useCallback(async () => {
    if (sendingRef.current || audioQueueRef.current.length === 0) return;
    if (!sessionIdRef.current) return;

    sendingRef.current = true;

    while (audioQueueRef.current.length > 0) {
      const audioData = audioQueueRef.current.shift();
      if (!audioData) break;

      try {
        const audioBase64 = arrayBufferToBase64(audioData);
        await fetch(REALTIME_PROXY_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "audio",
            sessionId: sessionIdRef.current,
            audioBase64,
          }),
        });
        // Update last audio sent time
        lastAudioSentTimeRef.current = Date.now();
      } catch (error) {
        console.error("Realtime send audio error:", error);
      }
    }

    sendingRef.current = false;
  }, []);

  // Send heartbeat (silent audio) to keep connection alive
  const sendHeartbeat = useCallback(async () => {
    if (!sessionIdRef.current || disconnectingRef.current) return;

    // Only send heartbeat if no audio was sent recently
    const timeSinceLastAudio = Date.now() - lastAudioSentTimeRef.current;
    if (timeSinceLastAudio < HEARTBEAT_INTERVAL_MS - 5000) {
      // Audio was sent recently, skip heartbeat
      return;
    }

    try {
      const silentAudio = generateSilentAudioChunk();
      const audioBase64 = arrayBufferToBase64(silentAudio);
      await fetch(REALTIME_PROXY_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "audio",
          sessionId: sessionIdRef.current,
          audioBase64,
        }),
      });
      lastAudioSentTimeRef.current = Date.now();
      console.log("Sent heartbeat (silent audio) to keep connection alive");
    } catch (error) {
      console.error("Failed to send heartbeat:", error);
    }
  }, []);

  const capture = useAudioCapture({
    onAudioChunk: (chunk) => {
      if (!isListening || !isConnected) return;
      audioQueueRef.current.push(chunk);
      processAudioQueue();
    },
    onError: (error) => {
      console.error("Audio capture error:", error);
    },
  });

  // Store capture functions in refs to ensure stable references for callbacks
  const captureStartRef = useRef(capture.start);
  const captureStopRef = useRef(capture.stop);
  useEffect(() => {
    captureStartRef.current = capture.start;
    captureStopRef.current = capture.stop;
  }, [capture.start, capture.stop]);

  const connect = useCallback(async () => {
    if (sessionIdRef.current) {
      // Session already exists (e.g. React Strict Mode second mount)
      // Ensure connected state and intervals are properly set up
      console.log('[Realtime] Session already exists, restoring state:', sessionIdRef.current);
      setIsConnected(true);
      if (!pollIntervalRef.current) {
        pollIntervalRef.current = setInterval(pollEvents, 200);
      }
      if (!heartbeatIntervalRef.current) {
        heartbeatIntervalRef.current = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);
      }
      return;
    }

    const sessionResp = await fetch("/api/voice/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        videoContext: optionsRef.current.videoContext,
        videoId: optionsRef.current.videoId,
        currentTime: optionsRef.current.currentTime,
        studentId: optionsRef.current.studentId, // V2 自适应：传递学生ID获取画像
        learningSessionId: optionsRef.current.learningSessionId, // 跨模式上下文共享
        backend: "doubao_realtime", // Specify backend for Doubao Realtime S2S
      }),
    });

    if (!sessionResp.ok) {
      throw new Error(`Failed to init session: ${await sessionResp.text()}`);
    }

    const sessionConfig = await sessionResp.json();

    // Store session config for tool handling
    sessionConfigRef.current = {
      systemPrompt: sessionConfig.systemPrompt,
      tools: sessionConfig.tools,
      guides: sessionConfig.guides,
      nodeList: sessionConfig.nodeList,
    };

    const response = await fetch(REALTIME_PROXY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create",
        systemPrompt: sessionConfig.systemPrompt,
        tools: sessionConfig.tools,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `Create failed: ${response.status}`);
    }

    const data = await response.json();

    if (data.sessionId) {
      sessionIdRef.current = data.sessionId;
      setIsConnected(true);
      lastAudioSentTimeRef.current = Date.now(); // Initialize last audio time
      pollIntervalRef.current = setInterval(pollEvents, 200);
      // Start heartbeat to prevent DialogAudioIdleTimeoutError
      heartbeatIntervalRef.current = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);
      console.log("Started heartbeat interval to keep connection alive");
    } else {
      throw new Error("No session ID returned");
    }
  }, [pollEvents, sendHeartbeat]);

  const disconnect = useCallback(async () => {
    // Set disconnecting flag first to prevent any new audio from being enqueued
    disconnectingRef.current = true;

    // Clear playback immediately to stop any ongoing audio
    playback.clear();

    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }

    // Clear heartbeat interval
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }

    if (sessionIdRef.current) {
      try {
        await fetch(REALTIME_PROXY_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "close",
            sessionId: sessionIdRef.current,
          }),
        });
      } catch (error) {
        console.error("Realtime close error:", error);
      }
    }

    sessionIdRef.current = null;
    audioQueueRef.current = [];
    sendingRef.current = false;

    captureStopRef.current();
    // Clear playback again in case any audio was enqueued during the async operations
    playback.clear();

    setIsConnected(false);
    setIsListening(false);

    // Reset disconnecting flag for potential reconnection
    disconnectingRef.current = false;
  }, [playback]);

  const startListening = useCallback(async () => {
    if (!isConnected) {
      console.error("Not connected");
      return;
    }

    await captureStartRef.current();
    setIsListening(true);
  }, [isConnected]);

  const stopListening = useCallback(() => {
    console.log("useDoubaoRealtimeVoice stopListening called");
    captureStopRef.current();
    setIsListening(false);
  }, []);

  const sendTextMessage = useCallback(async (text: string) => {
    // Use ref instead of state to avoid stale closure after connect() resolves
    if (!sessionIdRef.current) {
      console.error("Not connected (no session)");
      return;
    }

    optionsRef.current.onTranscript?.(text, true);

    await fetch(REALTIME_PROXY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "text",
        sessionId: sessionIdRef.current,
        text,
      }),
    });
  }, []);

  // Restore poll/heartbeat intervals if they were cleared (e.g. by HMR cleanup)
  // but the session is still alive
  useEffect(() => {
    if (isConnected && sessionIdRef.current) {
      if (!pollIntervalRef.current) {
        console.log('[Realtime] Restoring poll interval (lost during HMR/re-mount)');
        pollIntervalRef.current = setInterval(pollEvents, 200);
      }
      if (!heartbeatIntervalRef.current) {
        console.log('[Realtime] Restoring heartbeat interval (lost during HMR/re-mount)');
        heartbeatIntervalRef.current = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);
      }
    }
  }, [isConnected, pollEvents, sendHeartbeat]);

  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
    };
  }, []);

  return {
    isConnected,
    isListening,
    connect,
    disconnect,
    startListening,
    stopListening,
    sendTextMessage,
  };
}
