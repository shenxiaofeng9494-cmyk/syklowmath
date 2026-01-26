"use client";

import { useRef, useState, useEffect, useCallback, forwardRef, useImperativeHandle } from "react";
import { Button } from "@/components/ui/button";
import { SubtitleCue, getCurrentSubtitle, getSubtitleContext } from "@/data/videos";

interface VideoNode {
  order: number;
  title: string;
  startTime: number;
  endTime: number;
}

interface VideoPlayerProps {
  videoUrl: string;
  subtitles: SubtitleCue[];
  nodes?: VideoNode[];
  isInConversation: boolean;
  isFullscreen?: boolean;
  showChatInFullscreen?: boolean;
  showSubtitles?: boolean;
  isMicActive?: boolean;
  isAISpeaking?: boolean;
  hideControls?: boolean;
  onToggleConversation: () => void;
  onToggleFullscreen?: () => void;
  onToggleChat?: () => void;
  onJoinMeeting?: () => void;  // 点击 Join Meeting 按钮
  onContextUpdate?: (context: { currentTime: number; subtitle: string; context: string }) => void;
  onJumpToNode?: (node: VideoNode) => void;
  onNodeComplete?: (node: VideoNode) => void;
}

export interface VideoPlayerHandle {
  play: () => void;
  pause: () => void;
  seekTo: (time: number) => void;
}

