"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { VideoPlayer, VideoPlayerHandle } from "@/components/video-player/VideoPlayer";
import { ChatPanel } from "@/components/chat-panel/ChatPanel";
import { GamePrompt } from "@/components/game-player/GamePrompt";
import { DrawingOverlay, TldrawCanvasHandle, DrawingShape } from "@/components/drawing-canvas";
import { LearningReportModal } from "@/components/learning-report/LearningReportModal";
import { getVideoById, SubtitleCue } from "@/data/videos";
import { VoiceMode, VoiceBackend } from "@/types/drawing-script";
import { useAdaptiveQuestions } from "@/hooks/useAdaptiveQuestions";
import { useAuth } from "@/components/auth/AuthProvider";
import { clearPersistedMessages } from "@/components/voice-interaction/VoiceInteraction";
import type { LearningAnalysis } from "@/lib/agents/types";

interface ClientVideo {
  id: string;
  title: string;
  description: string;
  videoUrl: string;
  duration: number;
  teacher: string;
  status: string;
  nodeCount: number;
}

// API 使用 Next.js API Routes
const API_BASE = "";

interface VideoContext {
  currentTime: number;
  subtitle: string;
  context: string;
}

// 格式化时间
const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

interface TranscribeResponse {
  videoId: string;
  language: string;
  duration: number;
  fullText: string;
  subtitles: SubtitleCue[];
}

