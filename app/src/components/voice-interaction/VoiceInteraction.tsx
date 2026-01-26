"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Whiteboard } from "@/components/whiteboard/Whiteboard";
import { QuickIntents } from "@/components/voice-interaction/QuickIntents";
import { useRealtimeVoice } from "@/hooks/useRealtimeVoice";
import { useVoiceInteraction } from "@/hooks/voice";
import { useDoubaoRealtimeVoice } from "@/hooks/voice/useDoubaoRealtimeVoice";
import { DrawingShape } from "@/components/drawing-canvas";
import katex from "katex";
import "katex/dist/katex.min.css";

// Voice backend mode: "openai" for OpenAI Realtime, "doubao" for ASR + LLM + TTS, "doubao_realtime" for Doubao S2S
type VoiceBackendMode = "openai" | "doubao" | "doubao_realtime";

interface SubtitleCue {
  start: number;
  end: number;
  text: string;
}

interface VoiceInteractionProps {
  videoContext: string;
  currentSubtitle: string;
  isActive: boolean;
  videoId?: string;              // 视频ID，用于 RAG
  currentTime?: number;          // 当前播放时间
  subtitles?: SubtitleCue[];     // 字幕列表，用于精准跳转
  voiceBackend?: VoiceBackendMode;  // 语音后端模式，默认 "doubao"
  embedded?: boolean;            // 是否嵌入在 ChatPanel 中（隐藏外层边框和 header）
  autoStart?: boolean;           // 是否自动开启麦克风（连接成功后自动请求权限）
  onToggle: () => void;
  onPauseVideo: () => void;
  onResumeVideo: () => void;
  onJumpToTime?: (time: number) => void;  // 跳转到指定时间
  // Drawing board callbacks
  onOpenDrawing?: () => void;
  onCloseDrawing?: () => void;
  onDrawShapes?: (shapes: DrawingShape[]) => void;
  onClearDrawing?: () => void;
  // Voice status callbacks
  onMicStatusChange?: (active: boolean) => void;
  onAISpeakingChange?: (speaking: boolean) => void;
  // Mic toggle callback registration
  onRegisterToggleMic?: (toggleFn: () => void) => void;
}

type InteractionStatus = "connecting" | "error" | "need_permission" | "listening" | "user_speaking" | "thinking" | "speaking";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  whiteboard?: {
    type: "formula" | "graph";
    content: string;
    steps?: string[];
    graphConfig?: {
      xRange?: [number, number];
      yRange?: [number, number];
      points?: Array<{ x: number; y: number; label?: string }>;
      params?: Array<{
        name: string;
        value: number;
        min?: number;
        max?: number;
        step?: number;
        label?: string;
      }>;
    };
  };
}

// 渲染包含 LaTeX 的文本
function renderTextWithLatex(text: string): string {
  // 匹配 $...$ 或 $$...$$ 格式的 LaTeX
  const latexPattern = /\$\$(.*?)\$\$|\$(.*?)\$/g;

  return text.replace(latexPattern, (match, display, inline) => {
    const latex = display || inline;
    const isDisplay = !!display;
    try {
      return katex.renderToString(latex, {
        throwOnError: false,
        displayMode: isDisplay,
      });
    } catch {
      return match; // 渲染失败时返回原文
    }
  });
}

