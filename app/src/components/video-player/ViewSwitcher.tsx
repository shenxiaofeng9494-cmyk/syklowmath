"use client";

import { motion } from "framer-motion";
import type { ViewType } from "@/types/excalidraw";

interface ViewSwitcherProps {
  activeView: ViewType;
  onSwitch: (view: ViewType) => void;
  hasDrawing: boolean;
}

export function ViewSwitcher({ activeView, onSwitch, hasDrawing }: ViewSwitcherProps) {
  return (
    <div className="flex items-center gap-1 bg-black/70 backdrop-blur-sm rounded-full p-1">
      {/* Video button */}
      <button
        onClick={() => onSwitch("video")}
        className={`relative px-4 py-2 rounded-full text-sm font-medium transition-all ${
          activeView === "video"
            ? "text-white"
            : "text-gray-300 hover:text-white"
        }`}
      >
        {activeView === "video" && (
          <motion.div
            layoutId="viewSwitcherBg"
            className="absolute inset-0 bg-blue-500 rounded-full"
            initial={false}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
          />
        )}
        <span className="relative flex items-center gap-2">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
          视频
        </span>
      </button>

      {/* Drawing button */}
      <button
        onClick={() => hasDrawing && onSwitch("drawing")}
        disabled={!hasDrawing}
        className={`relative px-4 py-2 rounded-full text-sm font-medium transition-all ${
          activeView === "drawing"
            ? "text-white"
            : hasDrawing
            ? "text-gray-300 hover:text-white"
            : "text-gray-600 cursor-not-allowed"
        }`}
      >
        {activeView === "drawing" && (
          <motion.div
            layoutId="viewSwitcherBg"
            className="absolute inset-0 bg-green-500 rounded-full"
            initial={false}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
          />
        )}
        <span className="relative flex items-center gap-2">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
          </svg>
          画板
          {/* New indicator when drawing is available but not viewing */}
          {hasDrawing && activeView !== "drawing" && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-black/70"
            />
          )}
        </span>
      </button>
    </div>
  );
}
