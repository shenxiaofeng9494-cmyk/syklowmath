"use client";

/**
 * useVoiceInteraction Hook
 *
 * Main coordinator hook that orchestrates:
 * - Doubao ASR for speech recognition
 * - Doubao LLM for AI responses
 * - Doubao TTS for speech synthesis
 * - Audio capture and playback
 *
 * Maintains compatibility with the original useRealtimeVoice interface.
 */

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { useAudioCapture } from "./useAudioCapture";
import { useAudioPlayback } from "./useAudioPlayback";
import { useDoubaoASR } from "./useDoubaoASR";
import { useDoubaoTTS } from "./useDoubaoTTS";
import { useDoubaoLLM } from "./useDeepSeekLLM";  // 导入新名称
import type {
  VoiceInteractionState,
  UseVoiceInteractionOptions,
  UseVoiceInteractionReturn,
  VoiceSessionResponse,
  VideoNode,
  SubtitleCue,
} from "./types";

// Tool guides cache (from session initialization)
let guidesCache: Record<string, string> = {};
// Node list cache (for navigation)
let nodeListCache: VideoNode[] = [];

interface JumpTarget {
  time: number;
  text: string;
  source: "subtitle" | "node";
}

export function useVoiceInteraction(options: UseVoiceInteractionOptions): UseVoiceInteractionReturn {
  // State
  const [state, setState] = useState<VoiceInteractionState>("idle");
  const [isConnected, setIsConnected] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPushToTalk, setIsPushToTalk] = useState(true);
  const [isPushToTalkActive, setIsPushToTalkActive] = useState(false);

  // Session config
  const [sessionConfig, setSessionConfig] = useState<VoiceSessionResponse | null>(null);
  // Use ref to store config immediately (state updates are async)
  const sessionConfigRef = useRef<VoiceSessionResponse | null>(null);

  // Refs
  const optionsRef = useRef(options);
  const currentTranscriptRef = useRef("");
  const currentAnswerRef = useRef("");
  // Track connection attempts with a counter (to handle React Strict Mode)
  const connectionAttemptRef = useRef(0);
  const isConnectingRef = useRef(false);
  // Track listening state in ref for use in callbacks
  const isListeningRef = useRef(false);
  // Track whether LLM has completed (for onAllDone detection)
  const llmCompleteRef = useRef(false);
  // Track ASR connection state in ref for use in callbacks
  const asrConnectedRef = useRef(false);

  // Keep options ref up to date
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  // Keep session config ref in sync
  useEffect(() => {
    sessionConfigRef.current = sessionConfig;
  }, [sessionConfig]);

  // Keep listening ref in sync
  useEffect(() => {
    isListeningRef.current = isListening;
  }, [isListening]);

  // LLM config
  const llmConfig = useMemo(() => ({
    systemPrompt: sessionConfigRef.current?.systemPrompt || sessionConfig?.systemPrompt || "",
    tools: sessionConfigRef.current?.tools || sessionConfig?.tools || [],
    guides: sessionConfigRef.current?.guides || sessionConfig?.guides || {},
    nodeList: sessionConfigRef.current?.nodeList || sessionConfig?.nodeList || [],
  }), [sessionConfig]);

  // Audio playback
  const playback = useAudioPlayback({
    onPlaybackStart: () => {
      setIsSpeaking(true);
      setState("speaking");
    },
    onPlaybackEnd: () => {
      setIsSpeaking(false);
      // Return to listening state after speaking
      if (isListening) {
        setState("ready");
      }
      // If LLM is complete and playback just ended, all audio has been played
      if (llmCompleteRef.current) {
        console.log("[useVoiceInteraction] LLM complete + playback ended → onAllDone");
        llmCompleteRef.current = false;
        optionsRef.current.onAllDone?.();
      }
    },
  });

  // ASR (now uses backend proxy - no config needed)
  const asr = useDoubaoASR({
    onResult: (text, isFinal) => {
      console.log("ASR result:", { text, isFinal });

      if (isFinal && text) {
        // Guard: ignore duplicate final results after we've already sent to LLM
        if (!isListeningRef.current) {
          console.log("[VoiceInteraction] ASR final result ignored (already stopped listening)");
          return;
        }

        console.log("[VoiceInteraction] ASR final result, sending to LLM:", text);
        currentTranscriptRef.current = text;
        optionsRef.current.onTranscript?.(text, true);

        // Stop listening immediately to prevent duplicate LLM calls
        isListeningRef.current = false;

        // Send to LLM
        llmCompleteRef.current = false; // Reset for new conversation turn
        setState("thinking");
        llm.send(text);
      } else {
        console.log("[VoiceInteraction] ASR interim result:", text);
        optionsRef.current.onTranscript?.(text, false);
      }
    },
    onConnected: () => {
      console.log("ASR connected");
      asrConnectedRef.current = true;
    },
    onDisconnected: () => {
      console.log("ASR disconnected");
      asrConnectedRef.current = false;
    },
    onError: (error) => {
      console.error("ASR error:", error);
      setState("error");
    },
  });

  // TTS (now uses backend proxy - no config needed)
  const tts = useDoubaoTTS({
    onAudio: (audioData) => {
      playback.enqueue(audioData);
    },
    onSpeakStart: () => {
      console.log("TTS speaking started");
    },
    onSpeakEnd: () => {
      console.log("TTS speaking ended");
    },
    onConnected: () => {
      console.log("TTS connected");
    },
    onDisconnected: () => {
      console.log("TTS disconnected");
    },
    onError: (error) => {
      console.error("TTS error:", error);
    },
  });

  // Handle tool calls
  const handleToolCall = useCallback((toolCall: { id: string; name: string; arguments: string }) => {
    console.log("Tool call:", toolCall);
    const opts = optionsRef.current;

    try {
      const args = JSON.parse(toolCall.arguments || "{}");

      if (toolCall.name === "resume_video") {
        opts.onResumeVideo?.();
        return JSON.stringify({ success: true, message: "视频已恢复" });
      }

      if (toolCall.name === "load_tool_guide") {
        const guideName = args.guide_name as string;
        const guideContent = guidesCache[guideName];

        if (guideContent) {
          return JSON.stringify({
            success: true,
            guide_name: guideName,
            message: `已加载 ${guideName} 工具使用指南，请按照以下说明使用工具：\n\n${guideContent}`,
          });
        } else {
          return JSON.stringify({
            success: false,
            error: `工具指南 ${guideName} 未找到`,
          });
        }
      }

      if (toolCall.name === "jump_to_video_node") {
        const query = args.query as string;
        let jumpTarget: JumpTarget | null = null;
        const subtitles = opts.subtitles || [];

        // Search in subtitles first
        if (subtitles.length > 0 && query) {
          const queryLower = query.toLowerCase();
          const queryWords = query.split(/[，、\s]+/).filter(w => w.length > 1);

          let bestMatch: { cue: SubtitleCue; score: number } | null = null;

          for (const cue of subtitles) {
            const textLower = cue.text.toLowerCase();
            let score = 0;

            if (textLower.includes(queryLower)) {
              score = 10;
            } else {
              for (const word of queryWords) {
                if (textLower.includes(word.toLowerCase())) {
                  score += 2;
                }
              }
            }

            if (score > 0 && (!bestMatch || score > bestMatch.score)) {
              bestMatch = { cue, score };
            }
          }

          if (bestMatch && bestMatch.score >= 2) {
            jumpTarget = {
              time: bestMatch.cue.start,
              text: bestMatch.cue.text,
              source: "subtitle",
            };
          }
        }

        // Search in node list
        if (!jumpTarget && nodeListCache.length > 0 && query) {
          const queryLower = query.toLowerCase();
          let targetNode = nodeListCache.find(node =>
            node.title.toLowerCase().includes(queryLower)
          ) || null;

          if (!targetNode) {
            for (const node of nodeListCache) {
              const titleWords = node.title.split(/[，、：\s]+/);
              const queryWords = query.split(/[，、\s]+/);
              const hasMatch = queryWords.some(qw =>
                titleWords.some(tw => tw.includes(qw) || qw.includes(tw))
              );
              if (hasMatch) {
                targetNode = node;
                break;
              }
            }
          }

          if (targetNode) {
            jumpTarget = {
              time: targetNode.startTime,
              text: targetNode.title,
              source: "node",
            };
          }
        }

        if (jumpTarget) {
          opts.onJumpToTime?.(jumpTarget.time);
          const startMin = Math.floor(jumpTarget.time / 60);
          const startSec = Math.floor(jumpTarget.time % 60);
          return JSON.stringify({
            success: true,
            jumped_to: jumpTarget.text,
            start_time: `${startMin}:${startSec.toString().padStart(2, "0")}`,
            source: jumpTarget.source,
            message: `已跳转到「${jumpTarget.text}」(${startMin}:${startSec.toString().padStart(2, "0")})`,
          });
        } else {
          return JSON.stringify({
            success: false,
            error: "没有找到相关内容，请描述得更具体一些",
            available_nodes: nodeListCache.map(n => n.title),
          });
        }
      }

      // Other tool calls (use_whiteboard, etc.)
      opts.onToolCall?.(toolCall.name, args, toolCall.id);
      return JSON.stringify({ success: true, message: "已展示" });
    } catch (e) {
      console.error("Failed to handle tool call:", e);
      return JSON.stringify({ success: false, error: "工具调用失败" });
    }
  }, []);

  // LLM
  const llm = useDoubaoLLM({
    config: llmConfig,
    onContent: (text) => {
      console.log("[useVoiceInteraction] LLM onContent:", text.substring(0, 30));
      currentAnswerRef.current += text;
      optionsRef.current.onAnswer?.(text);

      // Queue text for TTS — split by punctuation or character count for fast first-audio
      const accumulated = currentAnswerRef.current;
      const hasPunctuation = /[。？！，；,;：:、]/.test(text);
      // Send to TTS when: punctuation found (natural break) OR accumulated >= 12 chars (reduce wait)
      if (hasPunctuation || accumulated.length >= 12) {
        console.log("[useVoiceInteraction] Queueing TTS, length:", accumulated.length, hasPunctuation ? "(punct)" : "(threshold)");
        tts.queueText(accumulated);
        currentAnswerRef.current = "";
      }
    },
    onToolCall: (toolCall) => {
      const result = handleToolCall(toolCall);
      llm.addToolResult(toolCall.id, result);
    },
    onComplete: () => {
      console.log("[useVoiceInteraction] LLM onComplete called, remaining text length:", currentAnswerRef.current.length);
      // Speak any remaining text
      if (currentAnswerRef.current) {
        tts.queueText(currentAnswerRef.current);
        currentAnswerRef.current = "";
      }
      // Mark LLM as done — onAllDone will fire when playback also finishes
      llmCompleteRef.current = true;
      console.log("[useVoiceInteraction] Calling optionsRef.current.onComplete");
      optionsRef.current.onComplete?.();
    },
    onError: (error) => {
      console.error("LLM error:", error);
      setState("error");
    },
  });

  // Audio capture
  const capture = useAudioCapture({
    onAudioChunk: (chunk) => {
      // Use refs to get current state (callback is cached)
      const listening = isListeningRef.current;
      const asrConnected = asrConnectedRef.current;

      if (listening && asrConnected) {
        asr.sendAudio(chunk);
      } else {
        console.log("Audio chunk skipped:", { listening, asrConnected, chunkSize: chunk.byteLength });
      }
    },
    onError: (error) => {
      console.error("Audio capture error:", error);
    },
  });

  // Connect - initialize session
  const connect = useCallback(async () => {
    // Check if already connected or connecting
    if (isConnected) {
      console.log("Already connected");
      return;
    }

    if (isConnectingRef.current) {
      console.log("Already connecting");
      return;
    }

    // Increment connection attempt counter
    connectionAttemptRef.current += 1;
    const thisAttempt = connectionAttemptRef.current;

    isConnectingRef.current = true;
    setState("connecting");

    try {
      // Fetch session configuration
      const response = await fetch("/api/voice/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoContext: optionsRef.current.videoContext,
          videoId: optionsRef.current.videoId,
          currentTime: optionsRef.current.currentTime,
          studentId: optionsRef.current.studentId, // V2 自适应：传递学生ID获取画像
          learningSessionId: optionsRef.current.learningSessionId, // 跨模式上下文共享
          interventionConfig: optionsRef.current.interventionConfig, // 介入模式配置（含动态问题）
        }),
      });

      // Check if this connection attempt is still valid
      if (thisAttempt !== connectionAttemptRef.current) {
        console.log("Connection attempt superseded by newer attempt");
        isConnectingRef.current = false;
        return;
      }

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to create session: ${error}`);
      }

      const config: VoiceSessionResponse = await response.json();

      // Set ref immediately (synchronous) so hooks can access config right away
      sessionConfigRef.current = config;
      setSessionConfig(config);

      // Cache guides and nodes
      guidesCache = config.guides;
      nodeListCache = config.nodeList;

      // Check again if this attempt is still valid
      if (thisAttempt !== connectionAttemptRef.current) {
        console.log("Connection attempt superseded after session config");
        isConnectingRef.current = false;
        return;
      }

      // In intervention mode, skip eager TTS connect — it would idle for 30+ seconds
      // while interventionTTS plays the question and student answers. The internal TTS
      // auto-reconnects on demand when LLM responds (via processQueue in useDoubaoTTS).
      // In normal mode, connect TTS eagerly for fast first response.
      if (optionsRef.current.interventionConfig) {
        console.log("Session config received (intervention mode), skipping eager TTS connect");
      } else {
        console.log("Session config received, connecting TTS (ASR deferred to startListening)...");
        await tts.connect();
      }

      // Final check before setting connected state
      if (thisAttempt !== connectionAttemptRef.current) {
        console.log("Connection attempt superseded after TTS connect");
        tts.disconnect();
        isConnectingRef.current = false;
        return;
      }

      isConnectingRef.current = false;
      setIsConnected(true);
      setState("ready");

      console.log("Voice interaction connected");
    } catch (error) {
      console.error("Failed to connect:", error);
      isConnectingRef.current = false;
      // Only set error state if this is still the current attempt
      if (thisAttempt === connectionAttemptRef.current) {
        setState("error");
      }
      throw error;
    }
  }, [isConnected, asr, tts]);

  // Disconnect
  const disconnect = useCallback(() => {
    // Only perform cleanup if we're actually connected
    // This prevents React Strict Mode cleanup from closing in-progress connections
    if (!isConnected) {
      return;
    }

    connectionAttemptRef.current += 1;
    console.log("Disconnecting voice interaction...");

    isConnectingRef.current = false;

    capture.stop();
    asr.disconnect();
    tts.disconnect();
    llm.abort();
    playback.clear();

    setIsConnected(false);
    setIsListening(false);
    setIsSpeaking(false);
    setState("idle");
  }, [isConnected, capture, asr, tts, llm, playback]);

  // Start listening (microphone)
  const startListening = useCallback(async () => {
    // Use ref instead of state to avoid stale closure (e.g. called from onPlaybackEnd callback)
    if (!sessionConfigRef.current) {
      console.error("Not connected (no session config)");
      return;
    }

    try {
      // Connect ASR just-in-time (deferred from connect() to avoid timeout)
      if (!asr.isConnected) {
        console.log("Connecting ASR just-in-time before listening...");
        await asr.connect();
      }

      // Set ref BEFORE starting capture so audio chunks are sent immediately
      isListeningRef.current = true;
      await capture.start();
      setIsListening(true);
      setState("ready");
      console.log("Now listening...");
    } catch (error) {
      isListeningRef.current = false;
      console.error("Failed to start listening:", error);
      throw error;
    }
  }, [capture, asr]);

  // Stop listening
  const stopListening = useCallback(() => {
    isListeningRef.current = false;
    capture.stop();
    asr.endAudio();
    setIsListening(false);
  }, [capture, asr]);

  // Push to talk
  const startPushToTalk = useCallback(() => {
    console.log("Push to talk: START");
    setIsPushToTalkActive(true);
    setState("listening");
    optionsRef.current.onSpeechStart?.();
  }, []);

  const stopPushToTalk = useCallback(() => {
    console.log("Push to talk: STOP");
    setIsPushToTalkActive(false);
    asr.endAudio();
    optionsRef.current.onSpeechEnd?.();
  }, [asr]);

  // Send text message
  const sendTextMessage = useCallback((text: string) => {
    if (!sessionConfigRef.current) {
      console.error("Not connected (no session config)");
      return;
    }

    console.log("Sending text message:", text);
    optionsRef.current.onTranscript?.(text, true);

    setState("thinking");
    llm.send(text);
  }, [llm]);

  // Update session config without reconnecting (for intervention mode optimization)
  // This allows changing the LLM systemPrompt/tools in-place, triggering
  // the useDeepSeekLLM hook to reinitialize history with the new prompt.
  const updateSessionConfig = useCallback((updates: Partial<Pick<VoiceSessionResponse, 'systemPrompt' | 'tools'>>) => {
    console.log("[useVoiceInteraction] Updating session config in-place (no reconnect)");
    setSessionConfig(prev => {
      if (!prev) return prev;
      const updated = { ...prev, ...updates };
      sessionConfigRef.current = updated;
      return updated;
    });
  }, []);

  // Interrupt
  const interrupt = useCallback(() => {
    console.log("Interrupting...");

    // Cancel TTS
    tts.cancel();

    // Clear playback
    playback.clear();

    // Abort LLM
    llm.abort();

    // Reset answer
    currentAnswerRef.current = "";

    setIsSpeaking(false);
    setState("ready");
  }, [tts, playback, llm]);

  // Store disconnect in ref for cleanup
  const disconnectRef = useRef(disconnect);
  useEffect(() => {
    disconnectRef.current = disconnect;
  }, [disconnect]);

  // Cleanup on unmount only (empty deps)
  useEffect(() => {
    return () => {
      disconnectRef.current();
    };
  }, []);

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

    // Interrupt
    interrupt,

    // Session config update (no reconnect)
    updateSessionConfig,
  };
}
