// ============================================================
// V2 自适应提问系统 - 前端 Hook
// ============================================================

import { useState, useCallback, useRef, useEffect } from 'react';
import type {
  OrchestratorResponse,
  GeneratedQuestion,
  LearningAnalysis,
  ChatMessage,
  CheckpointResponse,
} from '@/lib/agents/types';

// localStorage key 和 saved data 结构
function getStorageKey(videoId: string, studentId: string) {
  return `mathtalk_session_${videoId}_${studentId}`;
}

interface SavedSessionData {
  conversationLog: ChatMessage[];
  checkpointResponses: CheckpointResponse[];
  videoId: string;
  studentId: string;
  savedAt: number;
}

interface UseAdaptiveQuestionsOptions {
  studentId: string;
  videoId: string;
  videoTitle?: string;
  onError?: (error: Error) => void;
}

interface AdaptiveQuestionsState {
  introQuestions: GeneratedQuestion[];
  currentQuestion: GeneratedQuestion | null;
  isLoading: boolean;
  lastAnalysis: LearningAnalysis | null;
}

export function useAdaptiveQuestions(options: UseAdaptiveQuestionsOptions) {
  const { studentId, videoId, videoTitle, onError } = options;

  const [state, setState] = useState<AdaptiveQuestionsState>({
    introQuestions: [],
    currentQuestion: null,
    isLoading: false,
    lastAnalysis: null,
  });

  // 对话日志收集
  const conversationLogRef = useRef<ChatMessage[]>([]);
  const checkpointResponsesRef = useRef<CheckpointResponse[]>([]);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 预生成检查点动态问题缓存
  const pregeneratedRef = useRef<Map<string, GeneratedQuestion>>(new Map());

  // localStorage 持久化：debounced save
  const saveToStorage = useCallback(() => {
    if (typeof window === 'undefined') return;
    try {
      const data: SavedSessionData = {
        conversationLog: conversationLogRef.current,
        checkpointResponses: checkpointResponsesRef.current,
        videoId,
        studentId,
        savedAt: Date.now(),
      };
      localStorage.setItem(getStorageKey(videoId, studentId), JSON.stringify(data));
    } catch {
      // quota exceeded or other storage error — silently ignore
    }
  }, [videoId, studentId]);

  const debouncedSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(saveToStorage, 500);
  }, [saveToStorage]);

  const clearStorage = useCallback(() => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.removeItem(getStorageKey(videoId, studentId));
    } catch { /* ignore */ }
  }, [videoId, studentId]);

  // Restore from localStorage on init
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(getStorageKey(videoId, studentId));
      if (!raw) return;
      const saved: SavedSessionData = JSON.parse(raw);
      // Only restore if data is less than 24 hours old
      if (Date.now() - saved.savedAt > 24 * 60 * 60 * 1000) {
        localStorage.removeItem(getStorageKey(videoId, studentId));
        return;
      }
      if (saved.conversationLog?.length) {
        conversationLogRef.current = saved.conversationLog;
      }
      if (saved.checkpointResponses?.length) {
        checkpointResponsesRef.current = saved.checkpointResponses;
      }
      console.log('[useAdaptiveQuestions] Restored session from localStorage:', {
        messages: saved.conversationLog?.length ?? 0,
        checkpoints: saved.checkpointResponses?.length ?? 0,
      });
    } catch { /* corrupted data — ignore */ }
  }, [videoId, studentId]);

  /**
   * 进入视频时获取开头问题
   */
  const fetchIntroQuestions = useCallback(async (nodeInfo?: {
    nodeTitle?: string;
    nodeSummary?: string;
    keyConcepts?: string[];
  }) => {
    setState(prev => ({ ...prev, isLoading: true }));

    try {
      const res = await fetch('/api/agent/main', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          intent: 'enter_video',
          studentId,
          videoId,
          payload: {
            videoTitle,
            currentNodeTitle: nodeInfo?.nodeTitle,
            currentNodeSummary: nodeInfo?.nodeSummary,
            keyConcepts: nodeInfo?.keyConcepts,
          },
        }),
      });

      const data: OrchestratorResponse = await res.json();

      if (data.action === 'ask_questions' && data.data?.questions) {
        setState(prev => ({
          ...prev,
          introQuestions: data.data!.questions!,
          currentQuestion: data.data!.questions![0] || null,
          isLoading: false,
        }));
        return data.data.questions;
      }

      setState(prev => ({ ...prev, isLoading: false }));
      return [];
    } catch (error) {
      console.error('[useAdaptiveQuestions] fetchIntroQuestions error:', error);
      onError?.(error instanceof Error ? error : new Error('Unknown error'));
      setState(prev => ({ ...prev, isLoading: false }));
      return [];
    }
  }, [studentId, videoId, videoTitle, onError]);

  /**
   * 获取检查点问题
   */
  const fetchCheckpointQuestion = useCallback(async (checkpointNode: {
    title: string;
    summary?: string;
    keyConcepts?: string[];
  }) => {
    setState(prev => ({ ...prev, isLoading: true }));

    try {
      const res = await fetch('/api/agent/main', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          intent: 'checkpoint_reached',
          studentId,
          videoId,
          payload: {
            videoTitle,
            checkpointNode,
          },
        }),
      });

      const data: OrchestratorResponse = await res.json();

      if (data.action === 'ask_questions' && data.data?.questions?.[0]) {
        const question = data.data.questions[0];
        setState(prev => ({
          ...prev,
          currentQuestion: question,
          isLoading: false,
        }));
        return question;
      }

      setState(prev => ({ ...prev, isLoading: false }));
      return null;
    } catch (error) {
      console.error('[useAdaptiveQuestions] fetchCheckpointQuestion error:', error);
      onError?.(error instanceof Error ? error : new Error('Unknown error'));
      setState(prev => ({ ...prev, isLoading: false }));
      return null;
    }
  }, [studentId, videoId, videoTitle, onError]);

  /**
   * 视频结束时提交分析
   */
  const submitLearningData = useCallback(async (additionalData?: {
    videoNodes?: string[];
  }) => {
    setState(prev => ({ ...prev, isLoading: true }));

    try {
      const res = await fetch('/api/agent/main', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          intent: 'video_ended',
          studentId,
          videoId,
          payload: {
            videoTitle,
            conversationLog: conversationLogRef.current,
            checkpointResponses: checkpointResponsesRef.current,
            videoNodes: additionalData?.videoNodes,
            sessionId: `session-${Date.now()}`,
          },
        }),
      });

      const data: OrchestratorResponse = await res.json();

      if (data.action === 'analysis_complete' && data.data?.analysis) {
        setState(prev => ({
          ...prev,
          lastAnalysis: data.data!.analysis!,
          isLoading: false,
        }));

        // 清空收集的数据
        conversationLogRef.current = [];
        checkpointResponsesRef.current = [];
        clearStorage();

        return data.data.analysis;
      }

      setState(prev => ({ ...prev, isLoading: false }));
      return null;
    } catch (error) {
      console.error('[useAdaptiveQuestions] submitLearningData error:', error);
      onError?.(error instanceof Error ? error : new Error('Unknown error'));
      setState(prev => ({ ...prev, isLoading: false }));
      return null;
    }
  }, [studentId, videoId, videoTitle, onError, clearStorage]);

  /**
   * 记录对话消息（用于后续分析）
   */
  const logMessage = useCallback((role: 'user' | 'assistant', content: string) => {
    conversationLogRef.current.push({
      role,
      content,
      timestamp: Date.now(),
    });
    debouncedSave();
  }, [debouncedSave]);

  /**
   * 记录检查点回答
   */
  const logCheckpointResponse = useCallback((response: CheckpointResponse) => {
    checkpointResponsesRef.current.push(response);
    debouncedSave();
  }, [debouncedSave]);

  /**
   * 意图检查（在语音输入前调用）
   */
  const checkIntent = useCallback(async (
    asrText: string,
    dialogState: 'idle' | 'waiting_answer' | 'ai_speaking' = 'idle'
  ): Promise<{ shouldRespond: boolean; reason: string }> => {
    try {
      const res = await fetch('/api/agent/intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ asrText, dialogState }),
      });

      return await res.json();
    } catch (error) {
      console.error('[useAdaptiveQuestions] checkIntent error:', error);
      // 出错时默认响应
      return { shouldRespond: true, reason: 'Error, defaulting to respond' };
    }
  }, []);

  /**
   * 检查是否有未提交的对话数据
   */
  const hasUnsavedData = useCallback(() => {
    return conversationLogRef.current.length > 0;
  }, []);

  /**
   * 获取用于 sendBeacon 的数据负载
   */
  const getBeaconPayload = useCallback(() => {
    return {
      intent: 'video_ended' as const,
      studentId,
      videoId,
      payload: {
        videoTitle,
        conversationLog: conversationLogRef.current,
        checkpointResponses: checkpointResponsesRef.current,
        sessionId: `session-${Date.now()}`,
      },
    };
  }, [studentId, videoId, videoTitle]);

  /**
   * 预生成所有检查点的动态问题（并行调用 LLM，结果存入缓存）
   */
  const pregenerateCheckpointQuestions = useCallback(async (checkpoints: Array<{
    id: string;
    title: string;
    summary?: string;
    keyConcepts?: string[];
  }>) => {
    console.log(`[V2] Pre-generating questions for ${checkpoints.length} checkpoints...`);

    const results = await Promise.allSettled(
      checkpoints.map(async (cp) => {
        const res = await fetch('/api/agent/main', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            intent: 'checkpoint_reached',
            studentId,
            videoId,
            payload: {
              videoTitle,
              checkpointNode: {
                title: cp.title,
                summary: cp.summary,
                keyConcepts: cp.keyConcepts,
              },
            },
          }),
        });
        const data: OrchestratorResponse = await res.json();
        if (data.action === 'ask_questions' && data.data?.questions?.[0]) {
          return { id: cp.id, question: data.data.questions[0] };
        }
        return null;
      })
    );

    let cached = 0;
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) {
        pregeneratedRef.current.set(result.value.id, result.value.question);
        cached++;
      }
    }
    console.log(`[V2] Pre-generation complete: ${cached}/${checkpoints.length} questions cached`);
  }, [studentId, videoId, videoTitle]);

  /**
   * 获取预生成的检查点问题（命中后从缓存删除，一次性使用）
   */
  const getPregeneratedQuestion = useCallback((checkpointId: string): GeneratedQuestion | null => {
    const question = pregeneratedRef.current.get(checkpointId) || null;
    if (question) {
      pregeneratedRef.current.delete(checkpointId);
      console.log(`[V2] Pre-generated question cache hit for checkpoint: ${checkpointId}`);
    }
    return question;
  }, []);

  /**
   * 清除当前问题
   */
  const clearCurrentQuestion = useCallback(() => {
    setState(prev => ({ ...prev, currentQuestion: null }));
  }, []);

  /**
   * 移动到下一个问题
   */
  const nextQuestion = useCallback(() => {
    setState(prev => {
      const currentIndex = prev.introQuestions.findIndex(q => q === prev.currentQuestion);
      const nextIndex = currentIndex + 1;
      if (nextIndex < prev.introQuestions.length) {
        return { ...prev, currentQuestion: prev.introQuestions[nextIndex] };
      }
      return { ...prev, currentQuestion: null };
    });
  }, []);

  return {
    // 状态
    introQuestions: state.introQuestions,
    currentQuestion: state.currentQuestion,
    isLoading: state.isLoading,
    lastAnalysis: state.lastAnalysis,

    // 动作
    fetchIntroQuestions,
    fetchCheckpointQuestion,
    submitLearningData,
    checkIntent,
    pregenerateCheckpointQuestions,
    getPregeneratedQuestion,

    // 日志记录
    logMessage,
    logCheckpointResponse,

    // 会话保护
    hasUnsavedData,
    getBeaconPayload,

    // 问题控制
    clearCurrentQuestion,
    nextQuestion,
  };
}

export default useAdaptiveQuestions;