// 消息气泡组件
function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";

  const renderedContent = useMemo(() => {
    return renderTextWithLatex(message.content);
  }, [message.content]);

  useEffect(() => {
    console.log("Render MessageBubble", {
      id: message.id,
      role: message.role,
      hasWhiteboard: !!message.whiteboard,
      whiteboard: message.whiteboard,
    });
  }, [message]);

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-lg p-3 ${
          isUser
            ? "bg-blue-500 text-white"
            : "bg-gray-700 text-white"
        }`}
      >
        <div
          className="whitespace-pre-wrap break-words"
          dangerouslySetInnerHTML={{ __html: renderedContent }}
        />
        {message.whiteboard && (
          <div className="mt-2">
            <Whiteboard
              type={message.whiteboard.type}
              content={message.whiteboard.content}
              steps={message.whiteboard.steps}
              graphConfig={message.whiteboard.graphConfig}
            />
          </div>
        )}
        <div className={`text-xs mt-1 ${isUser ? "text-blue-200" : "text-gray-400"}`}>
          {message.timestamp.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}
        </div>
      </div>
    </div>
  );
}

export function VoiceInteraction({
  videoContext,
  currentSubtitle,
  isActive,
  videoId,
  currentTime,
  subtitles,
  voiceBackend = "doubao_realtime",  // 默认使用豆包实时语音大模型
  embedded = false,
  autoStart = false,
  onToggle,
  onPauseVideo,
  onResumeVideo,
  onJumpToTime,
  onOpenDrawing,
  onCloseDrawing,
  onDrawShapes,
  onClearDrawing,
  onMicStatusChange,
  onAISpeakingChange,
  onRegisterToggleMic,
}: VoiceInteractionProps) {
  const [status, setStatus] = useState<InteractionStatus>("connecting");
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentTranscript, setCurrentTranscript] = useState("");
  const [currentAnswer, setCurrentAnswer] = useState("");
  const [permissionError, setPermissionError] = useState<string>("");
  const [pendingWhiteboard, setPendingWhiteboard] = useState<Message["whiteboard"] | null>(null);
  const [connectionError, setConnectionError] = useState<string>("");
  const [textInput, setTextInput] = useState("");

  // 用于自动滚动
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const currentAnswerRef = useRef("");
  const statusRef = useRef(status);
  const pendingWhiteboardRef = useRef<Message["whiteboard"] | null>(null);
  // 记录最近一次工具调用的白板数据，避免时序抖动导致丢失
  const lastWhiteboardRef = useRef<Message["whiteboard"] | null>(null);

  // Keep statusRef in sync
  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const scrollToBottom = () => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, currentAnswer]);

  // Common callback handlers
  const handleSpeechStart = () => {
    console.log("User started speaking, pausing video, interrupting AI");
    // 如果正在回答中被打断，保存当前回答
    if (statusRef.current === "speaking" && currentAnswerRef.current) {
      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: currentAnswerRef.current + " (被打断)",
          timestamp: new Date(),
          whiteboard: pendingWhiteboardRef.current || undefined,
        },
      ]);
      currentAnswerRef.current = "";
      setCurrentAnswer("");
      pendingWhiteboardRef.current = null;
      setPendingWhiteboard(null);
    }
    setStatus("user_speaking");
    onPauseVideo();
  };

  const handleSpeechEnd = () => {
    console.log("User stopped speaking");
    setStatus("thinking");
  };

  const handleTranscript = (text: string, isFinal: boolean) => {
    console.log("Transcript:", text, "isFinal:", isFinal);
    setCurrentTranscript(text);
    if (isFinal && text) {
      // 添加用户消息到列表
      setMessages((prev) => [
        ...prev,
        {
          id: `user-${Date.now()}`,
          role: "user",
          content: text,
          timestamp: new Date(),
        },
      ]);
      setCurrentTranscript("");
      // 清空回答准备接收新回答
      currentAnswerRef.current = "";
      setCurrentAnswer("");
    }
  };

  const handleAnswer = (text: string) => {
    currentAnswerRef.current += text;
    setCurrentAnswer(currentAnswerRef.current);
    setStatus("speaking");
  };

  const handleAnswerComplete = (text: string) => {
    // 完整回答（当实时 delta 不可用时）
    console.log("Answer complete:", text, "whiteboard:", pendingWhiteboardRef.current);
    // 直接保存到消息列表
    if (text) {
      const whiteboard = lastWhiteboardRef.current || pendingWhiteboardRef.current || undefined;
      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: text,
          timestamp: new Date(),
          whiteboard,
        },
      ]);
      pendingWhiteboardRef.current = null;
      lastWhiteboardRef.current = null;
      setPendingWhiteboard(null);
      // 清空当前回答状态
      currentAnswerRef.current = "";
      setCurrentAnswer("");
    }
  };

  const handleToolCall = (tool: string, params: Record<string, unknown>) => {
    console.log("Tool call:", tool, params);
    if (tool === "use_whiteboard") {
      const p = params as {
        content_type: "formula" | "graph";
        latex?: string;
        expression?: string;
        steps?: string[];
        x_range?: [number, number];
        y_range?: [number, number];
        points?: Array<{ x: number; y: number; label?: string }>;
        params?: Array<{
          name: string;
          value: number;
          min?: number;
          max?: number;
          step?: number;
          label?: string;
        }>;
      };

      if (p.content_type === "formula" || p.content_type === "graph") {
        // formula 或 graph 类型，在消息气泡中显示
        if (p.content_type === "graph" && !p.expression) {
          console.warn("Graph tool call missing expression, skipping whiteboard render.", p);
          return;
        }
        const whiteboardData = {
          type: p.content_type,
          content: p.latex || p.expression || "",
          steps: p.steps,
          graphConfig: p.content_type === "graph" ? {
            xRange: p.x_range,
            yRange: p.y_range,
            points: p.points,
            params: p.params,
          } : undefined,
        };
        console.log("Setting pendingWhiteboardRef:", whiteboardData);
        // Use ref for immediate access (state is async)
        pendingWhiteboardRef.current = whiteboardData;
        lastWhiteboardRef.current = whiteboardData;
        setPendingWhiteboard(whiteboardData);
        console.log("pendingWhiteboardRef.current is now:", pendingWhiteboardRef.current);
      }
    } else if (tool === "use_drawing_board") {
      // Handle drawing board tool
      const p = params as {
        action: "open" | "draw" | "clear" | "close";
        shapes?: Array<{
          type: "rectangle" | "ellipse" | "line" | "arrow" | "text" | "freehand";
          x: number;
          y: number;
          width?: number;
          height?: number;
          points?: Array<{ x: number; y: number }>;
          text?: string;
          color?: string;
        }>;
      };

      console.log("Drawing board action:", p.action, "shapes:", p.shapes);

      switch (p.action) {
        case "open":
          onOpenDrawing?.();
          if (p.shapes && p.shapes.length > 0) {
            onDrawShapes?.(p.shapes as DrawingShape[]);
          }
          break;
        case "draw":
          if (p.shapes && p.shapes.length > 0) {
            onDrawShapes?.(p.shapes as DrawingShape[]);
          }
          break;
        case "clear":
          onClearDrawing?.();
          break;
        case "close":
          onCloseDrawing?.();
          break;
      }
    }
  };

  const handleResumeVideo = () => {
    console.log("AI triggered resume video");
    onResumeVideo();
  };

  const handleJumpToTime = (time: number) => {
    console.log("AI triggered jump to time:", time);
    onJumpToTime?.(time);
  };

  const handleComplete = () => {
    console.log("Response complete, back to listening");
    // 保存完整回答到消息列表
    if (currentAnswerRef.current) {
      const whiteboard = lastWhiteboardRef.current || pendingWhiteboardRef.current || undefined;
      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: currentAnswerRef.current,
          timestamp: new Date(),
          whiteboard,
        },
      ]);
      currentAnswerRef.current = "";
      setCurrentAnswer("");
      pendingWhiteboardRef.current = null;
      lastWhiteboardRef.current = null;
      setPendingWhiteboard(null);
    }
    // 如果还有未消耗的白板数据，补到最后一条助教消息上（避免时序问题丢失白板）
    if (pendingWhiteboardRef.current || lastWhiteboardRef.current) {
      const whiteboard = lastWhiteboardRef.current || pendingWhiteboardRef.current;
      setMessages((prev) => {
        if (prev.length === 0) return prev;
        const last = prev[prev.length - 1];
        if (last.role !== "assistant") return prev;
        // 已有白板则不覆盖
        if (last.whiteboard) return prev;
        const updated = [...prev];
        updated[updated.length - 1] = {
          ...last,
          whiteboard: whiteboard || undefined,
        };
        return updated;
      });
      pendingWhiteboardRef.current = null;
      lastWhiteboardRef.current = null;
      setPendingWhiteboard(null);
    }
    setStatus("listening");
  };

  // OpenAI Realtime Voice hook (legacy)
  const realtimeVoice = useRealtimeVoice({
    videoContext,
    videoId,
    currentTime,
    subtitles,
    onSpeechStart: handleSpeechStart,
    onSpeechEnd: handleSpeechEnd,
    onTranscript: handleTranscript,
    onAnswer: handleAnswer,
    onAnswerComplete: handleAnswerComplete,
    onToolCall: handleToolCall,
    onResumeVideo: handleResumeVideo,
    onJumpToTime: handleJumpToTime,
    onComplete: handleComplete,
  });

  // New three-stage voice hook (Doubao ASR + DeepSeek + Doubao TTS)
  const voiceInteraction = useVoiceInteraction({
    videoContext,
    videoId,
    currentTime,
    subtitles,
    onSpeechStart: handleSpeechStart,
    onSpeechEnd: handleSpeechEnd,
    onTranscript: handleTranscript,
    onAnswer: handleAnswer,
    onAnswerComplete: handleAnswerComplete,
    onToolCall: handleToolCall,
    onResumeVideo: handleResumeVideo,
    onJumpToTime: handleJumpToTime,
    onComplete: handleComplete,
  });

  // Doubao Realtime (S2S) hook
  const doubaoRealtimeVoice = useDoubaoRealtimeVoice({
    videoContext,
    videoId,
    currentTime,
    subtitles,
    onSpeechStart: handleSpeechStart,
    onSpeechEnd: handleSpeechEnd,
    onTranscript: handleTranscript,
    onAnswer: handleAnswer,
    onAnswerComplete: handleAnswerComplete,
    onToolCall: handleToolCall,
    onResumeVideo: handleResumeVideo,
    onJumpToTime: handleJumpToTime,
    onComplete: handleComplete,
  });

  // Select the appropriate voice hook based on backend mode
  const voice = voiceBackend === "openai"
    ? realtimeVoice
    : voiceBackend === "doubao_realtime"
      ? doubaoRealtimeVoice
      : voiceInteraction;

  const {
    isConnected,
    isListening,
    connect,
    startListening,
    stopListening,
    disconnect,
    sendTextMessage,
  } = voice;

  // Store latest functions in refs to avoid useEffect re-triggering
  const connectRef = useRef(connect);
  const disconnectRef = useRef(disconnect);
  const stopListeningRef = useRef(stopListening);
  useEffect(() => {
    connectRef.current = connect;
    disconnectRef.current = disconnect;
    stopListeningRef.current = stopListening;
  }, [connect, disconnect, stopListening]);

  // 当激活状态变化时连接
  useEffect(() => {
    if (isActive) {
      // Only connect if not already connected
      if (!isConnected) {
        console.log("VoiceInteraction activated, connecting...");
        setConnectionError("");

        const timeout = setTimeout(() => {
          if (statusRef.current === "connecting") {
            console.error("Connection timeout");
            setConnectionError("连接超时，请检查网络后重试");
            setStatus("error");
          }
        }, 10000);

        connectRef.current().catch((err) => {
          console.error("Connect error:", err);
          setConnectionError(err.message || "连接失败");
          setStatus("error");
        });

        return () => {
          clearTimeout(timeout);
        };
      }
    } else {
      console.log("VoiceInteraction deactivated, disconnecting...");
      disconnectRef.current();
      setStatus("connecting");
      setMessages([]);
      setCurrentTranscript("");
      setCurrentAnswer("");
      setPendingWhiteboard(null);
      setPermissionError("");
      setConnectionError("");
    }
  }, [isActive, isConnected]); // Add isConnected to properly track connection state

  // 连接成功后显示需要权限或自动开始监听
  useEffect(() => {
    if (isConnected && isActive && !isListening) {
      if (autoStart) {
        // 自动开始监听
        console.log("Connected, auto-starting listening...");
        startListening().catch((err) => {
          console.error("Auto-start listening failed:", err);
          setPermissionError(err instanceof Error ? err.message : "无法访问麦克风");
          setStatus("need_permission");
        });
      } else {
        console.log("Connected, waiting for permission...");
        setStatus("need_permission");
      }
    }
  }, [isConnected, isActive, isListening, autoStart, startListening]);

  // 监听开始后更新状态
  useEffect(() => {
    if (isListening) {
      console.log("Now listening!");
      setStatus("listening");
    }
  }, [isListening]);

  // 通知父组件麦克风状态变化
  useEffect(() => {
    onMicStatusChange?.(isListening);
  }, [isListening, onMicStatusChange]);

  // 通知父组件 AI 说话状态变化
  useEffect(() => {
    onAISpeakingChange?.(status === "speaking");
  }, [status, onAISpeakingChange]);

  // Note: useVoiceInteraction hook handles its own cleanup on unmount
  // No need to call disconnect here - it causes issues with React Strict Mode

  // 切换麦克风状态
  const handleToggleMic = useCallback(async () => {
    if (isListening) {
      console.log("Stopping listening...");
      stopListening();
    } else {
      console.log("Starting listening...");
      setPermissionError("");
      try {
        await startListening();
      } catch (error) {
        console.error("Failed to start listening:", error);
        setPermissionError(error instanceof Error ? error.message : "无法访问麦克风");
      }
    }
  }, [isListening, startListening, stopListening]);

  // 注册切换麦克风的回调给父组件
  useEffect(() => {
    if (onRegisterToggleMic && isConnected) {
      onRegisterToggleMic(handleToggleMic);
    }
  }, [onRegisterToggleMic, handleToggleMic, isConnected]);

  // 请求麦克风权限并开始监听
  const handleStartListening = async () => {
    console.log("User clicked to start listening...");
    setPermissionError("");
    try {
      await startListening();
    } catch (error) {
      console.error("Failed to start listening:", error);
      setPermissionError(error instanceof Error ? error.message : "无法访问麦克风");
    }
  };

  // 处理快捷意图选择
  const handleQuickIntent = (prompt: string) => {
    console.log("Quick intent selected:", prompt);
    setStatus("thinking");
    onPauseVideo();
    sendTextMessage(prompt);
  };

  // 处理文字输入发送
  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!textInput.trim()) return;

    console.log("Text input submitted:", textInput);
    // 添加用户消息到列表
    setMessages((prev) => [
      ...prev,
      {
        id: `user-${Date.now()}`,
        role: "user",
        content: textInput,
        timestamp: new Date(),
      },
    ]);
    setStatus("thinking");
    onPauseVideo();
    sendTextMessage(textInput);
    setTextInput("");
  };

  if (!isActive) {
    return null;
  }

  const getStatusText = () => {
    switch (status) {
      case "connecting":
        return "连接中...";
      case "error":
        return "连接失败";
      case "need_permission":
        return "点击下方按钮开启麦克风";
      case "listening":
        return "等待你提问...";
      case "user_speaking":
        return "正在听你说话...";
      case "thinking":
        return "老师思考中...";
      case "speaking":
        return "老师回答中...";
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case "connecting":
        return "bg-yellow-500";
      case "error":
        return "bg-red-500";
      case "need_permission":
        return "bg-orange-500";
      case "listening":
        return "bg-green-500";
      case "user_speaking":
        return "bg-red-500";
      case "thinking":
        return "bg-blue-500";
      case "speaking":
        return "bg-purple-500";
    }
  };

  return (
    <div className={embedded ? "h-full flex flex-col" : "bg-gray-800 rounded-lg border border-gray-700 overflow-hidden"}>
      {/* Header - 仅在非嵌入模式下显示 */}
      {!embedded && (
        <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full animate-pulse ${getStatusColor()}`} />
            <div>
              <span className="text-white font-medium">AI 老师</span>
              <span className="text-gray-400 text-sm ml-2">{getStatusText()}</span>
            </div>
          </div>
          <button
            onClick={onToggle}
            className="text-gray-400 hover:text-white transition-colors px-3 py-1 rounded hover:bg-gray-700"
          >
            退出对话
          </button>
        </div>
      )}

      {/* 嵌入模式下的状态栏 */}
      {embedded && (
        <div className="px-4 py-2 border-b border-gray-700 flex items-center gap-3 shrink-0">
          <div className={`w-3 h-3 rounded-full animate-pulse ${getStatusColor()}`} />
          <div>
            <span className="text-white font-medium">AI 老师</span>
            <span className="text-gray-400 text-sm ml-2">{getStatusText()}</span>
          </div>
        </div>
      )}

      {/* Content */}
      <div ref={messagesContainerRef} className={embedded ? "flex-1 p-4 space-y-4 overflow-y-auto" : "p-4 space-y-4 max-h-96 overflow-y-auto"}>
        {/* 需要麦克风权限 */}
        {status === "need_permission" && (
          <div className="text-center py-6">
            <div className="text-5xl mb-4">🎤</div>
            <p className="text-white mb-4">点击按钮开启麦克风，开始和AI老师对话</p>
            {permissionError && (
              <p className="text-red-400 text-sm mb-4">{permissionError}</p>
            )}
            <button
              onClick={handleStartListening}
              className="bg-blue-500 hover:bg-blue-600 text-white px-8 py-3 rounded-full text-lg font-medium transition-colors"
            >
              开启麦克风
            </button>
            <p className="text-gray-500 text-sm mt-4">
              浏览器会弹出权限请求，请点击「允许」
            </p>
          </div>
        )}

        {/* 连接中 */}
        {status === "connecting" && (
          <div className="text-center py-6">
            <svg className="animate-spin w-10 h-10 mx-auto text-blue-400 mb-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <p className="text-gray-400">正在连接AI老师...</p>
          </div>
        )}

        {/* 错误状态 */}
        {status === "error" && (
          <div className="text-center py-6">
            <div className="text-5xl mb-4">❌</div>
            <p className="text-red-400 font-medium mb-2">连接失败</p>
            <p className="text-gray-400 text-sm mb-4">{connectionError || "请检查网络连接"}</p>
            <button
              onClick={() => {
                setStatus("connecting");
                connect();
              }}
              className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-full transition-colors"
            >
              重试
            </button>
          </div>
        )}

        {/* 当前视频内容 */}
        {status !== "connecting" && status !== "need_permission" && status !== "error" && currentSubtitle && (
          <div className="bg-gray-700/50 rounded-lg p-3">
            <p className="text-xs text-gray-400 mb-1">当前内容：</p>
            <p className="text-gray-200 text-sm">{currentSubtitle}</p>
          </div>
        )}

        {/* 对话历史 */}
        {messages.length > 0 && (
          <div className="space-y-3">
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
          </div>
        )}

        {/* 正在输入的用户问题 */}
        {currentTranscript && (
          <div className="flex justify-end">
            <div className="max-w-[85%] rounded-lg p-3 bg-blue-500/50 text-white border border-blue-400/50">
              <p>{currentTranscript}</p>
              <p className="text-xs text-blue-200 mt-1">正在听...</p>
            </div>
          </div>
        )}

        {/* 正在生成的 AI 回答 */}
        {currentAnswer && (
          <div className="flex justify-start">
            <div className="max-w-[85%] rounded-lg p-3 bg-gray-700 text-white">
              <div
                className="whitespace-pre-wrap break-words"
                dangerouslySetInnerHTML={{ __html: renderTextWithLatex(currentAnswer) }}
              />
              {pendingWhiteboard && (
                <div className="mt-2">
                  <Whiteboard
                    type={pendingWhiteboard.type}
                    content={pendingWhiteboard.content}
                    steps={pendingWhiteboard.steps}
                    graphConfig={pendingWhiteboard.graphConfig}
                  />
                </div>
              )}
              <p className="text-xs text-gray-400 mt-1">正在回答...</p>
            </div>
          </div>
        )}

        {/* 等待提问状态 */}
        {status === "listening" && messages.length === 0 && !currentTranscript && !currentAnswer && (
          <div className="text-center py-4">
            <div className="text-4xl mb-3 animate-pulse">🎧</div>
            <p className="text-green-400 font-medium">麦克风已开启</p>
            <p className="text-gray-400 mt-2">随时开口提问，或点击下方按钮</p>
          </div>
        )}

        {/* 快捷意图按钮 - 在麦克风开启后显示 */}
        {isListening && status !== "user_speaking" && status !== "thinking" && status !== "speaking" && (
          <div className="pt-2 border-t border-gray-700">
            <QuickIntents
              currentSubtitle={currentSubtitle}
              onSelect={handleQuickIntent}
            />
          </div>
        )}

        {/* 用户正在说话（无转写时） */}
        {status === "user_speaking" && !currentTranscript && (
          <div className="text-center py-4">
            <div className="text-3xl mb-2 animate-bounce">🎙️</div>
            <p className="text-red-400 font-medium">正在听你说话...</p>
          </div>
        )}

        {/* 思考中 */}
        {status === "thinking" && !currentAnswer && (
          <div className="flex justify-start">
            <div className="rounded-lg p-3 bg-gray-700 text-white">
              <div className="flex items-center gap-2">
                <svg className="animate-spin w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span className="text-gray-400">老师正在思考...</span>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* 底部文字输入框 - 仅在连接成功后显示 */}
      {embedded && isConnected && status !== "connecting" && status !== "error" && (
        <form onSubmit={handleTextSubmit} className="p-3 border-t border-gray-700 shrink-0">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="Type here..."
              className="flex-1 bg-gray-700 text-white rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-400"
              disabled={status === "thinking" || status === "speaking"}
            />
            <button
              type="submit"
              disabled={!textInput.trim() || status === "thinking" || status === "speaking"}
              className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white p-2 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
