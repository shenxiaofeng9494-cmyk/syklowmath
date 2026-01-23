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
  onToggleConversation: () => void;
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
    onToggleConversation,
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
      <div className="relative bg-black rounded-lg overflow-hidden">
        {/* 视频元素 */}
        <video
          ref={videoRef}
          src={videoUrl}
          className="w-full aspect-video"
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onClick={togglePlay}
          playsInline
        />

        {/* 字幕显示 */}
        {currentSubtitle && (
          <div className="absolute bottom-20 left-0 right-0 text-center px-4">
            <span className="bg-black/70 text-white px-4 py-2 rounded-lg text-lg">
              {currentSubtitle}
            </span>
          </div>
        )}

        {/* 控制栏 */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
          {/* 进度条 */}
          <div
            className="relative h-1 bg-white/30 rounded-full mb-3 cursor-pointer group"
            onClick={handleProgressClick}
          >
            {/* 播放进度 */}
            <div
              className="h-full bg-blue-500 rounded-full transition-all"
              style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
            />

            {/* 节点分隔标记 */}
            {duration > 0 && nodes.map((node, index) => {
              // 只显示节点开始位置的分隔线（跳过第一个节点，它从0开始）
              if (node.startTime <= 0) return null;
              const position = (node.startTime / duration) * 100;
              return (
                <div
                  key={node.order}
                  className="absolute top-1/2 -translate-y-1/2 cursor-pointer z-10"
                  style={{ left: `${position}%` }}
                  onClick={(e) => handleNodeClick(node, e)}
                  onMouseEnter={() => setHoveredNode(node)}
                  onMouseLeave={() => setHoveredNode(null)}
                >
                  {/* 分隔线 */}
                  <div className="w-0.5 h-3 bg-white/70 hover:bg-white transition-colors -translate-x-1/2" />

                  {/* 节点序号 */}
                  <div className="absolute -top-5 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-[10px] text-white/80 whitespace-nowrap">{index + 1}</span>
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
              {/* 播放/暂停按钮 */}
              <button
                onClick={togglePlay}
                className="text-white hover:text-blue-400 transition-colors"
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

              {/* 时间显示 */}
              <span className="text-white text-sm">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>

            {/* 加入对话按钮 */}
            <Button
              onClick={onToggleConversation}
              className={`rounded-full px-6 transition-all ${
                isInConversation
                  ? "bg-green-500 hover:bg-green-600 text-white"
                  : "bg-blue-500 hover:bg-blue-600 text-white"
              }`}
            >
              <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z" />
              </svg>
              {isInConversation ? "对话中" : "加入对话"}
            </Button>
          </div>
        </div>

        {/* 播放/暂停指示器 */}
        {!isPlaying && currentTime > 0 && (
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
