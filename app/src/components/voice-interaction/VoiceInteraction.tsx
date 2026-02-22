"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Whiteboard } from "@/components/whiteboard/Whiteboard";
import { QuickIntents } from "@/components/voice-interaction/QuickIntents";
import { useRealtimeVoice } from "@/hooks/useRealtimeVoice";
import { useVoiceInteraction } from "@/hooks/voice";
import { useDoubaoRealtimeVoice } from "@/hooks/voice/useDoubaoRealtimeVoice";
import { useDrawExplainVoice } from "@/hooks/voice/useDrawExplainVoice";
import { useDoubaoTTS } from "@/hooks/voice/useDoubaoTTS";
import { useAudioPlayback } from "@/hooks/voice/useAudioPlayback";
import { DrawingShape } from "@/components/drawing-canvas";
import { compileDSL, DSLScript } from "@/lib/whiteboard-dsl";
import { VoiceMode, DrawExplainState, DrawExplainProgress, VoiceBackend } from "@/types/drawing-script";
import { getFallbackNodes, getFallbackNodeByTime } from "@/data/video-nodes";
import { useLearningSession, type CheckpointResult } from "@/hooks/useLearningSession";
import katex from "katex";
import "katex/dist/katex.min.css";

// Voice backend mode: "openai" for OpenAI Realtime, "doubao" for ASR + LLM + TTS, "doubao_realtime" for Doubao S2S
type VoiceBackendMode = VoiceBackend | "openai";

// Interaction status including draw_explain states
type InteractionStatus = "connecting" | "error" | "need_permission" | "listening" | "user_speaking" | "thinking" | "speaking" | "generating" | "drawing";

interface SubtitleCue {
  start: number;
  end: number;
  text: string;
}

// V2 自适应问题类型
interface AdaptiveQuestion {
  content: string;
  style: string;
  difficulty: number;
  expectedAnswerType: string;
  followUp?: string;
  targetConcept?: string;
  hints?: string[];
}

interface VoiceInteractionProps {
  videoContext: string;
  currentSubtitle: string;
  isActive: boolean;
  videoId?: string;              // 视频ID，用于 RAG
  currentTime?: number;          // 当前播放时间
  subtitles?: SubtitleCue[];     // 字幕列表，用于精准跳转
  studentId?: string;            // V2 自适应：学生ID，用于获取画像注入语音Agent
  voiceBackend?: VoiceBackendMode;  // 语音后端模式，默认 "doubao"
  embedded?: boolean;            // 是否嵌入在 ChatPanel 中（隐藏外层边框和 header）
  autoStart?: boolean;           // 是否自动开启麦克风（连接成功后自动请求权限）
  voiceMode?: VoiceMode;         // 语音交互模式：realtime 或 draw_explain
  interventionConfig?: any;      // 介入模式配置
  isVideoPlaying?: boolean;      // 视频播放状态（用于断连 realtime）
  // V2 自适应提问系统
  introQuestion?: AdaptiveQuestion | null;  // 开头问题
  onLogMessage?: (role: 'user' | 'assistant', content: string) => void;  // 记录对话
  onVoiceModeChange?: (mode: VoiceMode) => void;  // 模式切换回调
  onToggle: () => void;
  onPauseVideo: () => void;
  onResumeVideo: () => void;
  onJumpToTime?: (time: number) => void;  // 跳转到指定时间
  onEndIntervention?: () => void;  // 结束介入回调
  // Drawing board callbacks
  onOpenDrawing?: () => void;
  onCloseDrawing?: () => void;
  onDrawShapes?: (shapes: DrawingShape[]) => void;
  onClearDrawing?: () => void;
  // Voice status callbacks
  onMicStatusChange?: (active: boolean) => void;
  onAISpeakingChange?: (speaking: boolean) => void;
}

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

// Module-level message store: persists across component unmount/remount
// (e.g. when toggling fullscreen, React tears down one ChatPanel branch
// and mounts the other, losing all local state).
// Safe because there is only ever one VoiceInteraction instance at a time.
let _persistedMessages: Message[] = [];

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

/**
 * 从 AI 极简验证模式的回复中判断学生回答是否正确。
 * AI 在介入模式下被要求 10 字以内回应，格式通常是 "对，继续" 或 "不对，应该是..."
 */
function detectCorrectness(aiResponse: string): boolean {
  const text = aiResponse.trim();
  // 先检查否定（"不对" "不是" "不正确" "错了" 等）
  if (/^不[对是]|不正确|错了|错误|答错/.test(text)) {
    return false;
  }
  // 再检查肯定（"对" "没错" "正确" "答对" 等）
  if (/^[对好][\s，,!！]|^没错|^正确|^答对|^完全正确|^很好|^不错|^嗯[，,]?对/.test(text)) {
    return true;
  }
  // 无法判断时默认 true（宁可多给一点信心）
  return true;
}

