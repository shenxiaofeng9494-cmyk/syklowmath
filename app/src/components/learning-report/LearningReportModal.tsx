"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { LearningAnalysis } from "@/lib/agents/types";
import {
  DIMENSION_LABELS,
  getScoreColor,
  getScoreBarBg,
  getScoreBarFill,
  TAG_COLORS,
} from "@/lib/learning-utils";

interface LearningReportModalProps {
  analysis: LearningAnalysis | null;
  videoTitle: string;
  open: boolean;
  loading?: boolean;
  onClose: () => void;
}

function LoadingSkeleton() {
  return (
    <>
      {/* Spinner + Loading text */}
      <div className="flex flex-col items-center py-6">
        <svg
          className="animate-spin w-10 h-10 text-blue-400 mb-3"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
        <p className="text-gray-300 text-sm">正在生成学习报告...</p>
      </div>

      {/* Skeleton bars */}
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="space-y-1.5">
            <div className="flex justify-between">
              <div className="h-3 w-16 bg-white/10 rounded animate-pulse" />
              <div className="h-3 w-8 bg-white/10 rounded animate-pulse" />
            </div>
            <div className="h-2 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full bg-white/5 rounded-full animate-pulse"
                style={{ width: `${30 + i * 12}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Skeleton tags */}
      <div className="flex gap-2 mt-2">
        <div className="h-6 w-14 bg-white/10 rounded-full animate-pulse" />
        <div className="h-6 w-20 bg-white/10 rounded-full animate-pulse" />
        <div className="h-6 w-16 bg-white/10 rounded-full animate-pulse" />
      </div>
    </>
  );
}

export function LearningReportModal({
  analysis,
  videoTitle,
  open,
  loading = false,
  onClose,
}: LearningReportModalProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        className="bg-[#1a1a2e] border-white/10 text-white sm:max-w-lg max-h-[85vh] overflow-y-auto"
        showCloseButton={false}
      >
        <DialogHeader>
          <DialogTitle className="text-white text-lg text-center">
            学习报告
          </DialogTitle>
          <p className="text-gray-400 text-sm text-center truncate">
            {videoTitle}
          </p>
        </DialogHeader>

        {loading || !analysis ? (
          <LoadingSkeleton />
        ) : (
          <>
            {/* Overall Score */}
            <motion.div
              className="flex flex-col items-center py-4"
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", duration: 0.6 }}
            >
              <div
                className="text-6xl font-bold tabular-nums"
                style={{ color: getScoreColor(analysis.overallLevel) }}
              >
                {analysis.overallLevel}
              </div>
              <div className="text-gray-400 text-sm mt-1">综合评分</div>
            </motion.div>

            {/* 5 Dimension Bars */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-gray-300">五维度评估</h3>
              {Object.entries(analysis.dimensions).map(([key, value], i) => (
                <motion.div
                  key={key}
                  className="space-y-1"
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.1 + i * 0.08 }}
                >
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-300">
                      {DIMENSION_LABELS[key] || key}
                    </span>
                    <span
                      className="font-medium tabular-nums"
                      style={{ color: getScoreColor(value) }}
                    >
                      {value}
                    </span>
                  </div>
                  <div
                    className={`h-2 rounded-full overflow-hidden ${getScoreBarBg(value)}`}
                  >
                    <motion.div
                      className={`h-full rounded-full ${getScoreBarFill(value)}`}
                      initial={{ width: 0 }}
                      animate={{ width: `${value}%` }}
                      transition={{ duration: 0.6, delay: 0.2 + i * 0.08 }}
                    />
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Problem Tags */}
            {analysis.problemTags.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-gray-300">问题标签</h3>
                <div className="flex flex-wrap gap-2">
                  <AnimatePresence>
                    {analysis.problemTags.map((tag, i) => (
                      <motion.span
                        key={tag}
                        className={`text-xs px-2.5 py-1 rounded-full border ${TAG_COLORS[tag] || "bg-gray-500/20 text-gray-300 border-gray-500/30"}`}
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.4 + i * 0.06 }}
                      >
                        {tag}
                      </motion.span>
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            )}

            {/* Key Observations */}
            {analysis.keyObservations.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-gray-300">关键观察</h3>
                <ul className="space-y-1.5">
                  {analysis.keyObservations.map((obs, i) => (
                    <motion.li
                      key={i}
                      className="text-sm text-gray-400 flex items-start gap-2"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.5 + i * 0.06 }}
                    >
                      <span className="text-blue-400 mt-0.5 shrink-0">-</span>
                      <span>{obs}</span>
                    </motion.li>
                  ))}
                </ul>
              </div>
            )}

            {/* Next Strategy */}
            {analysis.nextStrategy.focusAreas.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-gray-300">下次建议</h3>
                <div className="flex flex-wrap gap-2">
                  {analysis.nextStrategy.focusAreas.map((area, i) => (
                    <motion.span
                      key={i}
                      className="text-xs px-2.5 py-1 rounded-full bg-blue-500/15 text-blue-300 border border-blue-500/25"
                      initial={{ y: 10, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.6 + i * 0.06 }}
                    >
                      {area}
                    </motion.span>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        <DialogFooter className="mt-2">
          <Button
            onClick={onClose}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white"
          >
            返回首页
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
