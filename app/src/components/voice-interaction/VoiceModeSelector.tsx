"use client";

import { VoiceMode } from "@/types/drawing-script";

interface VoiceModeSelectorProps {
  mode: VoiceMode;
  onChange: (mode: VoiceMode) => void;
  disabled?: boolean;
}

export function VoiceModeSelector({
  mode,
  onChange,
  disabled = false,
}: VoiceModeSelectorProps) {
  return (
    <div className="flex items-center gap-2 p-1 bg-gray-800/50 rounded-lg">
      <button
        onClick={() => onChange("realtime")}
        disabled={disabled}
        className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
          mode === "realtime"
            ? "bg-[#4ECDC4] text-white"
            : "text-gray-400 hover:text-white hover:bg-gray-700/50"
        } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
      >
        <span className="flex items-center gap-1.5">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
            />
          </svg>
          豆包实时
        </span>
      </button>
      <button
        onClick={() => onChange("volcengine_rtc")}
        disabled={disabled}
        className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
          mode === "volcengine_rtc"
            ? "bg-[#FF9500] text-white"
            : "text-gray-400 hover:text-white hover:bg-gray-700/50"
        } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
      >
        <span className="flex items-center gap-1.5">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
            />
          </svg>
          RTC音视频
        </span>
      </button>
      <button
        onClick={() => onChange("draw_explain")}
        disabled={disabled}
        className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
          mode === "draw_explain"
            ? "bg-[#FF6B6B] text-white"
            : "text-gray-400 hover:text-white hover:bg-gray-700/50"
        } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
      >
        <span className="flex items-center gap-1.5">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
            />
          </svg>
          边画边讲
        </span>
      </button>
    </div>
  );
}
