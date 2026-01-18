"use client";

import { useState, useCallback, useRef, useEffect } from "react";

// API 使用 Next.js API Routes，相对路径即可
const API_BASE = "";

interface ToolCallInfo {
  name: string;
  callId: string;
  params: Record<string, unknown>;
}

interface VideoNode {
  order: number;
  title: string;
  startTime: number;
  endTime: number;
}

interface SubtitleCue {
  start: number;
  end: number;
  text: string;
}

interface JumpTarget {
  time: number;
  text: string;
  source: "subtitle" | "node";
}

interface UseRealtimeVoiceOptions {
  videoContext: string;
  videoId?: string;                    // 视频ID，用于 RAG 检索
  currentTime?: number;                // 当前播放时间
  subtitles?: SubtitleCue[];           // 字幕列表，用于精准跳转
  onSpeechStart?: () => void;          // 检测到用户开始说话
  onSpeechEnd?: () => void;            // 检测到用户说完话
  onTranscript?: (text: string, isFinal: boolean) => void;
  onAnswer?: (text: string) => void;   // 实时回答增量
  onAnswerComplete?: (text: string) => void;  // 完整回答（当实时增量不可用时）
  onToolCall?: (tool: string, params: Record<string, unknown>, callId?: string) => void;
  onComplete?: () => void;
  onResumeVideo?: () => void;          // AI 调用恢复视频
  onJumpToTime?: (time: number) => void;  // AI 调用跳转到精确时间
}

// 工具指南缓存（从 session 初始化时获取）
let guidesCache: Record<string, string> = {};
// 节点列表缓存（从 session 初始化时获取）
let nodeListCache: VideoNode[] = [];

interface RealtimeEvent {
  type: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

export function useRealtimeVoice(options: UseRealtimeVoiceOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPushToTalk, setIsPushToTalk] = useState(true); // 默认开启按键说话模式
  const [isPushToTalkActive, setIsPushToTalkActive] = useState(false); // 当前是否按住

  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const playbackContextRef = useRef<AudioContext | null>(null);
  const playbackQueueRef = useRef<ArrayBuffer[]>([]);
  const isPlayingRef = useRef(false);
  const optionsRef = useRef(options);
  const isPushToTalkActiveRef = useRef(false); // 按键说话是否激活
  const lastToolCallRef = useRef<ToolCallInfo | null>(null); // 最后一次工具调用

  // 保持 options 最新
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  // 播放音频队列
  const playNextAudio = useCallback(async () => {
    if (isPlayingRef.current || playbackQueueRef.current.length === 0) {
      return;
    }

    isPlayingRef.current = true;

    if (!playbackContextRef.current || playbackContextRef.current.state === "closed") {
      playbackContextRef.current = new AudioContext({ sampleRate: 24000 });
    }

    const audioData = playbackQueueRef.current.shift();
    if (!audioData) {
      isPlayingRef.current = false;
      return;
    }

    try {
      // PCM 16-bit to Float32
      const pcmData = new Int16Array(audioData);
      const floatData = new Float32Array(pcmData.length);
      for (let i = 0; i < pcmData.length; i++) {
        floatData[i] = pcmData[i] / 32768;
      }

      const audioBuffer = playbackContextRef.current.createBuffer(
        1,
        floatData.length,
        24000
      );
      audioBuffer.getChannelData(0).set(floatData);

      const source = playbackContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(playbackContextRef.current.destination);
      source.onended = () => {
        isPlayingRef.current = false;
        playNextAudio();
      };
      source.start();
    } catch (e) {
      console.error("Audio playback error:", e);
      isPlayingRef.current = false;
      playNextAudio();
    }
  }, []);

