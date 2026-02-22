// ============================================================
// 主控 Agent (Orchestrator)
// 协调所有子 Agent，处理各种意图
// ============================================================

import memory from '../memory';
import learningAnalyzer from '../learning-analyzer';
import questionGenerator from '../question-generator';
import intentGateway from '../intent-gateway';
import { unwrapOr } from '../types';
import type {
  OrchestratorRequest,
  OrchestratorResponse,
  StudentProfile,
  ChatMessage,
} from '../types';

/**
 * 主控 Agent 入口
 */
export async function orchestrate(request: OrchestratorRequest): Promise<OrchestratorResponse> {
  const { intent, studentId, videoId, payload = {} } = request;

  console.log(`[Orchestrator] Processing intent: ${intent}, student: ${studentId}`);

  try {
    switch (intent) {
      case 'enter_video':
        return await handleEnterVideo(studentId, videoId, payload);

      case 'video_ended':
        return await handleVideoEnded(studentId, videoId, payload);

      case 'checkpoint_reached':
        return await handleCheckpointReached(studentId, videoId, payload);

      case 'voice_input':
        return await handleVoiceInput(studentId, videoId, payload);

      default:
        return {
          action: 'error',
          data: { reason: `Unknown intent: ${intent}` },
        };
    }
  } catch (error) {
    console.error('[Orchestrator] Error:', error);
    return {
      action: 'error',
      data: { reason: error instanceof Error ? error.message : 'Unknown error' },
    };
  }
}

/**
 * 处理进入视频事件
 * 生成开头定档问题
 */
async function handleEnterVideo(
  studentId: string,
  videoId: string,
  payload: OrchestratorRequest['payload']
): Promise<OrchestratorResponse> {
  // 1. 获取或创建学生画像（使用 Result 类型处理）
  const profileResult = await memory.getOrCreateProfile(studentId);
  const profile = unwrapOr(profileResult, createDefaultProfile(studentId));

  if (!profileResult.ok) {
    console.warn(`[Orchestrator] Profile fetch warning: ${profileResult.error}, using fallback`);
  }
  console.log(`[Orchestrator] Student profile loaded, level: ${profile.overall_level}`);

  // 2. 获取视频信息（从 payload 或使用默认值）
  const videoTitle = payload?.videoTitle || '数学视频';
  const currentNodeTitle = payload?.currentNodeTitle || '知识点';
  const currentNodeSummary = payload?.currentNodeSummary || '';
  const keyConcepts = payload?.keyConcepts || [];

  // 3. 生成开头问题
  const result = await questionGenerator.generate({
    studentProfile: profile,
    videoTitle,
    currentNodeTitle,
    currentNodeSummary,
    keyConcepts,
    questionContext: 'intro',
  });

  console.log(`[Orchestrator] Generated ${result.questions.length} intro questions`);

  return {
    action: 'ask_questions',
    data: {
      questions: result.questions,
    },
    reasoning: result.reasoning,
  };
}

/**
 * 处理视频结束事件
 * 分析学习表现，更新学生画像
 */
async function handleVideoEnded(
  studentId: string,
  videoId: string,
  payload: OrchestratorRequest['payload']
): Promise<OrchestratorResponse> {
  const conversationLog = payload?.conversationLog || [];
  const checkpointResponses = payload?.checkpointResponses || [];

  // 如果没有对话记录，跳过分析
  if (conversationLog.length === 0 && checkpointResponses.length === 0) {
    console.log('[Orchestrator] No conversation data, skipping analysis');
    return {
      action: 'analysis_complete',
      data: {
        analysis: null,
      },
      reasoning: '无对话数据，跳过分析',
    };
  }

  // 1. 分析学习表现
  const analysis = await learningAnalyzer.analyze({
    conversationLog: conversationLog as ChatMessage[],
    checkpointResponses,
    videoTitle: payload?.videoTitle,
    videoNodes: payload?.videoNodes,
  });

  console.log(`[Orchestrator] Analysis complete, level: ${analysis.overallLevel}`);

  // 2. 保存学习快照（Result 类型，记录但不阻塞）
  const snapshotResult = await memory.saveSnapshot(studentId, videoId, analysis);
  if (!snapshotResult.ok) {
    console.warn(`[Orchestrator] Snapshot save warning: ${snapshotResult.error}`);
  }

  // 3. 更新学生画像
  const updateResult = await memory.updateProfile(studentId, analysis);
  if (!updateResult.ok) {
    console.warn(`[Orchestrator] Profile update warning: ${updateResult.error}`);
  }

  // 4. 保存情景记忆（如果有重要事件）
  if (analysis.shouldSaveEpisode && analysis.episodeEvent) {
    const episodeResult = await memory.saveEpisode(studentId, analysis.episodeEvent, videoId);
    if (episodeResult.ok) {
      console.log(`[Orchestrator] Saved episode: ${analysis.episodeEvent}`);
    } else {
      console.warn(`[Orchestrator] Episode save warning: ${episodeResult.error}`);
    }
  }

  // 5. 保存对话日志
  if (conversationLog.length > 0) {
    const logResult = await memory.saveConversationLog({
      studentId,
      videoId,
      sessionId: payload?.sessionId || `session-${Date.now()}`,
      messages: conversationLog,
      checkpointResponses,
    });
    if (!logResult.ok) {
      console.warn(`[Orchestrator] Conversation log save warning: ${logResult.error}`);
    }
  }

  return {
    action: 'analysis_complete',
    data: {
      analysis,
    },
    reasoning: `分析完成，学生水平: ${analysis.overallLevel}，问题标签: ${analysis.problemTags.join(', ') || '无'}`,
  };
}