export default function WatchPage() {
  const params = useParams();
  const router = useRouter();
  const videoId = params.id as string;

  // 视频数据状态
  const [video, setVideo] = useState<ClientVideo | null>(null);
  const [videoLoading, setVideoLoading] = useState(true);
  const [videoError, setVideoError] = useState<string>("");

  // 学习报告弹窗状态
  const [showLearningReport, setShowLearningReport] = useState(false);
  const [analysisData, setAnalysisData] = useState<LearningAnalysis | null>(null);
  // 是否关闭报告后导航回首页
  const pendingNavigateRef = useRef(false);

  // V2 自适应提问系统
  const { user } = useAuth();
  const studentId = user?.id ?? 'anonymous';
  const {
    introQuestions,
    currentQuestion,
    isLoading: isAdaptiveLoading,
    fetchIntroQuestions,
    fetchCheckpointQuestion,
    submitLearningData,
    logMessage,
    logCheckpointResponse,
    hasUnsavedData,
    getBeaconPayload,
    pregenerateCheckpointQuestions,
    getPregeneratedQuestion,
  } = useAdaptiveQuestions({
    studentId,
    videoId,
    videoTitle: video?.title,
    onError: (error) => console.error('[AdaptiveQuestions] Error:', error),
  });

  // 加载视频数据
  useEffect(() => {
    if (!videoId) return;

    const loadVideo = async () => {
      setVideoLoading(true);
      try {
        // 先尝试从 API 获取（新上传的视频）
        const response = await fetch(`${API_BASE}/api/video/${videoId}`);

        if (response.ok) {
          const json = await response.json();
          const data: ClientVideo = json.video || json;
          setVideo(data);
        } else {
          // 如果 API 失败，尝试从旧的硬编码数据获取（向后兼容）
          const fallbackVideo = getVideoById(videoId);
          if (fallbackVideo) {
            setVideo({
              id: fallbackVideo.id,
              title: fallbackVideo.title,
              description: fallbackVideo.description,
              videoUrl: fallbackVideo.videoUrl,
              duration: fallbackVideo.duration,
              teacher: fallbackVideo.teacher,
              status: 'ready',
              nodeCount: 0,
            });
          } else {
            setVideoError("视频不存在");
          }
        }
      } catch (error) {
        console.error("Failed to load video:", error);
        // 尝试回退到旧数据
        const fallbackVideo = getVideoById(videoId);
        if (fallbackVideo) {
          setVideo({
            id: fallbackVideo.id,
            title: fallbackVideo.title,
            description: fallbackVideo.description,
            videoUrl: fallbackVideo.videoUrl,
            duration: fallbackVideo.duration,
            teacher: fallbackVideo.teacher,
            status: 'ready',
            nodeCount: 0,
          });
        } else {
          setVideoError("视频加载失败");
        }
      } finally {
        setVideoLoading(false);
      }
    };

    loadVideo();
  }, [videoId]);

  // 视频播放器 ref
  const videoPlayerRef = useRef<VideoPlayerHandle>(null);

  // 对话状态
  const [isInConversation, setIsInConversation] = useState(false);
  const [hasEverJoined, setHasEverJoined] = useState(false);  // 是否曾经加入过对话（用于控制聊天面板显示）
  const [autoStartMic, setAutoStartMic] = useState(false);  // 是否自动开启麦克风
  const [videoContext, setVideoContext] = useState<VideoContext>({
    currentTime: 0,
    subtitle: "",
    context: "",
  });

  // 字幕状态
  const [subtitles, setSubtitles] = useState<SubtitleCue[]>([]);
  const [subtitleStatus, setSubtitleStatus] = useState<"loading" | "ready" | "error">("loading");
  const [subtitleError, setSubtitleError] = useState<string>("");

  // 节点状态
  interface VideoNode {
    order: number;
    title: string;
    startTime: number;
    endTime: number;
    id?: string;
  }
  const [nodes, setNodes] = useState<VideoNode[]>([]);

  // 游戏提示状态
  const [showGamePrompt, setShowGamePrompt] = useState(false);
  const [completedNode, setCompletedNode] = useState<VideoNode | null>(null);

  // 全屏状态
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showChatInFullscreen, setShowChatInFullscreen] = useState(true);
  const fullscreenContainerRef = useRef<HTMLDivElement>(null);

  // 语音状态（用于控制栏显示）
  const [isMicActive, setIsMicActive] = useState(false);
  const [isAISpeaking, setIsAISpeaking] = useState(false);

  // 视频播放状态（用于全屏控制栏显示）
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);

  // 必停点介入状态
  const [isCheckpointIntervening, setIsCheckpointIntervening] = useState(false);
  const [currentCheckpoint, setCurrentCheckpoint] = useState<any>(null);
  const [interventionConfig, setInterventionConfig] = useState<any>(null);

  // 字幕显示状态
  const [showSubtitles, setShowSubtitles] = useState(true);

  // 悬浮节点状态（用于全屏模式进度条）
  const [hoveredNode, setHoveredNode] = useState<VideoNode | null>(null);

  // 画板状态
  const [isDrawingOpen, setIsDrawingOpen] = useState(false);
  const drawingCanvasRef = useRef<TldrawCanvasHandle>(null);

  // 语音交互模式状态
  const [voiceMode, setVoiceMode] = useState<VoiceMode>("realtime");
  // 语音后端状态
  const [voiceBackend, setVoiceBackend] = useState<VoiceBackend>("doubao_realtime");
  // 语音后端选择弹窗状态

  // 加载字幕
  useEffect(() => {
    if (!videoId) return;

    const loadSubtitles = async () => {
      setSubtitleStatus("loading");
      try {
        const response = await fetch(`${API_BASE}/api/transcribe`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ videoId }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Failed to load subtitles");
        }

        const data: TranscribeResponse = await response.json();
        setSubtitles(data.subtitles);
        setSubtitleStatus("ready");
        console.log(`Loaded ${data.subtitles.length} subtitle cues`);
      } catch (error) {
        console.error("Failed to load subtitles:", error);
        setSubtitleError(error instanceof Error ? error.message : "Unknown error");
        setSubtitleStatus("error");
      }
    };

    loadSubtitles();
  }, [videoId]);

  // 加载节点数据
  useEffect(() => {
    if (!videoId) return;

    const loadNodes = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/video/${videoId}/context`);
        if (response.ok) {
          const data = await response.json();
          if (data.nodes && Array.isArray(data.nodes)) {
            setNodes(data.nodes.map((n: { id?: string; order: number; title: string; startTime: number; endTime: number }) => ({
              id: n.id || `node-${videoId}-${n.order}`,
              order: n.order,
              title: n.title,
              startTime: n.startTime,
              endTime: n.endTime,
            })));
            console.log(`Loaded ${data.nodes.length} video nodes`);
          }
        }
      } catch (error) {
        console.error("Failed to load nodes:", error);
        // 节点加载失败不阻塞页面
      }
    };

    loadNodes();
  }, [videoId]);

  // 检查点数据（含 summary, key_concepts，用于预生成动态问题）
  const checkpointsRef = useRef<any[]>([]);
  useEffect(() => {
    if (!videoId) return;
    const loadCheckpoints = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/video/${videoId}/checkpoint`);
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.data) {
            checkpointsRef.current = json.data;
            console.log(`[V2] Loaded ${json.data.length} checkpoints for pre-generation`);
          }
        }
      } catch (error) {
        console.error('[V2] Failed to load checkpoints:', error);
      }
    };
    loadCheckpoints();
  }, [videoId]);

  // 首次加入对话时，预生成所有检查点的动态问题
  const hasPregeneratedRef = useRef(false);
  useEffect(() => {
    if (isInConversation && !hasPregeneratedRef.current && checkpointsRef.current.length > 0) {
      hasPregeneratedRef.current = true;
      pregenerateCheckpointQuestions(
        checkpointsRef.current.map((cp: any) => ({
          id: cp.id,
          title: cp.title,
          summary: cp.summary,
          keyConcepts: cp.key_concepts,
        }))
      );
    }
  }, [isInConversation, pregenerateCheckpointQuestions]);

  // 首次加入时标记，使聊天面板可见（之后不再隐藏，保留对话记录）
  useEffect(() => {
    if (isInConversation) {
      setHasEverJoined(true);
    }
  }, [isInConversation]);

  // 切换对话状态
  const toggleConversation = useCallback(() => {
    setIsInConversation((prev) => !prev);
  }, []);

  // 更新视频上下文
  const handleContextUpdate = useCallback((context: VideoContext) => {
    setVideoContext(context);
  }, []);

  // 暂停视频（用户开始说话时）
  const handlePauseVideo = useCallback(() => {
    console.log("Pausing video");
    videoPlayerRef.current?.pause();
  }, []);

  // 恢复视频（AI 调用 resume_video 时）
  const handleResumeVideo = useCallback(() => {
    console.log('[WatchPage] 恢复视频播放');

    // 如果在介入模式中（通过 interventionConfig 判断），切换回实时模式
    if (interventionConfig) {
      console.log('[WatchPage] 介入结束：切换回实时模式（doubao_realtime）');

      // 清除介入状态
      setIsCheckpointIntervening(false);
      setCurrentCheckpoint(null);
      setInterventionConfig(null);

      // 切换回实时模式
      setVoiceBackend("doubao_realtime");
    }

    // 恢复播放
    videoPlayerRef.current?.play();
  }, [interventionConfig]);

  // 跳转到指定时间（AI 调用 jump_to_video_node 时）
  const handleJumpToTime = useCallback((time: number) => {
    console.log("Jumping to time:", time);
    videoPlayerRef.current?.seekTo(time);
    videoPlayerRef.current?.play();
  }, []);

  // 节点播放完成时的回调
  const handleNodeComplete = useCallback((node: VideoNode) => {
    console.log("Node completed:", node.title);
    // 暂停视频并显示游戏提示
    videoPlayerRef.current?.pause();
    setCompletedNode(node);
    setShowGamePrompt(true);
  }, []);

  // 关闭游戏提示（跳过游戏）
  const handleDismissGame = useCallback(() => {
    setShowGamePrompt(false);
    setCompletedNode(null);
    // 继续播放视频
    videoPlayerRef.current?.play();
  }, []);

  // 游戏完成后继续播放
  const handleGameContinue = useCallback(() => {
    setShowGamePrompt(false);
    setCompletedNode(null);
    // 继续播放视频
    videoPlayerRef.current?.play();
  }, []);

  // 处理必停点介入
  const handleCheckpointIntervention = useCallback((checkpoint: any) => {
    console.log('[WatchPage] 必停点介入:', checkpoint.title);
    setIsCheckpointIntervening(true);
    setCurrentCheckpoint(checkpoint);

    // 如果对话已经开启，先关闭它（确保会话重新初始化）
    if (isInConversation) {
      console.log('[WatchPage] 关闭现有对话，准备重新初始化');
      setIsInConversation(false);
    }

    // 切换到精准模式（doubao backend）
    console.log('[WatchPage] 介入模式：切换到精准模式（doubao backend）');
    setVoiceBackend("doubao");

    // 先查预生成缓存
    const cachedQuestion = getPregeneratedQuestion(checkpoint.id);
    if (cachedQuestion) {
      // 缓存命中：直接设置动态问题，0ms 延迟
      console.log('[V2] 预生成缓存命中:', cachedQuestion.content.substring(0, 50));
      setInterventionConfig({
        checkpoint: checkpoint,
        isIntervention: true,
        dynamicQuestion: cachedQuestion,
      });
    } else {
      // 缓存未命中：先设置 null，异步 fetch
      console.log('[V2] 预生成缓存未命中，使用 fallback 并异步 fetch');
      setInterventionConfig({
        checkpoint: checkpoint,
        isIntervention: true,
        dynamicQuestion: null,
      });

      // 获取自适应检查点问题（V2 系统 - 根据学生画像动态生成）
      fetchCheckpointQuestion({
        title: checkpoint.title,
        summary: checkpoint.summary,
        keyConcepts: checkpoint.key_concepts,
      }).then((question) => {
        if (question) {
          console.log('[V2] 检查点动态问题已生成:', question.content);
          setInterventionConfig((prev: any) => prev ? {
            ...prev,
            dynamicQuestion: question,
          } : prev);
        } else {
          console.warn('[V2] 动态问题生成失败，使用 hardcoded fallback');
          setInterventionConfig((prev: any) => prev ? {
            ...prev,
            dynamicQuestion: 'fallback',
          } : prev);
        }
      });
    }

    // 设置自动启动麦克风
    setAutoStartMic(true);

    // 延迟开启对话，确保所有状态都已更新
    setTimeout(() => {
      console.log('[WatchPage] 开启介入对话');
      setIsInConversation(true);
    }, 100);
  }, [isInConversation, fetchCheckpointQuestion, getPregeneratedQuestion]);

  // 结束必停点介入 — 清除全部介入状态，切回实时模式（由 VoiceInteraction 自动连接）
  const handleEndIntervention = useCallback(() => {
    console.log('[WatchPage] 结束必停点介入，切换到实时模式');
    setIsCheckpointIntervening(false);
    setCurrentCheckpoint(null);
    setInterventionConfig(null);
    setVoiceBackend("doubao_realtime");
  }, []);

  // 处理用户手动播放时退出介入模式并播放视频
  const handleExitInterventionAndPlay = useCallback(() => {
    console.log('[WatchPage] handleExitInterventionAndPlay called');

    // 清除介入状态
    setIsCheckpointIntervening(false);
    setCurrentCheckpoint(null);
    setInterventionConfig(null);

    // 切换回实时模式
    setVoiceBackend("doubao_realtime");

    // 立刻播放视频
    videoPlayerRef.current?.play();

    console.log('[WatchPage] ✅ 已切换回实时模式并播放视频');
  }, []);

  // 全屏切换
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      fullscreenContainerRef.current?.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  }, []);

  // Refs for event handlers that need access to latest callback/state
  const isInConversationRef = useRef(isInConversation);
  isInConversationRef.current = isInConversation;
  const interventionConfigRef = useRef(interventionConfig);
  interventionConfigRef.current = interventionConfig;
  const handleEndCallRef = useRef<(() => Promise<void>) | null>(null);

  // 监听全屏变化 — 仅更新全屏状态，不自动结束通话
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  // beforeunload 提示 — 对话进行中时提醒用户
  useEffect(() => {
    if (!isInConversation) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isInConversation]);

  // 阻止浏览器后退键 — 对话进行中时拦截 popstate，强制使用"退出通话"按钮
  useEffect(() => {
    if (!isInConversation) return;
    // 推入一个哨兵 state，后退时会触发 popstate 而不是真正离开
    window.history.pushState({ mathtalkConversation: true }, "");
    const handler = () => {
      // 再次推入 state，防止连续后退
      window.history.pushState({ mathtalkConversation: true }, "");
    };
    window.addEventListener("popstate", handler);
    return () => window.removeEventListener("popstate", handler);
  }, [isInConversation]);

  // pagehide sendBeacon 兜底
  const hasUnsavedDataRef = useRef(hasUnsavedData);
  hasUnsavedDataRef.current = hasUnsavedData;
  const getBeaconPayloadRef = useRef(getBeaconPayload);
  getBeaconPayloadRef.current = getBeaconPayload;

  useEffect(() => {
    const handler = () => {
      if (hasUnsavedDataRef.current()) {
        try {
          const payload = getBeaconPayloadRef.current();
          const blob = new Blob([JSON.stringify(payload)], {
            type: "application/json",
          });
          navigator.sendBeacon("/api/agent/main", blob);
        } catch { /* best-effort */ }
      }
    };
    window.addEventListener("pagehide", handler);
    return () => window.removeEventListener("pagehide", handler);
  }, []);

  // 全屏模式下切换聊天框
  const toggleChatInFullscreen = useCallback(() => {
    setShowChatInFullscreen((prev) => !prev);
  }, []);

  // 加入对话（指定语音后端）
  const handleSelectBackendAndJoin = useCallback(async (backend: VoiceBackend) => {
    setVoiceBackend(backend);

    // 1. 设置自动开启麦克风
    setAutoStartMic(true);
    // 2. 显示全屏聊天面板
    setShowChatInFullscreen(true);

    // 3. 进入全屏
    try {
      await fullscreenContainerRef.current?.requestFullscreen();
    } catch (e) {
      console.error("Failed to enter fullscreen:", e);
    }

    // 4. 加入对话（延迟一点确保全屏状态已更新）
    setTimeout(() => {
      setIsInConversation(true);
      // 6. 开始播放视频
      videoPlayerRef.current?.play();
    }, 100);
  }, []);

  // 点击 Join Meeting 按钮时直接进入实时模式（精准模式仅在切入点触发）
  const handleJoinMeetingClick = useCallback(() => {
    handleSelectBackendAndJoin("doubao_realtime");
  }, [handleSelectBackendAndJoin]);

  // 画板操作
  const handleOpenDrawing = useCallback(() => {
    setIsDrawingOpen(true);
  }, []);

  const handleCloseDrawing = useCallback(() => {
    setIsDrawingOpen(false);
  }, []);

  const handleDrawShapes = useCallback((shapes: DrawingShape[]) => {
    console.log("handleDrawShapes called, isDrawingOpen:", isDrawingOpen, "shapes:", shapes);

    if (!isDrawingOpen) {
      setIsDrawingOpen(true);
      // When opening the canvas, wait longer for Tldraw to fully initialize
      const tryDraw = (attempts: number) => {
        setTimeout(() => {
          if (drawingCanvasRef.current) {
            console.log("Drawing shapes on canvas");
            drawingCanvasRef.current.drawShapes(shapes);
          } else if (attempts > 0) {
            console.log("Canvas not ready, retrying...", attempts);
            tryDraw(attempts - 1);
          } else {
            console.error("Failed to draw shapes: canvas not ready after retries");
          }
        }, 300);
      };
      tryDraw(5); // Try up to 5 times with 300ms intervals
    } else {
      // Canvas is already open, draw immediately
      setTimeout(() => {
        drawingCanvasRef.current?.drawShapes(shapes);
      }, 100);
    }
  }, [isDrawingOpen]);

  const handleClearDrawing = useCallback(() => {
    drawingCanvasRef.current?.clear();
  }, []);

  // 切换字幕显示
  const toggleSubtitles = useCallback(() => {
    setShowSubtitles((prev) => !prev);
  }, []);

  // 语音状态回调
  const handleMicStatusChange = useCallback((active: boolean) => {
    setIsMicActive(active);
  }, []);

  const handleAISpeakingChange = useCallback((speaking: boolean) => {
    setIsAISpeaking(speaking);
  }, []);

  // 退出通话 - 立即弹出 loading 弹窗，后台提交学习数据
  const handleEndCall = useCallback(async () => {
    console.log('[V2] 退出对话，立即显示 loading 弹窗...');

    // 0. 清空对话记录（只在退出通话时清空，全屏切换不清空）
    clearPersistedMessages();

    // 1. 立即清理对话状态
    setIsInConversation(false);
    setIsMicActive(false);
    setAutoStartMic(false);

    // 2. 退出全屏以确保 Dialog Portal 可见
    if (document.fullscreenElement) {
      try { await document.exitFullscreen(); } catch { /* ignore */ }
    }

    // 3. 立即显示 loading 弹窗（analysisData 仍为 null，modal 显示骨架屏）
    setShowLearningReport(true);

    // 4. 后台提交学习数据
    try {
      const analysis = await submitLearningData({
        videoNodes: nodes.map(n => n.title),
      });
      if (analysis) {
        console.log('[V2] 学习分析完成:', {
          overallLevel: analysis.overallLevel,
          problemTags: analysis.problemTags,
          nextStrategy: analysis.nextStrategy,
        });
        setAnalysisData(analysis);
      } else {
        // 分析返回 null，关闭弹窗跳转首页
        setShowLearningReport(false);
        router.push('/');
      }
    } catch (error) {
      console.error('[V2] 学习分析失败:', error);
      // 失败时关闭弹窗跳转首页
      setShowLearningReport(false);
      router.push('/');
    }
  }, [submitLearningData, nodes, router]);
  handleEndCallRef.current = handleEndCall;

  // 关闭学习报告弹窗 → 总是跳转首页
  const handleReportClose = useCallback(() => {
    setShowLearningReport(false);
    setAnalysisData(null);
    router.push('/');
  }, [router]);

  // 返回按钮拦截
  const handleBackClick = useCallback(async () => {
    if (isInConversation && hasUnsavedData()) {
      pendingNavigateRef.current = true;
      await handleEndCall();
    } else {
      router.push('/');
    }
  }, [isInConversation, hasUnsavedData, handleEndCall, router]);


  // 视频加载中
  if (videoLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <svg className="animate-spin w-12 h-12 text-blue-500 mx-auto mb-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <p className="text-muted-foreground">加载视频中...</p>
        </div>
      </div>
    );
  }

  // 视频不存在或加载失败
  if (!video || videoError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-4">{videoError || "视频不存在"}</h1>
          <p className="text-muted-foreground mb-6">请确认视频 ID 是否正确</p>
          <Link
            href="/"
            className="inline-block bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600"
          >
            返回首页
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      {/* Header - 非全屏时显示 */}
      {!isFullscreen && (
        <header className="bg-black/80 backdrop-blur-sm border-b border-white/10">
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-4">
            <button
              onClick={handleBackClick}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <h1 className="text-white font-semibold">{video.title}</h1>
              <p className="text-gray-400 text-sm">{video.teacher}</p>
            </div>
          </div>
        </header>
      )}

      {/* Main Content - 左右布局 */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* 字幕加载状态 */}
        {subtitleStatus === "loading" && (
          <div className="mb-4 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg flex items-center gap-3">
            <svg className="animate-spin w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span className="text-blue-300">正在识别视频字幕，首次加载可能需要30秒左右...</span>
          </div>
        )}

        {/* 字幕加载失败时不显示错误，静默降级 */}

        {subtitleStatus === "ready" && !isInConversation && (
          <div className="mb-4 p-3 bg-green-500/10 border border-green-500/20 rounded-lg flex items-center gap-2">
            <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-green-300">字幕已就绪 - 点击右下角「加入对话」随时向AI老师提问</span>
          </div>
        )}

        {/* 视频和聊天区域 - 整个区域作为全屏容器 */}
        <div
          ref={fullscreenContainerRef}
          className={`flex gap-4 ${
            isFullscreen ? "flex-col h-screen bg-black gap-0" : ""
          }`}
        >
          {/* 全屏模式：上方内容区（视频+聊天） */}
          {isFullscreen ? (
            <>
              <div className="flex flex-1 min-h-0">
                {/* 视频区域 */}
                <div
                  className={`relative bg-black ${
                    showChatInFullscreen ? "flex-1" : "w-full"
                  } h-full`}
                >
                  <VideoPlayer
                    ref={videoPlayerRef}
                    videoUrl={video.videoUrl}
                    subtitles={subtitles}
                    nodes={nodes}
                    videoId={videoId}
                    isInConversation={isInConversation}
                    isFullscreen={isFullscreen}
                    showChatInFullscreen={showChatInFullscreen}
                    showSubtitles={showSubtitles}
                    isMicActive={isMicActive}
                    isAISpeaking={isAISpeaking}
                    interventionConfig={interventionConfig}
                    isInPrecisionMode={voiceBackend === "doubao"}
                    onToggleConversation={toggleConversation}
                    onToggleChat={toggleChatInFullscreen}
                    onJoinMeeting={handleJoinMeetingClick}
                    onContextUpdate={handleContextUpdate}
                    onNodeComplete={handleNodeComplete}
                    onCheckpointIntervention={handleCheckpointIntervention}
                    onExitIntervention={handleExitInterventionAndPlay}
                    onPlayStateChange={setIsVideoPlaying}
                    hideControls={true}
                  />
                </div>

                {/* 聊天面板 - 全屏模式右侧，加入对话后显示 */}
                {hasEverJoined && showChatInFullscreen && (
                  <div className="w-[350px] shrink-0 h-full border-l border-white/10 bg-black/90">
                    <ChatPanel
                      videoContext={videoContext.context || `正在观看：${video.title}`}
                      currentSubtitle={videoContext.subtitle}
                      isActive={isInConversation}
                      videoId={videoId}
                      currentTime={videoContext.currentTime}
                      subtitles={subtitles}
                      studentId={studentId}
                      isFullscreen={isFullscreen}
                      autoStart={autoStartMic}
                      voiceMode={voiceMode}
                      voiceBackend={voiceBackend}
                      interventionConfig={interventionConfig}
                      isVideoPlaying={isVideoPlaying}

                      onLogMessage={logMessage}
                      onVoiceModeChange={setVoiceMode}
                      onVoiceBackendChange={setVoiceBackend}
                      onToggle={toggleConversation}
                      onClose={undefined}
                      onPauseVideo={handlePauseVideo}
                      onResumeVideo={handleResumeVideo}
                      onJumpToTime={handleJumpToTime}
                      onEndIntervention={handleEndIntervention}
                      onOpenDrawing={handleOpenDrawing}
                      onCloseDrawing={handleCloseDrawing}
                      onDrawShapes={handleDrawShapes}
                      onClearDrawing={handleClearDrawing}
                      onMicStatusChange={handleMicStatusChange}
                      onAISpeakingChange={handleAISpeakingChange}
                    />
                  </div>
                )}
              </div>

              {/* 全屏模式：底部统一控制栏 */}
              <div className="bg-black/90 border-t border-white/10 px-4 py-3 shrink-0 relative z-50">
                {/* 进度条 */}
                <div
                  className="relative h-1.5 bg-white/30 rounded-full mb-3 cursor-pointer group"
                  onClick={(e) => {
                    if (video.duration > 0) {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const pos = (e.clientX - rect.left) / rect.width;
                      handleJumpToTime(pos * video.duration);
                    }
                  }}
                >
                  {/* 播放进度 */}
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all"
                    style={{ width: `${video.duration > 0 ? (videoContext.currentTime / video.duration) * 100 : 0}%` }}
                  />

                  {/* 节点分隔标记 */}
                  {video.duration > 0 && nodes.map((node) => {
                    const position = (node.startTime / video.duration) * 100;
                    const isFirstNode = node.startTime <= 0;
                    return (
                      <div
                        key={node.order}
                        className="absolute top-1/2 -translate-y-1/2 cursor-pointer z-10"
                        style={{ left: `${position}%` }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleJumpToTime(node.startTime);
                        }}
                        onMouseEnter={() => setHoveredNode(node)}
                        onMouseLeave={() => setHoveredNode(null)}
                      >
                        {/* 分隔线或起始标记 */}
                        {isFirstNode ? (
                          <div className="w-2.5 h-2.5 bg-blue-400 hover:bg-blue-300 rounded-full transition-colors -translate-x-1/2" />
                        ) : (
                          <div className="w-0.5 h-4 bg-white/70 hover:bg-white transition-colors -translate-x-1/2" />
                        )}

                        {/* 节点序号 */}
                        <div className="absolute -top-5 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <span className="text-[10px] text-white/80 whitespace-nowrap">{node.order}</span>
                        </div>
                      </div>
                    );
                  })}

                  {/* 悬浮提示 */}
                  {hoveredNode && video.duration > 0 && (
                    <div
                      className="absolute -top-10 transform -translate-x-1/2 z-20 pointer-events-none"
                      style={{ left: `${(hoveredNode.startTime / video.duration) * 100}%` }}
                    >
                      <div className="bg-black/95 text-white text-xs px-2 py-1 rounded shadow-lg whitespace-nowrap">
                        <span className="font-medium">节点 {hoveredNode.order}:</span> {hoveredNode.title}
                      </div>
                    </div>
                  )}
                </div>

                {/* 控制按钮行 */}
                <div className="flex items-center justify-between">
                {/* 左侧：播放按钮和时间显示 */}
                <div className="flex items-center gap-4">
                  {/* 播放/暂停按钮 */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();

                      // 直接获取 video 元素
                      const videoEl = document.querySelector('video');

                      if (!videoEl) {
                        alert('找不到视频元素！');
                        return;
                      }

                      if (!videoEl.paused) {
                        // 视频正在播放，暂停它
                        videoEl.pause();
                      } else {
                        // 视频暂停中，清除状态并播放
                        setIsCheckpointIntervening(false);
                        setCurrentCheckpoint(null);
                        setInterventionConfig(null);
                        setVoiceBackend("doubao_realtime");
                        videoEl.play();
                      }
                    }}
                    className="bg-blue-500 hover:bg-blue-600 text-white rounded-full p-3 transition-all shadow-lg"
                    title={isVideoPlaying ? "暂停" : "播放（点我切换到实时模式）"}
                  >
                    {isVideoPlaying ? (
                      <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                      </svg>
                    ) : (
                      <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    )}
                  </button>
                  <div className="bg-white/10 rounded-lg px-3 py-1.5 text-white text-sm font-mono">
                    {formatTime(videoContext.currentTime)} / {formatTime(video.duration)}
                  </div>

                  {/* 节点选择器 - 根据当前时间自动选中 */}
                  {nodes.length > 0 && (() => {
                    // 计算当前时间所在的节点
                    const currentNode = nodes.find(
                      n => videoContext.currentTime >= n.startTime && videoContext.currentTime < n.endTime
                    );
                    const currentNodeOrder = currentNode?.order ?? "";

                    return (
                      <select
                        className="bg-white/10 text-white text-sm rounded-lg px-3 py-1.5 border border-white/20 focus:outline-none focus:border-blue-500 min-w-[150px]"
                        onChange={(e) => {
                          const node = nodes.find(n => n.order === parseInt(e.target.value));
                          if (node) {
                            handleJumpToTime(node.startTime);
                          }
                        }}
                        value={currentNodeOrder}
                      >
                        <option value="" disabled>Section</option>
                        {nodes.map((node) => (
                          <option key={node.order} value={node.order}>
                            {node.order}. {node.title}
                          </option>
                        ))}
                      </select>
                    );
                  })()}
                </div>

                {/* 中间留空 */}
                <div />

                {/* 右侧：退出按钮 */}
                <div className="flex items-center gap-3">
                  {isInConversation && (
                    <button
                      onClick={handleEndCall}
                      className="bg-red-500/80 hover:bg-red-500 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors text-sm"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08c-.18-.17-.29-.42-.29-.7 0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.11-.7-.28-.79-.74-1.69-1.36-2.67-1.85-.33-.16-.56-.5-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z" />
                      </svg>
                      退出通话
                    </button>
                  )}
                  <button
                    onClick={handleBackClick}
                    className="bg-white/10 hover:bg-white/20 text-white px-5 py-2.5 rounded-lg flex items-center gap-2 transition-colors font-medium"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    退出到主界面
                  </button>
                </div>
                </div>
              </div>
            </>
          ) : (
            /* 非全屏模式：原有布局 */
            <>
              {/* 视频区域 */}
              <div
                className="relative bg-black overflow-hidden flex-1"
              >
                <div className="relative w-full aspect-video">
                  <VideoPlayer
                    ref={videoPlayerRef}
                    videoUrl={video.videoUrl}
                    subtitles={subtitles}
                    nodes={nodes}
                    videoId={videoId}
                    isInConversation={isInConversation}
                    isFullscreen={isFullscreen}
                    showChatInFullscreen={showChatInFullscreen}
                    showSubtitles={showSubtitles}
                    isDrawingOpen={isDrawingOpen}
                    isMicActive={isMicActive}
                    isAISpeaking={isAISpeaking}
                    interventionConfig={interventionConfig}
                    isInPrecisionMode={voiceBackend === "doubao"}
                    onToggleConversation={toggleConversation}
                    onToggleChat={toggleChatInFullscreen}
                    onToggleDrawing={() => setIsDrawingOpen(!isDrawingOpen)}
                    onJoinMeeting={handleJoinMeetingClick}
                    onContextUpdate={handleContextUpdate}
                    onNodeComplete={handleNodeComplete}
                    onCheckpointIntervention={handleCheckpointIntervention}
                    onExitIntervention={handleExitInterventionAndPlay}
                    onPlayStateChange={setIsVideoPlaying}
                  />
                </div>
              </div>

              {/* 聊天面板 - 非全屏模式，加入对话后显示 */}
              {hasEverJoined && (
              <div className="w-[380px] shrink-0 h-[calc(100vw*9/16*0.65)] max-h-[500px] min-h-[400px]">
                <ChatPanel
                  videoContext={videoContext.context || `正在观看：${video.title}`}
                  currentSubtitle={videoContext.subtitle}
                  isActive={isInConversation}
                  videoId={videoId}
                  currentTime={videoContext.currentTime}
                  subtitles={subtitles}
                  studentId={studentId}
                  isFullscreen={isFullscreen}
                  autoStart={autoStartMic}
                  voiceMode={voiceMode}
                  voiceBackend={voiceBackend}
                  interventionConfig={interventionConfig}
                  isVideoPlaying={isVideoPlaying}
                  introQuestion={currentQuestion}
                  onLogMessage={logMessage}
                  onVoiceModeChange={setVoiceMode}
                  onVoiceBackendChange={setVoiceBackend}
                  onToggle={toggleConversation}
                  onClose={undefined}
                  onPauseVideo={handlePauseVideo}
                  onResumeVideo={handleResumeVideo}
                  onJumpToTime={handleJumpToTime}
                  onEndIntervention={handleEndIntervention}
                  onOpenDrawing={handleOpenDrawing}
                  onCloseDrawing={handleCloseDrawing}
                  onDrawShapes={handleDrawShapes}
                  onClearDrawing={handleClearDrawing}
                  onMicStatusChange={handleMicStatusChange}
                  onAISpeakingChange={handleAISpeakingChange}
                />
              </div>
              )}
            </>
          )}

          {/* 画板覆盖层 - 放在全屏容器内部以支持全屏模式 */}
          <DrawingOverlay
            ref={drawingCanvasRef}
            isOpen={isDrawingOpen}
            onClose={handleCloseDrawing}
          />
        </div>

        {/* Video Info */}
        <div className="mt-6 bg-white/5 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-white mb-2">{video.title}</h2>
          <p className="text-gray-400">{video.description}</p>

          {/* Tips */}
          <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
            <h3 className="text-blue-400 font-medium mb-2">使用提示</h3>
            <ul className="text-gray-300 text-sm space-y-1">
              <li>1. 点击右下角的「加入对话」按钮开始</li>
              <li>2. 开始说话时视频会自动暂停</li>
              <li>3. AI老师会用语音回答你的问题</li>
              <li>4. 说&quot;继续&quot;或&quot;明白了&quot;视频会继续播放</li>
            </ul>
          </div>
        </div>
      </main>

      {/* 游戏提示弹窗 */}
      {showGamePrompt && completedNode && completedNode.id && (
        <GamePrompt
          videoId={videoId}
          nodeId={completedNode.id}
          nodeTitle={completedNode.title}
          onDismiss={handleDismissGame}
          onContinue={handleGameContinue}
        />
      )}

      {/* 学习报告弹窗 */}
      {showLearningReport && (
        <LearningReportModal
          analysis={analysisData}
          videoTitle={video.title}
          open={showLearningReport}
          loading={!analysisData}
          onClose={handleReportClose}
        />
      )}

      {/* 紧急播放按钮 - 精准模式下显示在屏幕中央 */}
      {isFullscreen && voiceBackend === "doubao" && (
        <div className="fixed inset-0 flex items-center justify-center z-[99999] pointer-events-none">
          <button
            onClick={() => {
              const videoEl = document.querySelector('video');
              if (videoEl) {
                setIsCheckpointIntervening(false);
                setCurrentCheckpoint(null);
                setInterventionConfig(null);
                setVoiceBackend("doubao_realtime");
                videoEl.play();
              }
            }}
            className="pointer-events-auto bg-green-500 hover:bg-green-600 text-white text-2xl font-bold px-8 py-4 rounded-2xl shadow-2xl animate-pulse"
          >
            ▶ 点我继续播放
          </button>
        </div>
      )}

    </div>
  );
}