export const VideoPlayer = forwardRef<VideoPlayerHandle, VideoPlayerProps>(
  function VideoPlayer({
    videoUrl,
    subtitles,
    nodes = [],
    isInConversation,
    isFullscreen = false,
    showChatInFullscreen = false,
    showSubtitles = true,
    isMicActive = false,
    isAISpeaking = false,
    hideControls = false,
    onToggleConversation,
    onToggleFullscreen,
    onToggleChat,
    onJoinMeeting,
    onContextUpdate,
    onJumpToNode,
    onNodeComplete
  }, ref) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [currentSubtitle, setCurrentSubtitle] = useState("");
    const [hoveredNode, setHoveredNode] = useState<VideoNode | null>(null);
    const [lastCompletedNodeId, setLastCompletedNodeId] = useState<number | null>(null);

    // 暴露控制方法给父组件
    useImperativeHandle(ref, () => ({
      play: () => {
        if (videoRef.current) {
          videoRef.current.play();
        }
      },
      pause: () => {
        if (videoRef.current) {
          videoRef.current.pause();
        }
      },
      seekTo: (time: number) => {
        if (videoRef.current) {
          videoRef.current.currentTime = time;
        }
      },
    }));

    // 更新当前字幕
    useEffect(() => {
      const subtitle = getCurrentSubtitle(subtitles, currentTime);
      setCurrentSubtitle(subtitle);

      // 如果在对话中，更新上下文
      if (isInConversation && onContextUpdate) {
        const context = getSubtitleContext(subtitles, currentTime);
        onContextUpdate({
          currentTime,
          subtitle,
          context,
        });
      }
    }, [currentTime, subtitles, isInConversation, onContextUpdate]);

    // 检测节点播放完成
    useEffect(() => {
      if (!onNodeComplete || nodes.length === 0 || !isPlaying) return;

      // 找到当前正在播放的节点
      const currentNode = nodes.find(
        node => currentTime >= node.startTime && currentTime <= node.endTime
      );

      if (!currentNode) return;

      // 检测是否刚刚完成（当前时间接近节点结束时间）
      const isNearEnd = currentNode.endTime - currentTime < 1;
      const isNewCompletion = lastCompletedNodeId !== currentNode.order;

      if (isNearEnd && isNewCompletion) {
        setLastCompletedNodeId(currentNode.order);
        onNodeComplete(currentNode);
      }
    }, [currentTime, nodes, isPlaying, onNodeComplete, lastCompletedNodeId]);

    // 播放/暂停
    const togglePlay = useCallback(() => {
      if (videoRef.current) {
        if (isPlaying) {
          videoRef.current.pause();
        } else {
          videoRef.current.play();
        }
      }
    }, [isPlaying]);

    // 时间更新
    const handleTimeUpdate = () => {
      if (videoRef.current) {
        setCurrentTime(videoRef.current.currentTime);
      }
    };

    // 视频加载完成
    const handleLoadedMetadata = () => {
      if (videoRef.current) {
        setDuration(videoRef.current.duration);
      }
    };

    // 进度条点击
    const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
      if (videoRef.current && duration > 0) {
        const rect = e.currentTarget.getBoundingClientRect();
        const pos = (e.clientX - rect.left) / rect.width;
        videoRef.current.currentTime = pos * duration;
      }
    };

    // 节点点击
    const handleNodeClick = (node: VideoNode, e: React.MouseEvent) => {
      e.stopPropagation();
      if (videoRef.current) {
        videoRef.current.currentTime = node.startTime;
        videoRef.current.play();
      }
      onJumpToNode?.(node);
    };

    // 格式化时间
    const formatTime = (seconds: number) => {
      const mins = Math.floor(seconds / 60);
      const secs = Math.floor(seconds % 60);
      return `${mins}:${secs.toString().padStart(2, "0")}`;
    };

    return (
      <div className={`relative bg-black ${isFullscreen ? "w-full h-full" : "rounded-lg overflow-hidden"}`}>
        {/* 视频元素 */}
        <video
          ref={videoRef}
          src={videoUrl}
          className={`${isFullscreen ? "w-full h-full object-contain" : "w-full aspect-video"}`}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onClick={togglePlay}
          playsInline
        />

        {/* 字幕显示 */}
        {showSubtitles && currentSubtitle && (
          <div className="absolute bottom-20 left-0 right-0 text-center px-4">
            <span className="bg-black/70 text-white px-4 py-2 rounded-lg text-lg">
              {currentSubtitle}
            </span>
          </div>
        )}

        {/* 音频波形指示器 - 全屏模式下 AI 说话时显示 */}
        {isFullscreen && isInConversation && (
          <div className="absolute top-4 right-4 flex items-end gap-1 h-6">
            {[0, 1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className={`w-1 bg-blue-400 rounded-full transition-all duration-150 ${
                  isAISpeaking
                    ? "animate-pulse"
                    : "h-1"
                }`}
                style={{
                  height: isAISpeaking ? `${12 + Math.sin(i * 1.5) * 8}px` : "4px",
                  animationDelay: `${i * 100}ms`,
                }}
              />
            ))}
          </div>
        )}

        {/* 控制栏 - 全屏模式下隐藏（使用统一控制栏） */}
        {!hideControls && (
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
          {/* 进度条 - 游戏化样式 */}
          <div
            className="relative h-2 bg-white/20 rounded-full mb-3 cursor-pointer group"
            onClick={handleProgressClick}
          >
            {/* 播放进度 - 青色条纹动画 */}
            <div
              className="h-full bg-[#4ECDC4] rounded-full transition-all progress-striped"
              style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
            />

            {/* 节点分隔标记 */}
            {duration > 0 && nodes.map((node) => {
              const position = (node.startTime / duration) * 100;
              const isFirstNode = node.startTime <= 0;
              return (
                <div
                  key={node.order}
                  className="absolute top-1/2 -translate-y-1/2 cursor-pointer z-10"
                  style={{ left: `${position}%` }}
                  onClick={(e) => handleNodeClick(node, e)}
                  onMouseEnter={() => setHoveredNode(node)}
                  onMouseLeave={() => setHoveredNode(null)}
                >
                  {/* 分隔线或起始标记 */}
                  {isFirstNode ? (
                    <div className="w-2 h-2 bg-blue-400 hover:bg-blue-300 rounded-full transition-colors -translate-x-1/2" />
                  ) : (
                    <div className="w-0.5 h-3 bg-white/70 hover:bg-white transition-colors -translate-x-1/2" />
                  )}

                  {/* 节点序号 */}
                  <div className="absolute -top-5 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-[10px] text-white/80 whitespace-nowrap">{node.order}</span>
                  </div>
                </div>
              );
            })}

            {/* 悬浮提示 */}
            {hoveredNode && duration > 0 && (
              <div
                className="absolute -top-10 transform -translate-x-1/2 z-20 pointer-events-none"
                style={{ left: `${(hoveredNode.startTime / duration) * 100}%` }}
              >
                <div className="bg-gray-900/95 text-white text-xs px-2 py-1 rounded shadow-lg whitespace-nowrap">
                  <span className="font-medium">节点 {hoveredNode.order}:</span> {hoveredNode.title}
                </div>
              </div>
            )}
          </div>

          {/* 控制按钮 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {/* 播放/暂停按钮 - 游戏化样式 */}
              <button
                onClick={togglePlay}
                className="bg-white/10 hover:bg-white/20 text-white rounded-full p-2 transition-all btn-3d"
              >
                {isPlaying ? (
                  <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                  </svg>
                ) : (
                  <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                )}
              </button>

              {/* 时间显示 - 游戏化样式 */}
              <span className="text-white text-sm bg-gray-800/80 backdrop-blur rounded-xl px-4 py-2">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {/* 聊天切换按钮（全屏模式下且已加入对话时显示） */}
              {isFullscreen && isInConversation && (
                <button
                  onClick={onToggleChat}
                  className={`p-2 rounded transition-colors ${
                    showChatInFullscreen
                      ? "bg-blue-500 text-white"
                      : "text-white hover:bg-white/20"
                  }`}
                  title={showChatInFullscreen ? "隐藏聊天" : "显示聊天"}
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z" />
                  </svg>
                </button>
              )}

              {/* 加入对话按钮 - 游戏化样式 */}
              <Button
                onClick={onToggleConversation}
                className={`rounded-full px-6 transition-all btn-3d ${
                  isInConversation
                    ? "bg-[#4ECDC4] hover:bg-[#3dbdb5] text-white border-b-4 border-[#3a9e98]"
                    : "bg-[#FF6B6B] hover:bg-[#ff5252] text-white border-b-4 border-[#cc5555]"
                }`}
              >
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z" />
                </svg>
                {isInConversation ? "对话中" : "加入对话"}
              </Button>

              {/* 全屏按钮 */}
              {onToggleFullscreen && (
                <button
                  onClick={onToggleFullscreen}
                  className="text-white hover:text-blue-400 transition-colors p-2"
                  title={isFullscreen ? "退出全屏" : "全屏"}
                >
                  {isFullscreen ? (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />
                    </svg>
                  ) : (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
                    </svg>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
        )}

        {/* Join Meeting 按钮 - 游戏化样式 */}
        {!isInConversation && !isPlaying && onJoinMeeting && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <button
              onClick={onJoinMeeting}
              className="bg-[#FF6B6B] hover:bg-[#ff5252] text-white px-10 py-4 rounded-full text-lg font-medium transition-all transform hover:scale-105 shadow-lg flex items-center gap-3 btn-3d border-b-4 border-[#cc5555]"
            >
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z" />
              </svg>
              Join Meeting
            </button>
          </div>
        )}

        {/* 播放/暂停指示器 - 仅在已加入对话后暂停时显示 */}
        {isInConversation && !isPlaying && currentTime > 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="bg-black/50 rounded-full p-4">
              <svg className="w-12 h-12 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          </div>
        )}

      </div>
    );
  }
);
