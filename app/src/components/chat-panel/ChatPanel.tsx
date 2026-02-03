"use client";

import { X } from "lucide-react";
import { VoiceInteraction } from "@/components/voice-interaction/VoiceInteraction";
import { DrawingShape } from "@/components/drawing-canvas";
import { VoiceMode, VoiceBackend } from "@/types/drawing-script";

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

interface ChatPanelProps {
  videoContext: string;
  currentSubtitle: string;
  isActive: boolean;
  videoId?: string;
  currentTime?: number;
  subtitles?: SubtitleCue[];
  isFullscreen?: boolean;
  autoStart?: boolean;
  voiceMode?: VoiceMode;
  voiceBackend?: VoiceBackend;
  interventionConfig?: any;  // 新增：介入模式配置
  // V2 自适应提问系统
  introQuestion?: AdaptiveQuestion | null;
  onLogMessage?: (role: 'user' | 'assistant', content: string) => void;
  onVoiceModeChange?: (mode: VoiceMode) => void;
  onVoiceBackendChange?: (backend: VoiceBackend) => void;
  onToggle: () => void;
  onClose?: () => void;
  onPauseVideo: () => void;
  onResumeVideo: () => void;
  onJumpToTime?: (time: number) => void;
  onOpenDrawing?: () => void;
  onCloseDrawing?: () => void;
  onDrawShapes?: (shapes: DrawingShape[]) => void;
  onClearDrawing?: () => void;
  onMicStatusChange?: (active: boolean) => void;
  onAISpeakingChange?: (speaking: boolean) => void;
  onEndIntervention?: () => void;  // 新增：结束介入回调
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
  voiceMode = "realtime",
  voiceBackend = "doubao_realtime",
  interventionConfig,
  // V2 自适应提问系统
  introQuestion,
  onLogMessage,
  onVoiceModeChange,
  onVoiceBackendChange,
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
  onEndIntervention,
}: ChatPanelProps) {
  return (
    <div className="h-full flex flex-col bg-[#1a1a1a] rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-white font-semibold text-lg tracking-tight">Chat</span>
          {/* Voice Backend Indicator */}
          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
            voiceBackend === "doubao_realtime"
              ? "bg-[#4ECDC4]/20 text-[#4ECDC4]"
              : "bg-[#FF6B6B]/20 text-[#FF6B6B]"
          }`}>
            {voiceBackend === "doubao_realtime" ? "实时模式" : "精准模式"}
          </span>
        </div>
        {isFullscreen && onClose && (
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors p-1"
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
          voiceBackend={voiceBackend}
          voiceMode={voiceMode}
          interventionConfig={interventionConfig}
          introQuestion={introQuestion}
          onLogMessage={onLogMessage}
          onVoiceModeChange={onVoiceModeChange}
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
          onEndIntervention={onEndIntervention}
          embedded={true}
          autoStart={autoStart}
        />
      </div>
    </div>
  );
}