// 消息气泡组件 - 简洁样式
function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";

  const renderedContent = useMemo(() => {
    return renderTextWithLatex(message.content);
  }, [message.content]);

  return (
    <div className={`flex flex-col gap-1.5 ${isUser ? "items-end" : "items-start"}`}>
      {/* 发送者名称 */}
      <span className={`text-[#888] text-sm ${isUser ? "pr-1" : "pl-1"}`}>
        {isUser ? "You" : "AI老师"}
      </span>
      {/* 消息气泡 */}
      <div className="max-w-[85%] rounded-2xl px-4 py-3 bg-[#2a2a2a] text-[#e8e8e8]">
        <div
          className="whitespace-pre-wrap break-words text-[15px] leading-relaxed"
          dangerouslySetInnerHTML={{ __html: renderedContent }}
        />
        {message.whiteboard && (
          <div className="mt-3">
            <Whiteboard
              type={message.whiteboard.type}
              content={message.whiteboard.content}
              steps={message.whiteboard.steps}
              graphConfig={message.whiteboard.graphConfig}
            />
          </div>
        )}
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
  studentId,  // V2 自适应：学生ID
  voiceBackend = "doubao_realtime",  // 默认使用豆包实时语音大模型
  embedded = false,
  autoStart = false,
  voiceMode = "realtime",
  interventionConfig,
  isVideoPlaying,
  // V2 自适应提问系统
  introQuestion,
  onLogMessage,
  onVoiceModeChange,
  onToggle,
  onPauseVideo,
  onResumeVideo,
  onJumpToTime,
  onEndIntervention,
  onOpenDrawing,
  onCloseDrawing,
  onDrawShapes,
  onClearDrawing,
  onMicStatusChange,
  onAISpeakingChange,
}: VoiceInteractionProps) {
  const [status, setStatus] = useState<InteractionStatus>("listening");
  const [messages, setMessagesRaw] = useState<Message[]>(() => _persistedMessages);
  // Wrap setMessages to also persist to module-level store (survives remounts on fullscreen toggle)
  const setMessages = useCallback((updater: Message[] | ((prev: Message[]) => Message[])) => {
    setMessagesRaw(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      _persistedMessages = next;
      return next;
    });
  }, []);
  const [currentTranscript, setCurrentTranscript] = useState("");
  const [currentAnswer, setCurrentAnswer] = useState("");
  const [permissionError, setPermissionError] = useState<string>("");
  const [pendingWhiteboard, setPendingWhiteboard] = useState<Message["whiteboard"] | null>(null);
  const [connectionError, setConnectionError] = useState<string>("");
  const [textInput, setTextInput] = useState("");

  // Draw-explain mode state
  const [drawExplainState, setDrawExplainState] = useState<DrawExplainState>("idle");
  const [drawExplainProgress, setDrawExplainProgress] = useState<DrawExplainProgress | null>(null);

  // 待机模式：在 doubao_realtime 模式下，用户需点击按钮才开始语音对话
  const [isWakeWordMode, setIsWakeWordMode] = useState(true);
  // 延迟切换：等 TTS 播放完毕再切换到 realtime
  const [pendingInterventionSwitch, setPendingInterventionSwitch] = useState(false);
  const followupTimerRef = useRef<NodeJS.Timeout | null>(null);
  // 介入模式：学生不回答的超时计时器（TTS 播完后 15 秒无回答则切回实时模式）
  const interventionAnswerTimerRef = useRef<NodeJS.Timeout | null>(null);
  const voiceBackendRef = useRef(voiceBackend);
  voiceBackendRef.current = voiceBackend;

  // === 跨模式上下文共享：Learning Session ===
  const learningSession = useLearningSession({
    studentId: studentId || "anonymous",
    videoId: videoId || "unknown",
  });
  const learningSessionIdRef = useRef<string | null>(null);
  // 记录最近一轮的用户问题（用于 logQA 配对）
  const lastUserQuestionRef = useRef<string>("");
  useEffect(() => {
    learningSessionIdRef.current = learningSession.sessionId;
  }, [learningSession.sessionId]);

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
    // 用户开始说话，清除追问窗口计时器（用户在追问）
    if (followupTimerRef.current) {
      clearTimeout(followupTimerRef.current);
      followupTimerRef.current = null;
    }
    // 清除介入回答超时（学生开始说话了）
    if (interventionAnswerTimerRef.current) {
      clearTimeout(interventionAnswerTimerRef.current);
      interventionAnswerTimerRef.current = null;
    }
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
    if (isFinal && text) {
      // 最终结果：显示实际文本并添加到消息列表
      setCurrentTranscript(text);
      setMessages((prev) => [
        ...prev,
        {
          id: `user-${Date.now()}`,
          role: "user",
          content: text,
          timestamp: new Date(),
        },
      ]);
      // V2: 记录用户消息
      onLogMessage?.('user', text);
      // 记录用户问题，供 logQA 配对
      lastUserQuestionRef.current = text;
      // 短暂延迟后清空，让用户看到最终结果
      setTimeout(() => setCurrentTranscript(""), 300);
      // 清空回答准备接收新回答
      currentAnswerRef.current = "";
      setCurrentAnswer("");
    } else if (!isFinal) {
      // 中间结果：显示动态省略号，不显示可能不准确的中间文本
      setCurrentTranscript("...");
    }
  };

  const handleAnswer = (text: string) => {
    console.log('[VoiceInteraction] handleAnswer called with:', text.substring(0, 50), 'current length:', currentAnswerRef.current.length);
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
      // V2: 记录 AI 消息到对话日志
      onLogMessage?.('assistant', text);
      // 跨模式上下文：记录本轮 Q&A
      if (lastUserQuestionRef.current) {
        const mode = voiceBackend === "openai" ? "realtime" as const
          : voiceBackend === "doubao_realtime" ? "doubao_realtime" as const
          : "precise" as const;

        // 如果在介入模式，检测回答对错并附带 checkpoint 结果
        let checkpointResult: CheckpointResult | undefined;
        if (interventionConfig?.isIntervention && interventionConfig?.checkpoint) {
          const cp = interventionConfig.checkpoint;
          const isCorrect = detectCorrectness(text);
          checkpointResult = {
            studentId: studentId || "anonymous",
            nodeId: cp.id || "",
            keyConcepts: cp.key_concepts || [],
            isCorrect,
            interventionType: cp.criticalCheckpoint?.interventionType
              || cp.checkpoint_type
              || "quick_check",
          };
          console.log(`[VoiceInteraction] checkpoint判定: node=${cp.id} correct=${isCorrect} aiResponse="${text.substring(0, 30)}"`);
        }

        learningSession.logQA(lastUserQuestionRef.current, text, mode, checkpointResult);
        lastUserQuestionRef.current = "";
      }
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
    if (tool === "reject_out_of_scope") {
      // Handle out-of-scope rejection
      const p = params as {
        reason: string;
        suggestion: string;
      };
      console.log("Out-of-scope question detected:", p.reason);

      // Generate friendly rejection message
      const rejectionMessage = `这个问题问得挺好的！不过${p.reason}。\n\n${p.suggestion}\n\n关于视频里的内容，你有什么疑问吗？`;

      // Add rejection message to chat
      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: rejectionMessage,
          timestamp: new Date(),
        },
      ]);

      // Clear current answer and go back to listening
      currentAnswerRef.current = "";
      setCurrentAnswer("");
      setStatus("listening");

      return;
    } else if (tool === "use_whiteboard") {
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
    } else if (tool === "use_whiteboard_dsl") {
      // Handle DSL-based whiteboard tool
      const p = params as unknown as DSLScript;
      console.log("Whiteboard DSL commands:", p.commands);

      // Compile DSL to shapes
      const result = compileDSL(p);
      if (result.success && result.shapes.length > 0) {
        console.log("DSL compiled successfully, shapes:", result.shapes.length);
        onOpenDrawing?.();
        onDrawShapes?.(result.shapes);
      } else if (result.errors) {
        console.error("DSL compilation errors:", result.errors);
      }
    }
  };

  const handleResumeVideo = () => {
    // 介入后追问模式：忽略语音指令触发的恢复，只允许手动点播放
    if (postInterventionChatRef.current) {
      console.log("[VoiceChat] Post-intervention chat active, ignoring voice resume command");
      return;
    }
    console.log("AI triggered resume video");
    // 在实时模式下，恢复视频意味着回到待机模式
    if (voiceBackend === "doubao_realtime") {
      console.log("[VoiceChat] Resume video → disconnecting Doubao, back to standby");
      if (followupTimerRef.current) {
        clearTimeout(followupTimerRef.current);
        followupTimerRef.current = null;
      }
      doubaoRealtimeVoice.disconnect();
      setIsWakeWordMode(true);
      setStatus("listening");
    }
    onResumeVideo();
  };

  const handleJumpToTime = (time: number) => {
    console.log("AI triggered jump to time:", time);
    onJumpToTime?.(time);
  };

  const handleComplete = () => {
    console.log("[VoiceInteraction] handleComplete called");
    console.log("[VoiceInteraction] handleComplete - currentAnswerRef length:", currentAnswerRef.current?.length);
    console.log("[VoiceInteraction] handleComplete - currentAnswerRef content:", currentAnswerRef.current?.substring(0, 100));
    console.log("[VoiceInteraction] handleComplete - pendingWhiteboardRef:", pendingWhiteboardRef.current);
    console.log("[VoiceInteraction] handleComplete - lastWhiteboardRef:", lastWhiteboardRef.current);

    // 保存完整回答到消息列表
    if (currentAnswerRef.current) {
      const whiteboard = lastWhiteboardRef.current || pendingWhiteboardRef.current || undefined;
      console.log("[VoiceInteraction] handleComplete - saving message to messages array, content length:", currentAnswerRef.current.length);
      const messageContent = currentAnswerRef.current;
      setMessages((prev) => {
        console.log("[VoiceInteraction] handleComplete - setMessages called, prev length:", prev.length);
        return [
          ...prev,
          {
            id: `assistant-${Date.now()}`,
            role: "assistant",
            content: messageContent,
            timestamp: new Date(),
            whiteboard,
          },
        ];
      });
      // V2: 记录 AI 消息
      onLogMessage?.('assistant', messageContent);
      // 跨模式上下文：记录本轮 Q&A
      if (lastUserQuestionRef.current) {
        const mode = voiceBackend === "openai" ? "realtime" as const
          : voiceBackend === "doubao_realtime" ? "doubao_realtime" as const
          : "precise" as const;
        learningSession.logQA(lastUserQuestionRef.current, messageContent, mode);
        lastUserQuestionRef.current = "";
      }
      currentAnswerRef.current = "";
      setCurrentAnswer("");
      pendingWhiteboardRef.current = null;
      lastWhiteboardRef.current = null;
      setPendingWhiteboard(null);
    } else {
      console.log("[VoiceInteraction] handleComplete - NO content to save (currentAnswerRef is empty)");
    }
    // 如果还有未消耗的白板数据，补到最后一条助教消息上（避免时序问题丢失白板）
    if (pendingWhiteboardRef.current || lastWhiteboardRef.current) {
      const whiteboard = lastWhiteboardRef.current || pendingWhiteboardRef.current;
      console.log("[VoiceInteraction] handleComplete - appending whiteboard to last message:", whiteboard);
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

    // 介入模式下，AI 验证回答完毕 → 等 TTS 播完再切换到实时模式
    // handleComplete 时 LLM 已完成但 TTS 可能还在播（如"对了！"），
    // 等 onAllDone 触发后再切换，避免截断 AI 语音
    if (interventionConfig) {
      console.log("[VoiceChat] Intervention validated, waiting for TTS to finish before switching");
      setPendingInterventionSwitch(true);
      return;
    }

    // 在实时模式下，AI 回答完毕后开启 15 秒追问窗口
    // 窗口内用户可以继续提问而不需要再说唤醒词
    // 窗口过期后断开豆包、恢复视频、回到唤醒词监听模式
    if (voiceBackend === "doubao_realtime" && !isWakeWordMode) {
      if (followupTimerRef.current) {
        clearTimeout(followupTimerRef.current);
      }
      followupTimerRef.current = setTimeout(() => {
        console.log("[VoiceChat] Followup window expired, disconnecting Doubao, resuming video");
        followupTimerRef.current = null;
        postInterventionChatRef.current = false;  // 追问窗口过期，清除追问模式
        doubaoRealtimeVoice.disconnect();
        setIsWakeWordMode(true);
        setStatus("listening");
        onResumeVideo();
      }, 10000);
    }
  };

  // 介入验证后，LLM + TTS 都播完时触发 → 切换到实时模式
  const handleAllDone = () => {
    if (pendingInterventionSwitch) {
      console.log("[VoiceChat] onAllDone: TTS finished, switching to realtime");
      setPendingInterventionSwitch(false);
      setStatus("connecting");
      onEndIntervention?.();
      postInterventionAutoConnectRef.current = true;
      postInterventionChatRef.current = true;
    }
  };

  // Create no-op callbacks for disabled hooks to prevent them from triggering UI updates
  const noopCallbacks = {
    onSpeechStart: undefined,
    onSpeechEnd: undefined,
    onTranscript: undefined,
    onAnswer: undefined,
    onAnswerComplete: undefined,
    onToolCall: undefined,
    onResumeVideo: undefined,
    onJumpToTime: undefined,
    onComplete: undefined,
  };

  // Active callbacks only for the selected backend
  const activeCallbacks = {
    onSpeechStart: handleSpeechStart,
    onSpeechEnd: handleSpeechEnd,
    onTranscript: handleTranscript,
    onAnswer: handleAnswer,
    onAnswerComplete: handleAnswerComplete,
    onToolCall: handleToolCall,
    onResumeVideo: handleResumeVideo,
    onJumpToTime: handleJumpToTime,
    onComplete: handleComplete,
  };

  // OpenAI Realtime Voice hook (legacy)
  const realtimeVoice = useRealtimeVoice({
    videoContext,
    videoId,
    currentTime,
    subtitles,
    studentId,  // V2 自适应：传递学生ID
    learningSessionId: learningSession.sessionId || undefined,  // 跨模式上下文共享
    ...(voiceBackend === "openai" ? activeCallbacks : noopCallbacks),
  });

  // New three-stage voice hook (Doubao ASR + DeepSeek + Doubao TTS)
  const voiceInteraction = useVoiceInteraction({
    videoContext,
    videoId,
    currentTime,
    subtitles,
    studentId,  // V2 自适应：传递学生ID
    learningSessionId: learningSession.sessionId || undefined,  // 跨模式上下文共享
    interventionConfig,  // 传递介入配置
    ...(voiceBackend === "doubao" ? activeCallbacks : noopCallbacks),
    // onAllDone 仅用于精准模式：LLM 完成 + TTS 播完后触发介入切换
    onAllDone: voiceBackend === "doubao" ? handleAllDone : undefined,
  });

  // Doubao Realtime (S2S) hook
  const doubaoRealtimeVoice = useDoubaoRealtimeVoice({
    videoContext,
    videoId,
    currentTime,
    subtitles,
    studentId,  // V2 自适应：传递学生ID
    learningSessionId: learningSession.sessionId || undefined,  // 跨模式上下文共享
    ...(voiceBackend === "doubao_realtime" ? activeCallbacks : noopCallbacks),
  });

  // Draw-explain voice hook
  const drawExplainVoice = useDrawExplainVoice({
    videoContext,
    videoId,
    currentTime,
    onOpenDrawing,
    onCloseDrawing,
    onDrawShapes,
    onClearDrawing,
    onStateChange: setDrawExplainState,
    onProgressChange: setDrawExplainProgress,
    onError: (error) => {
      console.error("Draw-explain error:", error);
      setConnectionError(error);
      setStatus("error");
    },
  });

  // TTS for intervention mode - 用于播放 AI 的介入问题
  const interventionAudioPlayback = useAudioPlayback({
    onPlaybackStart: () => {
      console.log('[VoiceInteraction] TTS 开始播放介入问题');
      setStatus("speaking");
    },
    onPlaybackEnd: () => {
      console.log('[VoiceInteraction] TTS 播放完成，启动麦克风等待学生回答');
      setStatus("listening");
      // 启动麦克风录音，否则精准模式下 TTS 播完后无法收到语音
      voiceInteraction.startListening().catch((err) => {
        console.error('[VoiceInteraction] 介入模式启动麦克风失败:', err);
      });
      // 15 秒不回答 → 自动切回实时模式并恢复视频
      if (interventionAnswerTimerRef.current) {
        clearTimeout(interventionAnswerTimerRef.current);
      }
      interventionAnswerTimerRef.current = setTimeout(() => {
        console.log("[VoiceChat] Student didn't answer in 15s, switching to realtime");
        interventionAnswerTimerRef.current = null;
        onEndIntervention?.();
        postInterventionAutoConnectRef.current = true;
        setStatus("connecting");
      }, 15000);
    },
  });

  const interventionTTS = useDoubaoTTS({
    onAudio: (audioData) => {
      console.log('[VoiceInteraction] 收到TTS音频数据:', audioData.byteLength, 'bytes');
      interventionAudioPlayback.enqueue(audioData);
    },
    onSpeakStart: () => {
      console.log('[VoiceInteraction] TTS 开始生成语音');
    },
    onSpeakEnd: () => {
      console.log('[VoiceInteraction] TTS 生成完成');
    },
    onError: (error) => {
      console.error('[VoiceInteraction] TTS 错误:', error);
      setStatus("error");
      setConnectionError(error.message);
    },
  });

  // 点击按钮开始语音对话
  const handleStartVoiceChat = useCallback(() => {
    console.log("[VoiceChat] User clicked start, connecting Doubao S2S...");
    if (!isActive) {
      onToggle();
    }
    setIsWakeWordMode(false);
    onPauseVideo();
    setStatus("connecting");
    setConnectionError("");

    doubaoRealtimeVoice.connect()
      .then(async () => {
        console.log("[VoiceChat] Doubao connected, starting audio capture...");
        await doubaoRealtimeVoice.startListening();
        setStatus("listening");
      })
      .catch((err) => {
        console.error("[VoiceChat] Failed to connect Doubao:", err);
        setConnectionError(err instanceof Error ? err.message : "连接失败");
        setStatus("error");
        setIsWakeWordMode(true);
      });
  }, [isActive, onToggle, onPauseVideo, doubaoRealtimeVoice]);

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

  // 当激活状态变化时连接/断开
  const prevIsActiveRef = useRef(isActive);
  useEffect(() => {
    const wasActive = prevIsActiveRef.current;
    prevIsActiveRef.current = isActive;

    if (isActive) {
      // doubao_realtime 模式：所有连接都由用户触发（唤醒词、快捷意图、文本输入）
      if (voiceBackendRef.current === "doubao_realtime") {
        // 确保 status 不卡在 connecting
        if (statusRef.current === "connecting") {
          setStatus("listening");
        }
        return;
      }

      // 其他模式（doubao 精准模式等）：自动连接
      if (!isConnected && !interventionReconnectingRef.current) {
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
    } else if (wasActive) {
      // 从 active → inactive（用户退出通话）：断开当前连接，回到唤醒词模式
      console.log("VoiceInteraction deactivated, disconnecting...");
      disconnectRef.current();
      setCurrentTranscript("");
      setCurrentAnswer("");
      setPendingWhiteboard(null);
      setPermissionError("");
      setConnectionError("");
      setIsWakeWordMode(true);
      if (followupTimerRef.current) {
        clearTimeout(followupTimerRef.current);
        followupTimerRef.current = null;
      }
    }
  }, [isActive, isConnected]);

  // 连接成功后显示需要权限或自动开始监听
  // 注意：边画边讲模式下不自动开启麦克风
  // 注意：介入模式下不自动开启麦克风（等TTS播完再开）
  const interventionStatusSetRef = useRef(false);
  useEffect(() => {
    if (isConnected && isActive && !isListening) {
      // 介入模式下，不自动开始监听 — 等 TTS 播放完毕后由 onPlaybackEnd 启动
      if (interventionConfig) {
        if (!interventionStatusSetRef.current) {
          console.log("Connected in intervention mode, waiting for TTS to finish before listening...");
          interventionStatusSetRef.current = true;
        }
        setStatus("speaking");
        return;
      }
      interventionStatusSetRef.current = false;
      if (autoStart && voiceMode === "realtime") {
        // 只在实时对话模式下自动开始监听
        console.log("Connected, auto-starting listening...");
        startListening().catch((err) => {
          console.error("Auto-start listening failed:", err);
          setPermissionError(err instanceof Error ? err.message : "无法访问麦克风");
          setStatus("need_permission");
        });
      } else if (voiceMode === "realtime") {
        console.log("Connected, waiting for permission...");
        setStatus("need_permission");
      } else {
        // 边画边讲模式，直接进入 listening 状态（但不开启麦克风）
        console.log("Connected in draw_explain mode, ready for text input");
        setStatus("listening");
      }
    }
  }, [isConnected, isActive, isListening, autoStart, startListening, voiceMode, interventionConfig]);


  // 监听 voiceBackend 变化，重新连接
  // 用独立 ref 存各 backend 的 disconnect，避免 ref 更新竞争
  const realtimeDisconnectRef = useRef(realtimeVoice.disconnect);
  const doubaoDisconnectRef = useRef(voiceInteraction.disconnect);
  const doubaoRealtimeDisconnectRef = useRef(doubaoRealtimeVoice.disconnect);
  const doubaoRealtimeConnectRef = useRef(doubaoRealtimeVoice.connect);
  const doubaoRealtimeStartListeningRef = useRef(doubaoRealtimeVoice.startListening);
  useEffect(() => {
    realtimeDisconnectRef.current = realtimeVoice.disconnect;
    doubaoDisconnectRef.current = voiceInteraction.disconnect;
    doubaoRealtimeDisconnectRef.current = doubaoRealtimeVoice.disconnect;
    doubaoRealtimeConnectRef.current = doubaoRealtimeVoice.connect;
    doubaoRealtimeStartListeningRef.current = doubaoRealtimeVoice.startListening;
  }, [realtimeVoice.disconnect, voiceInteraction.disconnect, doubaoRealtimeVoice.disconnect, doubaoRealtimeVoice.connect, doubaoRealtimeVoice.startListening]);

  // 介入验证后自动连接 realtime 的标记
  const postInterventionAutoConnectRef = useRef(false);
  // 介入后追问模式：禁止语音指令（如"知道了"）自动恢复视频，只允许手动点播放
  const postInterventionChatRef = useRef(false);

  // 备用：如果 onAllDone 10 秒内没触发（TTS 异常），强制切换到实时模式
  useEffect(() => {
    if (!pendingInterventionSwitch) return;
    const fallback = setTimeout(() => {
      if (pendingInterventionSwitch) {
        console.warn("[VoiceChat] onAllDone timeout (10s), force switching to realtime");
        setPendingInterventionSwitch(false);
        setStatus("connecting");
        onEndIntervention?.();
        postInterventionAutoConnectRef.current = true;
        postInterventionChatRef.current = true;
      }
    }, 10000);
    return () => clearTimeout(fallback);
  }, [pendingInterventionSwitch, onEndIntervention]);

  const prevVoiceBackendRef = useRef(voiceBackend);
  const isReconnectingRef = useRef(false);
  useEffect(() => {
    if (isActive && prevVoiceBackendRef.current !== voiceBackend && !isReconnectingRef.current) {
      const prevBackend = prevVoiceBackendRef.current;
      console.log(`[VoiceInteraction] voiceBackend 变化: ${prevBackend} -> ${voiceBackend}，重新连接`);
      prevVoiceBackendRef.current = voiceBackend;
      isReconnectingRef.current = true;

      // 切换到 doubao_realtime 时
      if (voiceBackend === "doubao_realtime") {
        // 先断开旧连接
        if (prevBackend === "openai") {
          realtimeDisconnectRef.current();
        } else if (prevBackend === "doubao") {
          doubaoDisconnectRef.current();
        }

        // 介入验证后：自动连接 realtime 并开启麦克风（无需进入待机模式）
        if (postInterventionAutoConnectRef.current) {
          postInterventionAutoConnectRef.current = false;
          console.log("[VoiceChat] Post-intervention: auto-connecting realtime for follow-up");
          setTimeout(async () => {
            try {
              setIsWakeWordMode(false);
              setStatus("connecting");
              await doubaoRealtimeConnectRef.current();
              await doubaoRealtimeStartListeningRef.current();
              setStatus("listening");
              console.log("[VoiceChat] Post-intervention: realtime connected, mic active");
            } catch (err) {
              console.error("[VoiceChat] Post-intervention auto-connect failed:", err);
              setIsWakeWordMode(true);
              setStatus("listening");
            } finally {
              isReconnectingRef.current = false;
            }
          }, 300);
          return;
        }

        // 正常切换：进入待机模式
        console.log("[VoiceChat] Switched to doubao_realtime, entering standby mode");
        setIsWakeWordMode(true);
        setStatus("listening");
        isReconnectingRef.current = false;
        return;
      }

      // 断开旧 backend 的连接（通过独立 ref 确保调用正确的 disconnect）
      if (prevBackend === "openai") {
        realtimeDisconnectRef.current();
      } else if (prevBackend === "doubao") {
        doubaoDisconnectRef.current();
      } else if (prevBackend === "doubao_realtime") {
        doubaoRealtimeDisconnectRef.current();
      }

      // 延迟重新连接，确保断开完成
      setTimeout(async () => {
        console.log(`[VoiceInteraction] 重新连接到 ${voiceBackend} 模式`);
        try {
          // 主动调用 connect，不依赖 isActive useEffect
          await connectRef.current();
          console.log(`[VoiceInteraction] 重新连接到 ${voiceBackend} 模式成功`);
        } catch (err) {
          console.error(`[VoiceInteraction] 重新连接失败:`, err);
          setConnectionError(err instanceof Error ? err.message : "重新连接失败");
          setStatus("error");
        } finally {
          isReconnectingRef.current = false;
        }
      }, 300);
    } else {
      prevVoiceBackendRef.current = voiceBackend;
    }
  }, [voiceBackend, isActive]);

  // 视频播放时自动断连 realtime 并回到待机模式
  useEffect(() => {
    if (isVideoPlaying && voiceBackendRef.current === "doubao_realtime" && !isWakeWordMode) {
      console.log("[VoiceChat] Video started playing, disconnecting realtime → standby");
      postInterventionChatRef.current = false;  // 用户手动点播放，清除追问模式
      if (followupTimerRef.current) {
        clearTimeout(followupTimerRef.current);
        followupTimerRef.current = null;
      }
      doubaoRealtimeDisconnectRef.current();
      setIsWakeWordMode(true);
      setStatus("listening");
    }
  }, [isVideoPlaying, isWakeWordMode]);

  // 监听介入配置变化，重新初始化会话并播放介入问题
  // 使用 ref 来追踪当前正在处理的介入配置ID
  const interventionTriggeredIdRef = useRef<string | null>(null);
  const interventionReconnectingRef = useRef(false);

  // 当 interventionConfig 清除时，重置触发标记
  useEffect(() => {
    if (!interventionConfig) {
      console.log('[VoiceInteraction] interventionConfig 已清除，重置触发标记');
      interventionTriggeredIdRef.current = null;
      interventionReconnectingRef.current = false;
      // Clear any playing intervention TTS audio (button-based TTS interruption)
      interventionAudioPlayback.clear();
      // 清除回答超时计时器
      if (interventionAnswerTimerRef.current) {
        clearTimeout(interventionAnswerTimerRef.current);
        interventionAnswerTimerRef.current = null;
      }
    }
  }, [interventionConfig]); // interventionAudioPlayback.clear is stable

  // 构建介入验证 prompt 的工具函数
  const buildInterventionPrompt = useCallback((questionText: string) => {
    return `你现在进入【极简验证模式】。你的唯一任务是验证学生的答案。

**学生刚才被问的问题：**
${questionText}

**你现在要做的：**
学生会回答这个问题。你只需要：
1. 判断对错
2. 用一句简短的话回应（不超过10个字）

**绝对禁止：**
- 禁止解释
- 禁止举例
- 禁止说"比如"
- 禁止列举
- 禁止超过15个字

**示例回应：**
- "对了！" "没错！" "答对了，继续看视频吧"
- "不对哦，答案是..."（一句话纠正）`;
  }, []);

  // 介入 useEffect 1: 检查点触发时播放问题 TTS
  // 优先使用预生成的动态问题（缓存命中时 dynamicQuestion 已有值），否则用 fallback
  useEffect(() => {
    const currentInterventionId = interventionConfig?.checkpoint?.id || null;

    // 立即触发：只要有 interventionConfig + doubao 模式 + 尚未触发
    const shouldTrigger = interventionConfig
      && voiceBackend === "doubao"
      && currentInterventionId
      && interventionTriggeredIdRef.current !== currentInterventionId;

    if (shouldTrigger) {
      console.log('[VoiceInteraction] 介入触发, checkpointId:', currentInterventionId);
      interventionTriggeredIdRef.current = currentInterventionId;

      // 选择问题：预生成动态问题 > fallback hardcoded 问题
      let questionText: string;
      const dynamicQ = interventionConfig.dynamicQuestion;
      if (dynamicQ && dynamicQ !== 'fallback' && typeof dynamicQ === 'object' && dynamicQ.content) {
        // 预生成缓存命中
        questionText = dynamicQ.content;
        console.log('[VoiceInteraction] 使用预生成动态问题:', questionText.substring(0, 50));
      } else {
        // fallback: checkpoint 自带的 hardcoded 问题
        const checkpoint = interventionConfig.checkpoint;
        const intro = checkpoint.checkpoint_intro || "";
        const question = checkpoint.checkpoint_question || "";
        questionText = intro && question
          ? `${intro}\n\n${question}`
          : (question || intro);
        console.log('[VoiceInteraction] 使用 fallback 问题:', questionText.substring(0, 50));
      }

      // 更新 LLM system prompt（始终与 TTS 播放的问题一致）
      voiceInteraction.updateSessionConfig({
        systemPrompt: buildInterventionPrompt(questionText),
        tools: [],
      });

      // 添加AI问题到对话框
      setMessages(prev => [...prev, {
        id: `intervention-${Date.now()}`,
        role: "assistant",
        content: questionText,
        timestamp: new Date(),
      }]);
      onLogMessage?.('assistant', questionText);

      // 播放 TTS：speak() 内部通过 processQueue auto-reconnect 自动建连
      console.log('[VoiceInteraction] TTS 播放问题:', questionText.substring(0, 50));
      interventionTTS.speak(questionText);
    }
  }, [interventionConfig, voiceBackend, interventionTTS, onLogMessage, voiceInteraction.updateSessionConfig, buildInterventionPrompt]);

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
    onAISpeakingChange?.(status === "speaking" || status === "drawing");
  }, [status, onAISpeakingChange]);

  // Sync draw_explain state with status
  useEffect(() => {
    if (drawExplainState === "generating") {
      setStatus("generating");
    } else if (drawExplainState === "executing") {
      setStatus("drawing");
    } else if (drawExplainState === "completed") {
      setStatus("listening");
    } else if (drawExplainState === "error") {
      setStatus("error");
    }
  }, [drawExplainState]);

  // Connect draw_explain voice when in draw_explain mode
  useEffect(() => {
    if (voiceMode === "draw_explain" && isActive && !drawExplainVoice.isConnected) {
      drawExplainVoice.connect().catch((err) => {
        console.error("Draw-explain connect error:", err);
      });
    }
  }, [voiceMode, isActive, drawExplainVoice]);

  // Note: useVoiceInteraction hook handles its own cleanup on unmount
  // No need to call disconnect here - it causes issues with React Strict Mode

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

  // 处理模式切换 - 切换到边画边讲时停止麦克风
  const handleVoiceModeChange = useCallback((newMode: VoiceMode) => {
    if (newMode === "draw_explain" && isListening) {
      // 切换到边画边讲模式时，停止麦克风监听
      console.log("Switching to draw_explain mode, stopping mic...");
      stopListening();
    }
    onVoiceModeChange?.(newMode);
  }, [isListening, stopListening, onVoiceModeChange]);

  // 处理快捷意图选择
  // 发送文本消息（自动连接如果未连接）
  const sendTextWithAutoConnect = useCallback(async (text: string) => {
    // 如果对话未激活，先激活
    if (!isActive) {
      onToggle();
    }

    if (voiceMode === "draw_explain") {
      setStatus("generating");
      onPauseVideo();
      drawExplainVoice.generate(text);
      return;
    }

    onPauseVideo();

    if (!isConnected && voiceBackend === "doubao_realtime") {
      // 未连接时自动连接再发送
      console.log("[AutoConnect] Not connected, connecting before sending text...");
      setIsWakeWordMode(false);
      setStatus("connecting");
      setConnectionError("");
      try {
        await doubaoRealtimeVoice.connect();
        console.log("[AutoConnect] Connected, sending text message:", text);
        setStatus("thinking");
        await doubaoRealtimeVoice.sendTextMessage(text);
      } catch (err) {
        console.error("[AutoConnect] Failed:", err);
        setConnectionError(err instanceof Error ? err.message : "连接失败");
        setStatus("error");
        setIsWakeWordMode(true);
      }
    } else {
      setStatus("thinking");
      sendTextMessage(text);
    }
  }, [isActive, onToggle, voiceMode, isConnected, voiceBackend, onPauseVideo, drawExplainVoice, doubaoRealtimeVoice, sendTextMessage]);

  const handleQuickIntent = (prompt: string) => {
    console.log("Quick intent selected:", prompt);
    sendTextWithAutoConnect(prompt);
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

    sendTextWithAutoConnect(textInput);
    setTextInput("");
  };

  return (
    <div className={embedded ? "h-full flex flex-col bg-[#1a1a1a]" : "bg-[#1a1a1a] rounded-2xl overflow-hidden shadow-lg"}>
      {/* Header - 仅非嵌入模式显示 */}
      {!embedded && (
        <div className="px-5 py-4 flex items-center justify-between">
          <span className="text-white font-semibold text-lg tracking-tight">Chat Transcript</span>
          <button
            onClick={onToggle}
            className="text-gray-400 hover:text-white transition-colors p-1"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Content */}
      <div ref={messagesContainerRef} className={embedded ? "flex-1 px-5 py-4 space-y-5 overflow-y-auto" : "px-5 py-4 space-y-5 max-h-96 overflow-y-auto"}>
        {/* 需要麦克风权限 */}
        {isActive && status === "need_permission" && voiceMode === "realtime" && (
          <div className="text-center py-8">
            <p className="text-[#e8e8e8] mb-4">Click to enable microphone</p>
            {permissionError && (
              <p className="text-red-400 text-sm mb-4">{permissionError}</p>
            )}
            <button
              onClick={handleStartListening}
              className="bg-[#333] hover:bg-[#444] text-white px-6 py-2.5 rounded-full text-sm transition-colors"
            >
              Enable Microphone
            </button>
          </div>
        )}

        {/* 待机模式 — 点击按钮开始语音对话 */}
        {isWakeWordMode && voiceBackend === "doubao_realtime" && (
          <div className="text-center py-8">
            <button
              onClick={handleStartVoiceChat}
              className="mx-auto flex items-center justify-center cursor-pointer"
              title="点击开始语音对话"
            >
              <div className="w-16 h-16 rounded-full flex items-center justify-center transition-colors bg-[#333] hover:bg-[#444]">
                <svg className="w-8 h-8 text-[#4ECDC4]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
                </svg>
              </div>
            </button>
            <p className="text-[#e8e8e8] text-base mb-1 mt-4">点击麦克风开始语音对话</p>
            <p className="text-[#666] text-xs">AI老师随时准备回答你的问题</p>
          </div>
        )}

        {/* 连接中 — 唤醒词模式下不显示（由唤醒词 UI 替代） */}
        {isActive && status === "connecting" && !isWakeWordMode && messages.length === 0 && (
          <div className="text-center py-8">
            <div className="flex justify-center mb-3">
              <div className="w-2 h-2 bg-[#666] rounded-full animate-pulse mx-0.5" />
              <div className="w-2 h-2 bg-[#666] rounded-full animate-pulse mx-0.5 animation-delay-150" />
              <div className="w-2 h-2 bg-[#666] rounded-full animate-pulse mx-0.5 animation-delay-300" />
            </div>
            <p className="text-[#888] text-sm">Connecting...</p>
          </div>
        )}

        {/* 错误状态 */}
        {isActive && status === "error" && (
          <div className="text-center py-8">
            <p className="text-red-400 mb-2">Connection failed</p>
            <p className="text-[#666] text-sm mb-4">{connectionError || "Please check your network"}</p>
            <button
              onClick={() => {
                setStatus("connecting");
                connect();
              }}
              className="bg-[#333] hover:bg-[#444] text-white px-6 py-2 rounded-full text-sm transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {/* 对话历史 */}
        {messages.length > 0 && (
          <div className="space-y-5">
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
          </div>
        )}

        {/* 正在输入的用户问题 */}
        {currentTranscript && (
          <div className="flex flex-col gap-1.5 items-end">
            <span className="text-[#888] text-sm pr-1">You</span>
            <div className="max-w-[85%] rounded-2xl px-4 py-3 bg-[#2a2a2a] text-[#e8e8e8]">
              <p className="text-[15px]">{currentTranscript}</p>
            </div>
          </div>
        )}

        {/* 正在生成的 AI 回答 */}
        {currentAnswer && (
          <div className="flex flex-col gap-1.5 items-start">
            <span className="text-[#888] text-sm pl-1">AI老师</span>
            <div className="max-w-[85%] rounded-2xl px-4 py-3 bg-[#2a2a2a] text-[#e8e8e8]">
              <div
                className="whitespace-pre-wrap break-words text-[15px] leading-relaxed"
                dangerouslySetInnerHTML={{ __html: renderTextWithLatex(currentAnswer) }}
              />
              {pendingWhiteboard && (
                <div className="mt-3">
                  <Whiteboard
                    type={pendingWhiteboard.type}
                    content={pendingWhiteboard.content}
                    steps={pendingWhiteboard.steps}
                    graphConfig={pendingWhiteboard.graphConfig}
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* 正在切换到实时模式（介入验证后） */}
        {(pendingInterventionSwitch || (status === "connecting" && messages.length > 0)) && (
          <div className="flex justify-center py-3">
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#2a2a2a]">
              <div className="w-1.5 h-1.5 bg-[#4ECDC4] rounded-full animate-pulse" />
              <span className="text-[#888] text-sm">正在切换中...</span>
            </div>
          </div>
        )}

        {/* 思考中 */}
        {status === "thinking" && !currentAnswer && (
          <div className="flex flex-col gap-1.5 items-start">
            <span className="text-[#888] text-sm pl-1">AI老师</span>
            <div className="rounded-2xl px-4 py-3 bg-[#2a2a2a] inline-block">
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 bg-[#666] rounded-full animate-pulse" />
                <div className="w-1.5 h-1.5 bg-[#666] rounded-full animate-pulse" style={{ animationDelay: "0.15s" }} />
                <div className="w-1.5 h-1.5 bg-[#666] rounded-full animate-pulse" style={{ animationDelay: "0.3s" }} />
              </div>
            </div>
          </div>
        )}

        {/* 用户正在说话 */}
        {status === "user_speaking" && !currentTranscript && (
          <div className="flex flex-col gap-1.5 items-end">
            <span className="text-[#888] text-sm pr-1">You</span>
            <div className="rounded-2xl px-4 py-3 bg-[#2a2a2a] inline-block">
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 bg-[#666] rounded-full animate-pulse" />
                <div className="w-1.5 h-1.5 bg-[#666] rounded-full animate-pulse" style={{ animationDelay: "0.15s" }} />
                <div className="w-1.5 h-1.5 bg-[#666] rounded-full animate-pulse" style={{ animationDelay: "0.3s" }} />
              </div>
            </div>
          </div>
        )}

        {/* 生成绘图脚本中 */}
        {status === "generating" && (
          <div className="flex flex-col gap-1.5 items-start">
            <span className="text-[#888] text-sm pl-1">AI老师</span>
            <div className="rounded-2xl px-4 py-3 bg-[#2a2a2a] text-[#888] text-sm">
              Preparing drawing explanation...
            </div>
          </div>
        )}

        {/* 边画边讲进度 */}
        {status === "drawing" && drawExplainProgress && (
          <div className="flex flex-col gap-1.5 items-start">
            <span className="text-[#888] text-sm pl-1">AI老师</span>
            <div className="rounded-2xl px-4 py-3 bg-[#2a2a2a] min-w-[200px]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[#e8e8e8] text-sm">Drawing & Explaining</span>
                <button
                  onClick={() => drawExplainVoice.stop()}
                  className="text-[#888] hover:text-white text-xs"
                >
                  Stop
                </button>
              </div>
              <div className="w-full bg-[#444] rounded-full h-1">
                <div
                  className="bg-[#888] h-1 rounded-full transition-all duration-300"
                  style={{
                    width: `${((drawExplainProgress.currentStepIndex + 1) / drawExplainProgress.totalSteps) * 100}%`,
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* 快捷意图按钮 - 始终显示 */}
        <div className="pt-3">
          <QuickIntents
            currentSubtitle={currentSubtitle}
            onSelect={handleQuickIntent}
          />
        </div>
      </div>

      {/* 底部文字输入框 - 始终显示 */}
      {embedded && (
        <form onSubmit={handleTextSubmit} className="px-4 py-4 shrink-0">
          <div className="flex items-center gap-3 bg-[#2a2a2a] rounded-full px-4 py-2">
            <input
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="Type here..."
              className="flex-1 bg-transparent text-[#e8e8e8] text-[15px] focus:outline-none placeholder-[#666]"
              disabled={status === "thinking" || status === "speaking" || status === "generating" || status === "drawing"}
            />
            <button
              type="submit"
              disabled={!textInput.trim() || status === "thinking" || status === "speaking" || status === "generating" || status === "drawing"}
              className="text-[#666] hover:text-[#888] disabled:text-[#444] disabled:cursor-not-allowed transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
