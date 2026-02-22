"use client";

/**
 * useLearningSession Hook
 *
 * 管理跨语音模式的学习会话生命周期。
 * 一个学生同一视频同时只有一个 active session。
 * 提供 logQA 方法供语音 hooks 在每轮对话后调用。
 */

import { useState, useCallback, useRef, useEffect } from "react";

export interface LearningSession {
  session_id: string;
  student_id: string;
  video_id: string;
  status: "active" | "ended";
  turn_count: number;
  context_summary: string;
  recent_qa: RecentQA[];
  concepts_touched: Record<string, string>;
  plan_state: {
    checkpoints_triggered: string[];
    checkpoints_invalidated: string[];
    next_suggested_action: string | null;
  };
  is_local?: boolean;
}

export interface RecentQA {
  q: string;
  a: string;
  mode: "realtime" | "precise" | "doubao_realtime";
  ts: number;
}

interface UseLearningSessionOptions {
  studentId: string;
  videoId: string;
}

/** checkpoint 精准模式回答结果 */
export interface CheckpointResult {
  studentId: string;
  nodeId: string;
  keyConcepts: string[];
  isCorrect: boolean;
  interventionType?: string; // quick_check | trap_alert | final_check
}

interface UseLearningSessionReturn {
  sessionId: string | null;
  session: LearningSession | null;
  isReady: boolean;
  /** 每轮对话后调用，记录 Q&A 到 session */
  logQA: (question: string, answer: string, mode: "realtime" | "precise" | "doubao_realtime", checkpointResult?: CheckpointResult) => void;
  /** 结束 session（离开页面时调用） */
  endSession: () => void;
}

export function useLearningSession(options: UseLearningSessionOptions): UseLearningSessionReturn {
  const [session, setSession] = useState<LearningSession | null>(null);
  const [isReady, setIsReady] = useState(false);
  const sessionIdRef = useRef<string | null>(null);
  const optionsRef = useRef(options);

  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  // 创建/恢复 session
  useEffect(() => {
    if (!options.studentId || !options.videoId) return;

    let cancelled = false;

    async function initSession() {
      try {
        const response = await fetch("/api/session/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            studentId: options.studentId,
            videoId: options.videoId,
          }),
        });

        if (!response.ok) {
          console.error("[LearningSession] 创建失败:", response.status);
          return;
        }

        const data: LearningSession = await response.json();

        if (!cancelled) {
          sessionIdRef.current = data.session_id;
          setSession(data);
          setIsReady(true);
          console.log(`[LearningSession] 就绪: id=${data.session_id} turns=${data.turn_count} resumed=${data.turn_count > 0}`);
        }
      } catch (error) {
        console.error("[LearningSession] 初始化失败:", error);
      }
    }

    initSession();

    return () => {
      cancelled = true;
    };
  }, [options.studentId, options.videoId]);

  // 记录 Q&A（fire-and-forget，不阻塞对话）
  // 如果传入 checkpointResult，则同时触发画像更新
  const logQA = useCallback(
    (question: string, answer: string, mode: "realtime" | "precise" | "doubao_realtime", checkpointResult?: CheckpointResult) => {
      const sid = sessionIdRef.current;
      if (!sid || !question) return;

      const payload: Record<string, unknown> = {
        sessionId: sid,
        question,
        answer,
        mode,
      };

      // 附带 checkpoint 结果 → 后端会触发画像更新
      if (checkpointResult) {
        payload.checkpointResult = checkpointResult;
        console.log(`[LearningSession] checkpoint logQA: node=${checkpointResult.nodeId} correct=${checkpointResult.isCorrect}`);
      }

      // Fire-and-forget: 不 await，不阻塞
      fetch("/api/session/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
        .then((res) => {
          if (!res.ok) {
            console.error("[LearningSession] logQA failed:", res.status);
          }
        })
        .catch((err) => {
          console.error("[LearningSession] logQA error:", err);
        });
    },
    []
  );

  // 结束 session
  const endSession = useCallback(() => {
    const sid = sessionIdRef.current;
    if (!sid) return;

    // 使用 sendBeacon 确保页面关闭时也能发出请求
    const sent = navigator.sendBeacon(
      "/api/session/end",
      new Blob([JSON.stringify({ sessionId: sid })], { type: "application/json" })
    );
    if (!sent) {
      // fallback to fetch
      fetch("/api/session/end", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: sid }),
      }).catch((err) => {
        console.error("[LearningSession] endSession error:", err);
      });
    }

    sessionIdRef.current = null;
    setSession(null);
    setIsReady(false);
  }, []);

  // 页面关闭/离开时自动结束 session
  useEffect(() => {
    const handleBeforeUnload = () => {
      const sid = sessionIdRef.current;
      if (sid) {
        navigator.sendBeacon(
          "/api/session/end",
          new Blob([JSON.stringify({ sessionId: sid })], { type: "application/json" })
        );
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      // 组件卸载时也结束 session
      handleBeforeUnload();
    };
  }, []);

  return {
    sessionId: session?.session_id ?? null,
    session,
    isReady,
    logQA,
    endSession,
  };
}
