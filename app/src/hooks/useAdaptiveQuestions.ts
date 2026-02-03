// ============================================================
// V2 自适应提问系统 - 前端 Hook
// ============================================================

import { useState, useCallback, useRef } from 'react';
import type {
  OrchestratorResponse,
  GeneratedQuestion,
  LearningAnalysis,
  ChatMessage,
  CheckpointResponse,
} from '@/lib/agents/types';

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
  }, [studentId, videoId, videoTitle, onError]);

  /**
   * 记录对话消息（用于后续分析）
   */
  const logMessage = useCallback((role: 'user' | 'assistant', content: string) => {
    conversationLogRef.current.push({
      role,
      content,
      timestamp: Date.now(),
    });
  }, []);

  /**
   * 记录检查点回答
   */
  const logCheckpointResponse = useCallback((response: CheckpointResponse) => {
    checkpointResponsesRef.current.push(response);
  }, []);

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

    // 日志记录
    logMessage,
    logCheckpointResponse,

    // 问题控制
    clearCurrentQuestion,
    nextQuestion,
  };
}

export default useAdaptiveQuestions;
