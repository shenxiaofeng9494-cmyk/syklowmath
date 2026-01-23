"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { VideoPlayer, VideoPlayerHandle } from "@/components/video-player/VideoPlayer";
import { VoiceInteraction } from "@/components/voice-interaction/VoiceInteraction";
import { GamePrompt } from "@/components/game-player/GamePrompt";
import { getVideoById, SubtitleCue } from "@/data/videos";

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
    console.log("Resuming video");
    setActiveView("video"); // 切换回视频视图
    videoPlayerRef.current?.play();
  }, []);

  // 跳转到指定时间（AI 调用 jump_to_video_node 时）
  const handleJumpToTime = useCallback((time: number) => {
    console.log("Jumping to time:", time);
    setActiveView("video"); // 切换回视频视图
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

  // 视频加载中
  if (videoLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <svg className="animate-spin w-12 h-12 text-blue-500 mx-auto mb-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <p className="text-gray-600">加载视频中...</p>
        </div>
      </div>
    );
  }

  // 视频不存在或加载失败
  if (!video || videoError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-4">{videoError || "视频不存在"}</h1>
          <p className="text-gray-600 mb-6">请确认视频 ID 是否正确</p>
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
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-4">
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

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 py-6">
        {/* 字幕加载状态 */}
        {subtitleStatus === "loading" && (
          <div className="mb-4 p-4 bg-blue-500/20 border border-blue-500/40 rounded-lg flex items-center gap-3">
            <svg className="animate-spin w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span className="text-blue-300">正在识别视频字幕，首次加载可能需要30秒左右...</span>
          </div>
        )}

        {subtitleStatus === "error" && (
          <div className="mb-4 p-4 bg-red-500/20 border border-red-500/40 rounded-lg">
            <p className="text-red-300">字幕加载失败: {subtitleError}</p>
            <p className="text-red-400 text-sm mt-1">你仍然可以观看视频和提问，但AI可能无法知道当前视频内容</p>
          </div>
        )}

        {subtitleStatus === "ready" && !isInConversation && (
          <div className="mb-4 p-3 bg-green-500/20 border border-green-500/40 rounded-lg flex items-center gap-2">
            <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-green-300">字幕已就绪 - 点击右下角「加入对话」随时向AI老师提问</span>
          </div>
        )}

        {/* 视频区域 */}
        <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
          <VideoPlayer
            ref={videoPlayerRef}
            videoUrl={video.videoUrl}
            subtitles={subtitles}
            nodes={nodes}
            isInConversation={isInConversation}
            onToggleConversation={toggleConversation}
            onContextUpdate={handleContextUpdate}
            onNodeComplete={handleNodeComplete}
          />
        </div>

        {/* Voice Interaction Panel */}
        {isInConversation && (
          <div className="mt-4">
            <VoiceInteraction
              videoContext={videoContext.context || `正在观看：${video.title}`}
              currentSubtitle={videoContext.subtitle}
              isActive={isInConversation}
              videoId={videoId}
              currentTime={videoContext.currentTime}
              subtitles={subtitles}
              onToggle={toggleConversation}
              onPauseVideo={handlePauseVideo}
              onResumeVideo={handleResumeVideo}
              onJumpToTime={handleJumpToTime}
            />
          </div>
        )}

        {/* Video Info */}
        <div className="mt-6 bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-white mb-2">{video.title}</h2>
          <p className="text-gray-400">{video.description}</p>

          {/* Tips */}
          <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
            <h3 className="text-blue-400 font-medium mb-2">使用提示</h3>
            <ul className="text-gray-300 text-sm space-y-1">
              <li>1. 点击右下角的「加入对话」按钮开始</li>
              <li>2. 开始说话时视频会自动暂停</li>
              <li>3. AI老师会用语音回答你的问题</li>
              <li>4. 说"继续"或"明白了"视频会继续播放</li>
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
    </div>
  );
}
