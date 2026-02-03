// ============================================================
// 学习分析 Agent
// ============================================================

import deepseek from '../deepseek-client';
import {
  LEARNING_ANALYZER_SYSTEM_PROMPT,
  LEARNING_ANALYZER_USER_PROMPT_TEMPLATE,
} from './prompts';
import type { LearningAnalysis, ChatMessage, CheckpointResponse } from '../types';

export interface AnalyzeParams {
  conversationLog: ChatMessage[];
  checkpointResponses?: CheckpointResponse[];
  videoTitle?: string;
  videoNodes?: string[];
}

/**
 * 分析学生学习表现
 */
export async function analyze(params: AnalyzeParams): Promise<LearningAnalysis> {
  const {
    conversationLog,
    checkpointResponses = [],
    videoTitle = '未知视频',
    videoNodes = [],
  } = params;

  // 格式化对话日志
  const formattedLog = formatConversationLog(conversationLog);
  const formattedCheckpoints = formatCheckpointResponses(checkpointResponses);

  // 构建 prompt
  const userPrompt = LEARNING_ANALYZER_USER_PROMPT_TEMPLATE
    .replace('{{videoTitle}}', videoTitle)
    .replace('{{videoNodes}}', videoNodes.join(', ') || '无')
    .replace('{{conversationLog}}', formattedLog || '无对话记录')
    .replace('{{checkpointResponses}}', formattedCheckpoints || '无');

  try {
    const result = await deepseek.chatJSON<LearningAnalysis>({
      messages: [
        { role: 'system', content: LEARNING_ANALYZER_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3, // 分析任务用较低温度
      maxTokens: 1500,
    });

    // 验证和修正结果
    return validateAndFixAnalysis(result);
  } catch (error) {
    console.error('[LearningAnalyzer] Analysis failed:', error);
    // 返回默认分析结果
    return getDefaultAnalysis();
  }
}

/**
 * 格式化对话日志
 */
function formatConversationLog(messages: ChatMessage[]): string {
  if (!messages || messages.length === 0) {
    return '';
  }

  return messages
    .map((msg) => {
      const role = msg.role === 'user' ? '学生' : 'AI老师';
      const time = msg.timestamp
        ? new Date(msg.timestamp).toLocaleTimeString('zh-CN')
        : '';
      return `[${time}] ${role}: ${msg.content}`;
    })
    .join('\n');
}

/**
 * 格式化检查点回答
 */
function formatCheckpointResponses(responses: CheckpointResponse[]): string {
  if (!responses || responses.length === 0) {
    return '';
  }

  return responses
    .map((r, i) => {
      const correctness = r.isCorrect !== undefined
        ? (r.isCorrect ? '✓正确' : '✗错误')
        : '未判断';
      const time = r.responseTimeMs
        ? `(${(r.responseTimeMs / 1000).toFixed(1)}秒)`
        : '';
      return `${i + 1}. 问题: ${r.question}\n   回答: ${r.answer} ${correctness} ${time}`;
    })
    .join('\n\n');
}

/**
 * 验证和修正分析结果
 */
function validateAndFixAnalysis(analysis: LearningAnalysis): LearningAnalysis {
  // 确保 overallLevel 在有效范围内
  analysis.overallLevel = Math.max(0, Math.min(100, analysis.overallLevel || 50));

  // 确保各维度在有效范围内
  if (analysis.dimensions) {
    for (const key of Object.keys(analysis.dimensions) as Array<keyof typeof analysis.dimensions>) {
      analysis.dimensions[key] = Math.max(0, Math.min(100, analysis.dimensions[key] || 50));
    }
  } else {
    analysis.dimensions = {
      conceptUnderstanding: 50,
      procedureExecution: 50,
      reasoning: 50,
      transfer: 50,
      selfExplanation: 50,
    };
  }

  // 确保 problemTags 是数组且最多2个
  if (!Array.isArray(analysis.problemTags)) {
    analysis.problemTags = [];
  }
  analysis.problemTags = analysis.problemTags.slice(0, 2);

  // 确保 nextStrategy 存在
  if (!analysis.nextStrategy) {
    analysis.nextStrategy = {
      introQuestionCount: 1,
      midpointQuestion: true,
      difficulty: 5,
      focusAreas: [],
    };
  }

  // 确保 keyObservations 是数组
  if (!Array.isArray(analysis.keyObservations)) {
    analysis.keyObservations = [];
  }

  return analysis;
}

/**
 * 获取默认分析结果（当分析失败时使用）
 */
function getDefaultAnalysis(): LearningAnalysis {
  return {
    overallLevel: 50,
    dimensions: {
      conceptUnderstanding: 50,
      procedureExecution: 50,
      reasoning: 50,
      transfer: 50,
      selfExplanation: 50,
    },
    problemTags: [],
    preferredQuestionStyle: '参与感选择',
    nextStrategy: {
      introQuestionCount: 1,
      midpointQuestion: true,
      difficulty: 5,
      focusAreas: [],
    },
    keyObservations: ['分析数据不足，使用默认评估'],
    shouldSaveEpisode: false,
  };
}

export default { analyze };
