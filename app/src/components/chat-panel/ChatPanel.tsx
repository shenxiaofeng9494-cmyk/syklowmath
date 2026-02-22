"use client";

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
  studentId?: string;  // V2 自适应：学生ID
  isFullscreen?: boolean;
  autoStart?: boolean;
  voiceMode?: VoiceMode;
  voiceBackend?: VoiceBackend;
  interventionConfig?: any;  // 新增：介入模式配置
  isVideoPlaying?: boolean;  // 视频播放状态（用于断连 realtime）
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
  onToggleFullscreen?: () => void;  // 全屏切换
}

export function ChatPanel({
  videoContext,
  currentSubtitle,
  isActive,
  videoId,
  currentTime,
  subtitles,
  studentId,  // V2 自适应：学生ID
  isFullscreen = false,
  autoStart = false,
  voiceMode = "realtime",
  voiceBackend = "doubao_realtime",
  interventionConfig,
  isVideoPlaying,
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
  onToggleFullscreen,
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
              : "bg-red-500/30 text-red-400 border border-red-500/50"
          }`}>
            {voiceBackend === "doubao_realtime" ? "实时模式" : "精准模式"}
          </span>
        </div>
        {/* 对话框始终显示，不提供关闭按钮 */}
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
          studentId={studentId}
          voiceBackend={voiceBackend}
          voiceMode={voiceMode}
          interventionConfig={interventionConfig}
          isVideoPlaying={isVideoPlaying}
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

      {/* 底部全屏按钮 */}
      {onToggleFullscreen && (
        <div className="px-4 py-3 shrink-0 border-t border-white/10">
          <button
            onClick={onToggleFullscreen}
            className="w-full flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white rounded-lg px-4 py-2.5 transition-colors"
            title={isFullscreen ? "退出全屏" : "进入全屏"}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {isFullscreen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
              )}
            </svg>
            <span className="text-sm">{isFullscreen ? "退出全屏" : "全屏模式"}</span>
          </button>
        </div>
      )}
    </div>
  );
}
