"use client";

import { X, MessageSquare } from "lucide-react";
import { VoiceInteraction } from "@/components/voice-interaction/VoiceInteraction";
import { DrawingShape } from "@/components/drawing-canvas";

interface SubtitleCue {
  start: number;
  end: number;
  text: string;
}

interface ChatPanelProps {
  videoContext: string;
  currentSubtitle: string;
  isActive: boolean;
  videoId?: string;
  currentTime?: number;
  subtitles?: SubtitleCue[];
  isFullscreen?: boolean;
  autoStart?: boolean;  // 是否自动开启麦克风
  onToggle: () => void;
  onClose?: () => void;
  onPauseVideo: () => void;
  onResumeVideo: () => void;
  onJumpToTime?: (time: number) => void;
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

export function ChatPanel({
  videoContext,
  currentSubtitle,
  isActive,
  videoId,
  currentTime,
  subtitles,
  isFullscreen = false,
  autoStart = false,
  onToggle,
  onClose,
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
}: ChatPanelProps) {
  return (
    <div className="h-full flex flex-col bg-gray-800 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-blue-400" />
          <span className="text-white font-medium">Chat Transcript</span>
        </div>
        {isFullscreen && onClose && (
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors p-1 rounded hover:bg-gray-700"
            title="关闭聊天"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Voice Interaction Content */}
      <div className="flex-1 overflow-hidden">
        <VoiceInteraction
          videoContext={videoContext}
          currentSubtitle={currentSubtitle}
          isActive={isActive}
          videoId={videoId}
          currentTime={currentTime}
          subtitles={subtitles}
          onToggle={onToggle}
          onPauseVideo={onPauseVideo}
          onResumeVideo={onResumeVideo}
          onJumpToTime={onJumpToTime}
          onOpenDrawing={onOpenDrawing}
          onCloseDrawing={onCloseDrawing}
          onDrawShapes={onDrawShapes}
          onClearDrawing={onClearDrawing}
          onMicStatusChange={onMicStatusChange}
          onAISpeakingChange={onAISpeakingChange}
          onRegisterToggleMic={onRegisterToggleMic}
          embedded={true}
          autoStart={autoStart}
        />
      </div>
    </div>
  );
}