  // 处理 Realtime 事件
  const handleRealtimeEvent = useCallback(
    (event: RealtimeEvent) => {
      const opts = optionsRef.current;

      // 打印所有事件类型，用于调试
      console.log(">>> Event:", event.type);

      // 打印包含 transcript 或 text 的事件详情
      if (event.type.includes("transcript") || event.type.includes("text")) {
        console.log(">>> Event details:", JSON.stringify(event, null, 2));
      }

      switch (event.type) {
        case "session.created":
          console.log("Session created successfully, session:", event.session);
          break;

        case "session.updated":
          console.log("Session updated");
          break;

        case "input_audio_buffer.speech_started":
          // 检测到用户开始说话 - 会自动中断AI回答
          console.log("Speech started - interrupting AI if speaking");
          setIsSpeaking(true);
          // 清空播放队列，停止当前播放
          playbackQueueRef.current = [];
          isPlayingRef.current = false;
          opts.onSpeechStart?.();
          break;

        case "input_audio_buffer.speech_stopped":
          // 检测到用户说完话
          console.log("Speech stopped");
          setIsSpeaking(false);
          opts.onSpeechEnd?.();
          break;

        case "input_audio_buffer.committed":
          console.log("Audio buffer committed");
          break;

        case "conversation.item.created":
          console.log("Conversation item created:", event.item?.type, event.item?.role);
          break;

        case "conversation.item.input_audio_transcription.completed":
          // 用户语音转写完成
          console.log("User transcript:", event.transcript);
          opts.onTranscript?.(event.transcript || "", true);

          // 触发 AI 回复
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            console.log("Triggering AI response...");
            wsRef.current.send(JSON.stringify({
              type: "response.create"
            }));
          }
          break;

        case "response.created":
          console.log("Response created");
          break;

        case "response.output_item.added":
          console.log("Output item added:", event.item?.type);
          break;

        case "response.content_part.added":
          console.log("Content part added:", event.part?.type);
          break;

        case "response.text.delta":
          // 文本回复增量
          console.log(">>> Text delta received:", event.delta);
          opts.onAnswer?.(event.delta || "");
          break;

        case "response.audio_transcript.delta":
          // 音频转写流 - 也监听作为备选
          console.log(">>> Audio transcript delta received:", event.delta);
          opts.onAnswer?.(event.delta || "");
          break;

        case "response.audio.delta":
          // AI 语音流
          if (event.delta) {
            const audioData = base64ToArrayBuffer(event.delta);
            playbackQueueRef.current.push(audioData);
            playNextAudio();
          }
          break;

        case "response.content_part.done":
          console.log("Content part done:", event.part?.type, event.part);
          break;

        case "response.output_item.done":
          console.log("Output item done:", event.item?.type, event.item);
          // 从完成的 output item 中获取完整文本
          if (event.item?.type === "message" && event.item?.content) {
            for (const part of event.item.content) {
              if (part.type === "text" && part.text) {
                console.log("Complete text response:", part.text);
                // 如果实时 delta 没有触发，使用完整文本
                opts.onAnswerComplete?.(part.text);
              }
              if (part.type === "audio" && part.transcript) {
                console.log("Complete audio transcript:", part.transcript);
                // 使用音频转写作为完整回答
                opts.onAnswerComplete?.(part.transcript);
              }
            }
          }
          break;

        case "response.function_call_arguments.done":
          // 工具调用完成
          console.log("Tool call:", event.name, event.arguments, "call_id:", event.call_id);
          try {
            const args = JSON.parse(event.arguments || "{}");

            // 保存工具调用信息（用于双向通信）
            if (event.call_id) {
              lastToolCallRef.current = {
                name: event.name,
                callId: event.call_id,
                params: args,
              };
            }

            // 处理恢复视频的工具调用
            if (event.name === "resume_video") {
              opts.onResumeVideo?.();
              // resume_video 立即返回结果
              if (wsRef.current?.readyState === WebSocket.OPEN && event.call_id) {
                wsRef.current.send(JSON.stringify({
                  type: "conversation.item.create",
                  item: {
                    type: "function_call_output",
                    call_id: event.call_id,
                    output: JSON.stringify({ success: true, message: "视频已恢复" }),
                  },
                }));
                wsRef.current.send(JSON.stringify({ type: "response.create" }));
              }
            } else if (event.name === "load_tool_guide") {
              // 加载工具使用指南 - 直接从本地缓存获取
              const guideName = args.guide_name as string;
              console.log("Loading tool guide from cache:", guideName);

              const guideContent = guidesCache[guideName];

              if (guideContent) {
                console.log("Guide found in cache:", guideName);
                // 返回指南内容
                if (wsRef.current?.readyState === WebSocket.OPEN && event.call_id) {
                  wsRef.current.send(JSON.stringify({
                    type: "conversation.item.create",
                    item: {
                      type: "function_call_output",
                      call_id: event.call_id,
                      output: JSON.stringify({
                        success: true,
                        guide_name: guideName,
                        message: `已加载 ${guideName} 工具使用指南，请按照以下说明使用工具：\n\n${guideContent}`,
                      }),
                    },
                  }));
                  wsRef.current.send(JSON.stringify({ type: "response.create" }));
                }
              } else {
                console.error("Guide not found:", guideName, "Available:", Object.keys(guidesCache));
                // 返回错误信息
                if (wsRef.current?.readyState === WebSocket.OPEN && event.call_id) {
                  wsRef.current.send(JSON.stringify({
                    type: "conversation.item.create",
                    item: {
                      type: "function_call_output",
                      call_id: event.call_id,
                      output: JSON.stringify({
                        success: false,
                        error: `工具指南 ${guideName} 未找到`,
                      }),
                    },
                  }));
                  wsRef.current.send(JSON.stringify({ type: "response.create" }));
                }
              }
            } else if (event.name === "jump_to_video_node") {
              // 跳转到指定知识点（优先在字幕中精准搜索）
              const query = args.query as string;
              console.log("Jump to node requested:", query);

              let jumpTarget: JumpTarget | null = null;
              const subtitles = opts.subtitles || [];

              // 1. 首先在字幕中搜索精确匹配
              if (subtitles.length > 0 && query) {
                const queryLower = query.toLowerCase();
                const queryWords = query.split(/[，、\s]+/).filter(w => w.length > 1);

                // 计算每个字幕的匹配分数
                let bestMatch: { cue: SubtitleCue; score: number } | null = null;

                for (const cue of subtitles) {
                  const textLower = cue.text.toLowerCase();
                  let score = 0;

                  // 完整匹配
                  if (textLower.includes(queryLower)) {
                    score = 10;
                  } else {
                    // 关键词匹配
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
                  console.log("Found subtitle match:", jumpTarget);
                }
              }

              // 2. 如果字幕没找到，尝试节点列表
              if (!jumpTarget && nodeListCache.length > 0 && query) {
                const queryLower = query.toLowerCase();
                let targetNode = nodeListCache.find(node =>
                  node.title.toLowerCase().includes(queryLower)
                ) || null;

                // 模糊匹配
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
                  console.log("Found node match:", jumpTarget);
                }
              }

              if (jumpTarget) {
                opts.onJumpToTime?.(jumpTarget.time);

                // 返回成功结果
                if (wsRef.current?.readyState === WebSocket.OPEN && event.call_id) {
                  const startMin = Math.floor(jumpTarget.time / 60);
                  const startSec = Math.floor(jumpTarget.time % 60);
                  wsRef.current.send(JSON.stringify({
                    type: "conversation.item.create",
                    item: {
                      type: "function_call_output",
                      call_id: event.call_id,
                      output: JSON.stringify({
                        success: true,
                        jumped_to: jumpTarget.text,
                        start_time: `${startMin}:${startSec.toString().padStart(2, "0")}`,
                        source: jumpTarget.source,
                        message: `已跳转到「${jumpTarget.text}」(${startMin}:${startSec.toString().padStart(2, "0")})`,
                      }),
                    },
                  }));
                  wsRef.current.send(JSON.stringify({ type: "response.create" }));
                }
              } else {
                console.log("No match found for:", query);
                // 返回未找到结果
                if (wsRef.current?.readyState === WebSocket.OPEN && event.call_id) {
                  wsRef.current.send(JSON.stringify({
                    type: "conversation.item.create",
                    item: {
                      type: "function_call_output",
                      call_id: event.call_id,
                      output: JSON.stringify({
                        success: false,
                        error: "没有找到相关内容，请描述得更具体一些",
                        available_nodes: nodeListCache.map(n => n.title),
                      }),
                    },
                  }));
                  wsRef.current.send(JSON.stringify({ type: "response.create" }));
                }
              }
            } else {
              // 其他工具调用（如 use_whiteboard）
              opts.onToolCall?.(event.name, args, event.call_id);
              // 向 API 返回工具执行结果，让 AI 继续响应
              if (wsRef.current?.readyState === WebSocket.OPEN && event.call_id) {
                wsRef.current.send(JSON.stringify({
                  type: "conversation.item.create",
                  item: {
                    type: "function_call_output",
                    call_id: event.call_id,
                    output: JSON.stringify({ success: true, message: "已展示" }),
                  },
                }));
                wsRef.current.send(JSON.stringify({ type: "response.create" }));
              }
            }
          } catch (e) {
            console.error("Failed to parse function arguments:", e);
          }
          break;

        case "response.done":
          // 响应完成
          console.log("Response done, status:", event.response?.status);
          if (event.response?.status === "failed") {
            console.error("Response failed, full details:", JSON.stringify(event.response, null, 2));
          }
          opts.onComplete?.();
          break;

        case "rate_limits.updated":
          // 速率限制更新，忽略
          break;

        case "error":
          console.error("Realtime API error:", event.error);
          break;

        default:
          console.log("Unhandled event:", event.type);
      }
    },
    [playNextAudio]
  );

  // 获取 session token 并连接
  const connect = useCallback(async () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      console.log("Already connected");
      return;
    }

    try {
      console.log("Connecting to Realtime API...");

      // 获取临时 token
      const tokenResponse = await fetch(`${API_BASE}/api/realtime`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoContext: optionsRef.current.videoContext,
          videoId: optionsRef.current.videoId,
          currentTime: optionsRef.current.currentTime,
        }),
      });

      if (!tokenResponse.ok) {
        const error = await tokenResponse.text();
        console.error("Token error:", error);
        throw new Error("Failed to get realtime session");
      }

      const data = await tokenResponse.json();
      console.log("API Response:", data);

      // 缓存工具指南内容（从服务端预加载）
      if (data.guides) {
        guidesCache = data.guides;
        console.log("Guides cached:", Object.keys(guidesCache));
      }

      // 缓存节点列表（用于跳转）
      if (data.nodeList) {
        nodeListCache = data.nodeList;
        console.log("Node list cached:", nodeListCache.length, "nodes");
      }

      const clientSecret = data.client_secret?.value || data.client_secret;
      if (!clientSecret) {
        console.error("No client_secret in response:", data);
        throw new Error("No client_secret received");
      }

      console.log("Got client secret, connecting WebSocket...");
      console.log("Client secret (first 20 chars):", clientSecret.substring(0, 20) + "...");

      // 连接 WebSocket
      const wsUrl = `wss://api.openai.com/v1/realtime?model=gpt-realtime-2025-08-28`;
      console.log("WebSocket URL:", wsUrl);

      const ws = new WebSocket(wsUrl, [
        "realtime",
        `openai-insecure-api-key.${clientSecret}`,
        "openai-beta.realtime-v1"
      ]);

      ws.onopen = () => {
        console.log("WebSocket connected successfully!");
        setIsConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const data: RealtimeEvent = JSON.parse(event.data);
          handleRealtimeEvent(data);
        } catch (e) {
          console.error("Failed to parse WebSocket message:", e);
        }
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        setIsConnected(false);
      };

      ws.onclose = (event) => {
        console.log("WebSocket closed:", event.code, event.reason);
        setIsConnected(false);
        setIsListening(false);
      };

      wsRef.current = ws;
    } catch (error) {
      console.error("Failed to connect:", error);
      setIsConnected(false);
    }
  }, [handleRealtimeEvent]);

  // 开始录音
  const startListening = useCallback(async () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.error("WebSocket not connected");
      return;
    }

    try {
      console.log("Requesting microphone access...");
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 24000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          // 尝试抑制系统音频
          suppressLocalAudioPlayback: true,
        } as MediaTrackConstraints,
      });

      console.log("Microphone access granted");
      mediaStreamRef.current = stream;

      const audioContext = new AudioContext({ sampleRate: 24000 });
      audioContextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          const inputData = e.inputBuffer.getChannelData(0);
          const pcmData = floatTo16BitPCM(inputData);
          const base64Data = arrayBufferToBase64(pcmData);

          wsRef.current.send(
            JSON.stringify({
              type: "input_audio_buffer.append",
              audio: base64Data,
            })
          );
        }
      };

      source.connect(processor);
      processor.connect(audioContext.destination);

      setIsListening(true);
      console.log("Now listening...");
    } catch (error) {
      console.error("Failed to start recording:", error);
    }
  }, []);

  // 按住开始说话
  const startPushToTalk = useCallback(() => {
    console.log("Push to talk: START");
    isPushToTalkActiveRef.current = true;
    setIsPushToTalkActive(true);
    // 通知外部用户开始说话
    optionsRef.current.onSpeechStart?.();
  }, []);

  // 松开停止说话
  const stopPushToTalk = useCallback(() => {
    console.log("Push to talk: STOP");
    isPushToTalkActiveRef.current = false;
    setIsPushToTalkActive(false);
    // 通知外部用户停止说话
    optionsRef.current.onSpeechEnd?.();

    // 提交音频缓冲区并触发响应
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: "input_audio_buffer.commit",
      }));
    }
  }, []);

  // 停止录音
  const stopListening = useCallback(() => {
    console.log("Stopping listening...");

    // 停止音频处理
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }

    // 停止媒体流
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }

    // 关闭录音 AudioContext
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    setIsListening(false);
    setIsSpeaking(false);
  }, []);

  // 发送文本消息（用于快捷意图按钮）
  const sendTextMessage = useCallback((text: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.error("WebSocket not connected, state:", wsRef.current?.readyState);
      return;
    }

    console.log("Sending text message:", text);

    // 通知外部用户消息已发送（先显示用户消息）
    optionsRef.current.onTranscript?.(text, true);

    // 创建用户消息
    const createItemEvent = {
      type: "conversation.item.create",
      item: {
        type: "message",
        role: "user",
        content: [
          {
            type: "input_text",
            text: text,
          },
        ],
      },
    };
    console.log("Sending conversation.item.create:", createItemEvent);
    wsRef.current.send(JSON.stringify(createItemEvent));

    // 触发 AI 响应（指定输出模式）
    const responseEvent = {
      type: "response.create",
      response: {
        modalities: ["text", "audio"],
      },
    };
    console.log("Sending response.create:", responseEvent);
    wsRef.current.send(JSON.stringify(responseEvent));
  }, []);

  // 断开连接
  const disconnect = useCallback(() => {
    console.log("Disconnecting...");

    stopListening();

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    // 清空播放队列
    playbackQueueRef.current = [];
    isPlayingRef.current = false;

    if (playbackContextRef.current && playbackContextRef.current.state !== "closed") {
      playbackContextRef.current.close();
      playbackContextRef.current = null;
    }

    setIsConnected(false);
  }, [stopListening]);

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    isConnected,
    isListening,
    isSpeaking,
    isPushToTalk,
    isPushToTalkActive,
    connect,
    startListening,
    stopListening,
    disconnect,
    sendTextMessage,
    startPushToTalk,
    stopPushToTalk,
    setIsPushToTalk,
  };
}

// 工具函数：Float32 转 16-bit PCM
function floatTo16BitPCM(float32Array: Float32Array): ArrayBuffer {
  const buffer = new ArrayBuffer(float32Array.length * 2);
  const view = new DataView(buffer);
  for (let i = 0; i < float32Array.length; i++) {
    const s = Math.max(-1, Math.min(1, float32Array[i]));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return buffer;
}

// 工具函数：ArrayBuffer 转 Base64
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// 工具函数：Base64 转 ArrayBuffer
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}
