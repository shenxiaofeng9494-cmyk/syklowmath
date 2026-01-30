"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { VideoPlayer, VideoPlayerHandle } from "@/components/video-player/VideoPlayer";
import { ChatPanel } from "@/components/chat-panel/ChatPanel";
import { GamePrompt } from "@/components/game-player/GamePrompt";
import { DrawingOverlay, TldrawCanvasHandle, DrawingShape } from "@/components/drawing-canvas";
import { getVideoById, SubtitleCue } from "@/data/videos";
import { VoiceMode, VoiceBackend } from "@/types/drawing-script";

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
  const videoId = params.id as string;

  // 视频数据状态
  const [video, setVideo] = useState<ClientVideo | null>(null);
  const [videoLoading, setVideoLoading] = useState(true);
  const [videoError, setVideoError] = useState<string>("");

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
  const [showChatInFullscreen, setShowChatInFullscreen] = useState(false);
  const fullscreenContainerRef = useRef<HTMLDivElement>(null);

  // 语音状态（用于控制栏显示）
  const [isMicActive, setIsMicActive] = useState(false);
  const [isAISpeaking, setIsAISpeaking] = useState(false);

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
  const [showBackendSelector, setShowBackendSelector] = useState(false);

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

    // 设置介入配置
    setInterventionConfig({
      checkpoint: checkpoint,
      isIntervention: true
    });

    // 切换到精准模式
    console.log('[WatchPage] 介入模式：切换到精准模式（doubao backend）');
    setVoiceBackend("doubao");

    // 设置自动启动麦克风
    setAutoStartMic(true);

    // 延迟开启对话，确保所有状态都已更新
    setTimeout(() => {
      console.log('[WatchPage] 开启介入对话');
      setIsInConversation(true);
    }, 100);
  }, [isInConversation]);

  // 结束必停点介入（不切换模式，等学生点继续）
  const handleEndIntervention = useCallback(() => {
    console.log('[WatchPage] 结束必停点介入（保持精准模式，等学生点继续）');
    // 只清理介入状态标记，不清除 interventionConfig，不切换 voiceBackend
    // 等学生点击"继续"时再切换
    setIsCheckpointIntervening(false);
    setCurrentCheckpoint(null);
    // 注意：不清除 interventionConfig，不切换 voiceBackend
  }, []);

  // 处理用户手动播放时退出介入模式
  const handleExitInterventionAndPlay = useCallback(() => {
    console.log('[WatchPage] 用户手动播放，退出介入模式');

    // 清除介入状态
    setIsCheckpointIntervening(false);
    setCurrentCheckpoint(null);
    setInterventionConfig(null);

    // 切换回实时模式
    setVoiceBackend("doubao_realtime");

    console.log('[WatchPage] ✅ 已切换回实时模式');
  }, []);

  // 全屏切换
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      fullscreenContainerRef.current?.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  }, []);

  // 监听全屏变化
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
      // 退出全屏时隐藏聊天框并结束对话
      if (!document.fullscreenElement) {
        setShowChatInFullscreen(false);
        setIsInConversation(false);
      }
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  // 全屏模式下切换聊天框
  const toggleChatInFullscreen = useCallback(() => {
    setShowChatInFullscreen((prev) => !prev);
  }, []);

  // 点击 Join Meeting 按钮时显示选择弹窗
  const handleJoinMeetingClick = useCallback(() => {
    setShowBackendSelector(true);
  }, []);

  // 选择语音后端后真正加入对话
  const handleSelectBackendAndJoin = useCallback(async (backend: VoiceBackend) => {
    setVoiceBackend(backend);
    setShowBackendSelector(false);

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
      // 5. 开始播放视频
      videoPlayerRef.current?.play();
    }, 100);
  }, []);

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

  // 退出通话 - 只结束对话，不退出全屏
  const handleEndCall = useCallback(() => {
    setIsInConversation(false);
    setShowChatInFullscreen(false);
    setIsMicActive(false);
    setAutoStartMic(false);
  }, []);


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
            <Link
              href="/"
              className="text-gray-400 hover:text-white transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
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

        {subtitleStatus === "error" && (
          <div className="mb-4 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
            <p className="text-red-300">字幕加载失败: {subtitleError}</p>
            <p className="text-red-400 text-sm mt-1">你仍然可以观看视频和提问，但AI可能无法知道当前视频内容</p>
          </div>
        )}

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
                    showChatInFullscreen && isInConversation ? "flex-1" : "w-full"
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
                    onToggleConversation={toggleConversation}
                    onToggleFullscreen={toggleFullscreen}
                    onToggleChat={toggleChatInFullscreen}
                    onJoinMeeting={handleJoinMeetingClick}
                    onContextUpdate={handleContextUpdate}
                    onNodeComplete={handleNodeComplete}
                    onCheckpointIntervention={handleCheckpointIntervention}
                    onExitIntervention={handleExitInterventionAndPlay}
                    hideControls={true}
                  />
                </div>

                {/* 聊天面板 - 全屏模式右侧，使用 CSS 控制显示/隐藏以保持对话状态 */}
                {isInConversation && (
                  <div className={`w-[350px] shrink-0 h-full border-l border-white/10 bg-black/90 ${
                    showChatInFullscreen ? "" : "hidden"
                  }`}>
                    <ChatPanel
                      videoContext={videoContext.context || `正在观看：${video.title}`}
                      currentSubtitle={videoContext.subtitle}
                      isActive={isInConversation}
                      videoId={videoId}
                      currentTime={videoContext.currentTime}
                      subtitles={subtitles}
                      isFullscreen={isFullscreen}
                      autoStart={autoStartMic}
                      voiceMode={voiceMode}
                      voiceBackend={voiceBackend}
                      interventionConfig={interventionConfig}
                      onVoiceModeChange={setVoiceMode}
                      onVoiceBackendChange={setVoiceBackend}
                      onToggle={toggleConversation}
                      onClose={toggleChatInFullscreen}
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
              <div className="bg-black/90 border-t border-white/10 px-4 py-3 shrink-0">
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
                {/* 左侧：时间显示 */}
                <div className="flex items-center gap-4">
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

                {/* 中间：功能按钮 */}
                <div className="flex items-center gap-2">
                  {/* 字幕按钮 */}
                  <button
                    onClick={toggleSubtitles}
                    className={`p-2.5 rounded-lg transition-colors ${
                      showSubtitles ? "bg-blue-500 text-white" : "bg-white/10 text-gray-400 hover:text-white"
                    }`}
                    title={showSubtitles ? "隐藏字幕" : "显示字幕"}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                    </svg>
                  </button>

                  {/* 画板按钮 */}
                  <button
                    onClick={() => setIsDrawingOpen(!isDrawingOpen)}
                    className={`p-2.5 rounded-lg transition-colors ${
                      isDrawingOpen ? "bg-blue-500 text-white" : "bg-white/10 text-gray-400 hover:text-white"
                    }`}
                    title={isDrawingOpen ? "关闭画板" : "打开画板"}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>

                  {/* 全屏切换按钮 */}
                  <button
                    onClick={toggleFullscreen}
                    className="p-2.5 rounded-lg bg-white/10 text-gray-400 hover:text-white transition-colors"
                    title="退出全屏"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />
                    </svg>
                  </button>

                  {/* 聊天面板切换按钮 */}
                  {isInConversation && (
                    <button
                      onClick={toggleChatInFullscreen}
                      className={`p-2.5 rounded-lg transition-colors ${
                        showChatInFullscreen ? "bg-blue-500 text-white" : "bg-gray-800 text-gray-400 hover:text-white"
                      }`}
                      title={showChatInFullscreen ? "隐藏聊天" : "显示聊天"}
                    >
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z" />
                      </svg>
                    </button>
                  )}
                </div>

                {/* 右侧：退出通话按钮 */}
                <div className="flex items-center gap-3">
                  {isInConversation && (
                    <button
                      onClick={handleEndCall}
                      className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
                    >
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08c-.18-.17-.29-.42-.29-.7 0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.11-.7-.28-.79-.74-1.69-1.36-2.67-1.85-.33-.16-.56-.5-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z" />
                      </svg>
                      退出通话
                    </button>
                  )}
                </div>
                </div>
              </div>
            </>
          ) : (
            /* 非全屏模式：原有布局 */
            <>
              {/* 视频区域 */}
              <div
                className={`relative bg-black overflow-hidden ${
                  isInConversation ? "flex-1" : "w-full"
                }`}
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
                    onToggleConversation={toggleConversation}
                    onToggleFullscreen={toggleFullscreen}
                    onToggleChat={toggleChatInFullscreen}
                    onToggleDrawing={() => setIsDrawingOpen(!isDrawingOpen)}
                    onJoinMeeting={handleJoinMeetingClick}
                    onContextUpdate={handleContextUpdate}
                    onNodeComplete={handleNodeComplete}
                    onCheckpointIntervention={handleCheckpointIntervention}
                    onExitIntervention={handleExitInterventionAndPlay}
                  />
                </div>
              </div>

              {/* 聊天面板 - 非全屏模式 */}
              {isInConversation && (
                <div className="w-[380px] shrink-0 h-[calc(100vw*9/16*0.65)] max-h-[500px] min-h-[400px]">
                  <ChatPanel
                    videoContext={videoContext.context || `正在观看：${video.title}`}
                    currentSubtitle={videoContext.subtitle}
                    isActive={isInConversation}
                    videoId={videoId}
                    currentTime={videoContext.currentTime}
                    subtitles={subtitles}
                    isFullscreen={isFullscreen}
                    autoStart={autoStartMic}
                    voiceMode={voiceMode}
                    voiceBackend={voiceBackend}
                    interventionConfig={interventionConfig}
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

      {/* 语音后端选择弹窗 */}
      {showBackendSelector && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-[#1a1a1a] rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl">
            <h2 className="text-white text-xl font-semibold mb-2 text-center">选择对话模式</h2>
            <p className="text-gray-400 text-sm mb-6 text-center">请选择 AI 老师的响应方式</p>

            <div className="space-y-3">
              {/* 实时模式 */}
              <button
                onClick={() => handleSelectBackendAndJoin("doubao_realtime")}
                className="w-full p-4 rounded-xl bg-[#2a2a2a] hover:bg-[#333] border-2 border-transparent hover:border-[#4ECDC4] transition-all text-left group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-[#4ECDC4]/20 flex items-center justify-center">
                    <svg className="w-6 h-6 text-[#4ECDC4]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <div className="text-white font-medium">实时模式</div>
                    <div className="text-gray-400 text-sm">响应快速，适合日常对话</div>
                  </div>
                  <div className="text-[#4ECDC4] text-xs px-2 py-1 bg-[#4ECDC4]/10 rounded">推荐</div>
                </div>
              </button>

              {/* 精准模式 */}
              <button
                onClick={() => handleSelectBackendAndJoin("doubao")}
                className="w-full p-4 rounded-xl bg-[#2a2a2a] hover:bg-[#333] border-2 border-transparent hover:border-[#FF6B6B] transition-all text-left group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-[#FF6B6B]/20 flex items-center justify-center">
                    <svg className="w-6 h-6 text-[#FF6B6B]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <div className="text-white font-medium">精准模式</div>
                    <div className="text-gray-400 text-sm">画图更准确，延迟稍高</div>
                  </div>
                </div>
              </button>
            </div>

            <button
              onClick={() => setShowBackendSelector(false)}
              className="w-full mt-4 py-2 text-gray-400 hover:text-white text-sm transition-colors"
            >
              取消
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
