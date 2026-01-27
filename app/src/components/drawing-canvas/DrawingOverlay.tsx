"use client";

import { forwardRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { TldrawCanvas, TldrawCanvasHandle } from "./TldrawCanvas";

interface DrawingOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DrawingOverlay = forwardRef<TldrawCanvasHandle, DrawingOverlayProps>(
  function DrawingOverlay({ isOpen, onClose }, ref) {
    const handleClose = useCallback(() => {
      onClose();
    }, [onClose]);

    return (
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-gray-900"
          >
            {/* Close button - z-[9999] to stay above tldraw UI */}
            <button
              onClick={handleClose}
              className="absolute top-4 right-4 z-[9999] p-2 bg-red-600 hover:bg-red-500 rounded-full text-white transition-colors shadow-lg"
              aria-label="关闭画板"
            >
              <X className="w-6 h-6" />
            </button>

            {/* Title */}
            <div className="absolute top-4 left-4 z-[9999]">
              <h2 className="text-white text-lg font-medium">AI 画板</h2>
              <p className="text-gray-400 text-sm">AI 正在绘制，你也可以自由绘图</p>
            </div>

            {/* Tldraw Canvas */}
            <div className="w-full h-full">
              <TldrawCanvas ref={ref} darkMode={true} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    );
  }
);

DrawingOverlay.displayName = "DrawingOverlay";
