/**
 * useVolcengineRTCVoice Hook
 *
 * Integrates with Volcengine RTC Web SDK for AI Audio/Video Interaction
 * This is a prototype implementation for testing Function Calling
 */

import { useState, useCallback, useRef, useEffect } from "react";
import VERTC from "@volcengine/rtc";
import type { IRTCEngine } from "@volcengine/rtc";
import type {
  VoiceInteractionState,
  UseVoiceInteractionOptions,
  UseVoiceInteractionReturn,
  ToolDefinition,
} from "./types";

interface RTCCallbackData {
  subtitles: Array<{
    type: "subtitle";
    taskId: string;
    role: "user" | "assistant";
    text: string;
    isFinal: boolean;
    timestamp: number;
  }>;
  functionCalls: Array<{
    type: "function_call";
    taskId: string;
    callId: string;
    functionName: string;
    arguments: string;
    timestamp: number;
  }>;
}

// Default tools for math tutoring
const DEFAULT_TOOLS: ToolDefinition[] = [
  {
    type: "function",
    name: "use_whiteboard",
    description:
      "在白板上展示数学公式或函数图像。formula类型用于展示LaTeX公式，graph类型用于绘制函数图像。",
    parameters: {
      type: "object",
      properties: {
        content_type: {
          type: "string",
          enum: ["formula", "graph"],
          description: "内容类型：formula(公式)或graph(函数图)",
        },
        content: {
          type: "string",
          description: "LaTeX格式的公式内容（仅formula类型需要）",
        },
        expression: {
          type: "string",
          description: "函数表达式，如 y = x^2（仅graph类型需要）",
        },
      },
      required: ["content_type"],
    },
  },
  {
    type: "function",
    name: "resume_video",
    description: "恢复视频播放。当学生表示理解了、听懂了、想继续看视频时调用。",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },
];