/**
 * 处理检查点到达事件
 * 生成固定点提问
 */
async function handleCheckpointReached(
  studentId: string,
  videoId: string,
  payload: OrchestratorRequest['payload']
): Promise<OrchestratorResponse> {
  // 1. 获取学生画像（使用 Result 类型处理）
  const profileResult = await memory.getOrCreateProfile(studentId);
  const profile = unwrapOr(profileResult, createDefaultProfile(studentId));

  // 2. 生成中途问题
  const result = await questionGenerator.generate({
    studentProfile: profile,
    videoTitle: payload?.videoTitle || '数学视频',
    currentNodeTitle: payload?.checkpointNode?.title || '当前知识点',
    currentNodeSummary: payload?.checkpointNode?.summary || '',
    keyConcepts: payload?.checkpointNode?.keyConcepts || [],
    questionContext: 'midpoint',
    constraints: { questionCount: 1 },
  });

  return {
    action: 'ask_questions',
    data: {
      questions: result.questions,
    },
    reasoning: result.reasoning,
  };
}

/**
 * 处理语音输入事件
 * 先过意图网关，再决定是否响应
 */
async function handleVoiceInput(
  studentId: string,
  videoId: string,
  payload: OrchestratorRequest['payload']
): Promise<OrchestratorResponse> {
  const asrText = payload?.asrText || '';
  const dialogState = payload?.dialogState || 'idle';
  const lastAiMessage = payload?.lastAiMessage;

  // 1. 意图分类
  const intentResult = await intentGateway.classify({
    asrText,
    dialogState,
    lastAiMessage,
  });

  console.log(`[Orchestrator] Intent: ${intentResult.action}, confidence: ${intentResult.confidence}`);

  // 2. 如果应该忽略
  if (intentResult.action === 'IGNORE') {
    return {
      action: 'ignore',
      data: {
        reason: intentResult.reason,
      },
      reasoning: `忽略原因: ${intentResult.reason} (置信度: ${intentResult.confidence})`,
    };
  }

  // 3. 如果应该响应，返回让前端继续正常对话流程
  return {
    action: 'respond',
    data: {
      intentType: intentResult.intentType,
    },
    reasoning: `需要响应: ${intentResult.reason} (置信度: ${intentResult.confidence})`,
  };
}

/**
 * 快速意图检查（不经过完整 orchestrate 流程）
 */
export async function quickIntentCheck(
  asrText: string,
  dialogState: 'idle' | 'waiting_answer' | 'ai_speaking'
): Promise<{ shouldRespond: boolean; reason: string }> {
  const result = await intentGateway.classify({ asrText, dialogState });
  return {
    shouldRespond: result.action === 'RESPOND',
    reason: result.reason,
  };
}

/**
 * 创建默认学生画像
 */
function createDefaultProfile(studentId: string): StudentProfile {
  return {
    student_id: studentId,
    overall_level: 50,
    dimensions: {
      conceptUnderstanding: 50,
      procedureExecution: 50,
      reasoning: 50,
      transfer: 50,
      selfExplanation: 50,
    },
    preferred_style: '参与感选择',
    total_sessions: 0,
    recent_trend: 'stable',
    knowledge_gaps: [],
    recent_problem_tags: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

export default { orchestrate, quickIntentCheck };