export function useVolcengineRTCVoice(
  options: UseVoiceInteractionOptions
): UseVoiceInteractionReturn {
  const {
    videoContext,
    videoId,
    onSpeechStart,
    onSpeechEnd,
    onTranscript,
    onAnswer,
    onAnswerComplete,
    onToolCall,
    onResumeVideo,
  } = options;

  // State
  const [state, setState] = useState<VoiceInteractionState>("idle");
  const [isConnected, setIsConnected] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPushToTalk, setIsPushToTalk] = useState(false);
  const [isPushToTalkActive, setIsPushToTalkActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Refs
  const engineRef = useRef<IRTCEngine | null>(null);
  const roomIdRef = useRef<string>("");
  const userIdRef = useRef<string>("");
  const taskIdRef = useRef<string>("");
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastPollTimeRef = useRef<number>(0);
  const processedCallsRef = useRef<Set<string>>(new Set());

  // Generate unique IDs
  const generateId = () =>
    `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  // Poll for callbacks
  const pollCallbacks = useCallback(async () => {
    if (!taskIdRef.current) return;

    try {
      const response = await fetch(
        `/api/voice/rtc-callback?taskId=${taskIdRef.current}&since=${lastPollTimeRef.current}`
      );
      if (!response.ok) return;

      const data: RTCCallbackData = await response.json();
      lastPollTimeRef.current = Date.now();

      // Process subtitles
      for (const subtitle of data.subtitles) {
        if (subtitle.role === "user") {
          onTranscript?.(subtitle.text, subtitle.isFinal);
        } else {
          onAnswer?.(subtitle.text);
          if (subtitle.isFinal) {
            onAnswerComplete?.(subtitle.text);
          }
        }
      }

      // Process function calls
      for (const fc of data.functionCalls) {
        // Skip already processed calls
        if (processedCallsRef.current.has(fc.callId)) continue;
        processedCallsRef.current.add(fc.callId);

        console.log(`[RTC] Function call: ${fc.functionName}`, fc.arguments);

        try {
          const args = JSON.parse(fc.arguments);
          onToolCall?.(fc.functionName, args, fc.callId);

          // Handle special tools
          if (fc.functionName === "resume_video") {
            onResumeVideo?.();
          }
        } catch (e) {
          console.error("[RTC] Failed to parse function call arguments:", e);
        }
      }
    } catch (err) {
      console.error("[RTC] Poll error:", err);
    }
  }, [onTranscript, onAnswer, onAnswerComplete, onToolCall, onResumeVideo]);

  // Connect to RTC room
  const connect = useCallback(async () => {
    try {
      setState("connecting");
      setError(null);

      console.log("[RTC] Starting connection...");

      // Get app ID
      const appId = process.env.NEXT_PUBLIC_VOLCENGINE_RTC_APP_ID;
      if (!appId) {
        throw new Error("NEXT_PUBLIC_VOLCENGINE_RTC_APP_ID not configured");
      }

      console.log("[RTC] App ID:", appId);

      // Generate IDs
      roomIdRef.current = `room-${videoId || generateId()}`;
      userIdRef.current = `user-${generateId()}`;
      taskIdRef.current = `task-${generateId()}`;

      console.log("[RTC] Room ID:", roomIdRef.current);
      console.log("[RTC] User ID:", userIdRef.current);
      console.log("[RTC] Task ID:", taskIdRef.current);

      // Get RTC token
      console.log("[RTC] Getting token...");
      const tokenResponse = await fetch("/api/voice/rtc-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomId: roomIdRef.current,
          userId: userIdRef.current,
        }),
      });

      if (!tokenResponse.ok) {
        const err = await tokenResponse.json();
        throw new Error(`Failed to get RTC token: ${err.error}`);
      }

      const { token } = await tokenResponse.json();
      console.log("[RTC] Token received");

      // Create RTC engine
      console.log("[RTC] Creating engine...");
      const engine = createEngine(appId);
      engineRef.current = engine;

      // Set up event handlers
      engine.on(VERTC.events.onUserJoined, (event: { userInfo: { userId: string } }) => {
        console.log("[RTC] User joined:", event.userInfo.userId);
        if (event.userInfo.userId.startsWith("BotUser_")) {
          setIsSpeaking(true);
          setState("speaking");
        }
      });

      engine.on(VERTC.events.onUserLeave, (event: { userInfo: { userId: string } }) => {
        console.log("[RTC] User left:", event.userInfo.userId);
        if (event.userInfo.userId.startsWith("BotUser_")) {
          setIsSpeaking(false);
          setState("listening");
        }
      });

      engine.on(
        VERTC.events.onError,
        (event: { errorCode: number }) => {
          console.error("[RTC] Error:", event.errorCode);
          setError(`RTC Error: ${event.errorCode}`);
        }
      );

      engine.on(
        VERTC.events.onRoomStateChanged,
        (event: { state: number; errorCode: number }) => {
          console.log(
            "[RTC] Room state changed:",
            event.state,
            event.errorCode
          );
        }
      );

      // Join room
      console.log("[RTC] Joining room...");
      try {
        await engine.joinRoom(
          token,
          roomIdRef.current,
          { userId: userIdRef.current },
          {
            isAutoPublish: true,
            isAutoSubscribeAudio: true,
            isAutoSubscribeVideo: false,
          }
        );
        console.log("[RTC] Joined room successfully");
      } catch (joinError) {
        console.error("[RTC] Failed to join room:", joinError);
        throw new Error(`Failed to join room: ${joinError}`);
      }

      // Start voice chat
      console.log("[RTC] Starting voice chat...");
      const startResponse = await fetch("/api/voice/start-voice-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomId: roomIdRef.current,
          userId: userIdRef.current,
          taskId: taskIdRef.current,
          systemPrompt: `你是一个友好的数学老师，正在帮助初中生学习数学。
当前视频上下文：${videoContext}

你可以使用以下工具：
1. use_whiteboard - 在白板上展示公式或函数图
2. resume_video - 恢复视频播放

回答要简洁，不超过100字。`,
          welcomeMessage: "你好！我是你的数学小助手，有什么问题可以问我哦！",
          tools: DEFAULT_TOOLS,
        }),
      });

      if (!startResponse.ok) {
        const err = await startResponse.json();
        throw new Error(err.error || "Failed to start voice chat");
      }

      const startResult = await startResponse.json();
      console.log("[RTC] Voice chat started:", startResult);

      // Start audio capture
      console.log("[RTC] Starting audio capture...");
      try {
        await engine.startAudioCapture();
        console.log("[RTC] Audio capture started");
      } catch (audioError) {
        console.error("[RTC] Failed to start audio capture:", audioError);
        // Continue anyway, user might need to grant permission
      }

      // Start polling for callbacks
      pollIntervalRef.current = setInterval(pollCallbacks, 500);

      setIsConnected(true);
      setIsListening(true);
      setState("listening");

      onSpeechStart?.();
      console.log("[RTC] Connection complete!");
    } catch (err) {
      console.error("[RTC] Connect error:", err);
      setError(String(err));
      setState("error");
      // Don't call disconnect here to avoid triggering onSpeechEnd
      // Just clean up what we can
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      throw err;
    }
  }, [videoContext, videoId, pollCallbacks, onSpeechStart]);

  // Disconnect from RTC room
  const disconnect = useCallback(async () => {
    try {
      console.log("[RTC] Disconnecting...");

      // Stop polling
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }

      // Stop voice chat
      if (taskIdRef.current && roomIdRef.current) {
        try {
          await fetch("/api/voice/stop-voice-chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              roomId: roomIdRef.current,
              taskId: taskIdRef.current,
            }),
          });
        } catch (e) {
          console.error("[RTC] Failed to stop voice chat:", e);
        }
      }

      // Leave room and destroy engine
      if (engineRef.current) {
        try {
          engineRef.current.stopAudioCapture();
        } catch (e) {
          console.error("[RTC] Failed to stop audio capture:", e);
        }
        try {
          await engineRef.current.leaveRoom();
        } catch (e) {
          console.error("[RTC] Failed to leave room:", e);
        }
        engineRef.current = null;
      }

      // Reset state
      setIsConnected(false);
      setIsListening(false);
      setIsSpeaking(false);
      setState("idle");
      roomIdRef.current = "";
      userIdRef.current = "";
      taskIdRef.current = "";
      processedCallsRef.current.clear();

      onSpeechEnd?.();
      console.log("[RTC] Disconnected");
    } catch (err) {
      console.error("[RTC] Disconnect error:", err);
    }
  }, [onSpeechEnd]);

  // Start listening (unmute)
  const startListening = useCallback(async () => {
    if (engineRef.current) {
      try {
        await engineRef.current.startAudioCapture();
        setIsListening(true);
        setState("listening");
      } catch (e) {
        console.error("[RTC] Failed to start listening:", e);
      }
    }
  }, []);

  // Stop listening (mute)
  const stopListening = useCallback(() => {
    if (engineRef.current) {
      try {
        engineRef.current.stopAudioCapture();
        setIsListening(false);
      } catch (e) {
        console.error("[RTC] Failed to stop listening:", e);
      }
    }
  }, []);

  // Send text message (not supported in RTC mode)
  const sendTextMessage = useCallback((text: string) => {
    console.warn("[RTC] Text messages not supported in RTC mode:", text);
  }, []);

  // Push to talk
  const startPushToTalk = useCallback(() => {
    setIsPushToTalkActive(true);
    startListening();
  }, [startListening]);

  const stopPushToTalk = useCallback(() => {
    setIsPushToTalkActive(false);
    stopListening();
  }, [stopListening]);

  // Interrupt (not directly supported)
  const interrupt = useCallback(() => {
    console.log("[RTC] Interrupt requested");
    // In RTC mode, speaking to the AI will interrupt it automatically
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isConnected) {
        disconnect();
      }
    };
  }, [isConnected, disconnect]);

  // Log error state
  useEffect(() => {
    if (error) {
      console.error("[RTC] Error state:", error);
    }
  }, [error]);

  return {
    // State
    isConnected,
    isListening,
    isSpeaking,
    isPushToTalk,
    isPushToTalkActive,
    state,

    // Actions
    connect,
    disconnect,
    startListening,
    stopListening,
    sendTextMessage,
    startPushToTalk,
    stopPushToTalk,
    setIsPushToTalk,
    interrupt,
  };
}
