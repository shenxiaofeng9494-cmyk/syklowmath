// ============================================================
// 问题生成 Agent
// ============================================================

import deepseek from '../deepseek-client';
import {
  QUESTION_GENERATOR_SYSTEM_PROMPT,
  QUESTION_GENERATOR_USER_PROMPT_TEMPLATE,
} from './prompts';
import type { StudentProfile, GeneratedQuestion, QuestionStyle } from '../types';

export interface GenerateParams {
  studentProfile: StudentProfile;
  videoTitle: string;
  currentNodeTitle: string;
  currentNodeSummary?: string;
  keyConcepts?: string[];
  questionContext: 'intro' | 'midpoint' | 'ending';
  constraints?: {
    minDifficulty?: number;
    maxDifficulty?: number;
    questionCount?: number;
  };
}

export interface GenerateResult {
  questions: GeneratedQuestion[];
  reasoning: string;
}

/**
 * 生成个性化问题
 */
export async function generate(params: GenerateParams): Promise<GenerateResult> {
  const {
    studentProfile,
    videoTitle,
    currentNodeTitle,
    currentNodeSummary = '',
    keyConcepts = [],
    questionContext,
    constraints = {},
  } = params;

  // 根据学生水平设置默认难度范围
  const defaultMinDifficulty = studentProfile.overall_level > 70 ? 6 :
                               studentProfile.overall_level > 40 ? 4 : 2;
  const defaultMaxDifficulty = studentProfile.overall_level > 70 ? 9 :
                               studentProfile.overall_level > 40 ? 7 : 5;

  const minDifficulty = constraints.minDifficulty ?? defaultMinDifficulty;
  const maxDifficulty = constraints.maxDifficulty ?? defaultMaxDifficulty;

  // 根据场景设置默认问题数量
  const defaultCount = questionContext === 'intro' ? 2 : 1;
  const questionCount = constraints.questionCount ?? defaultCount;

  // 场景描述
  const contextDescription = {
    intro: '视频开头定档提问：确认学生对前置知识的掌握，快速定档，问题要简短',
    midpoint: '视频中途固定点提问：检验当前知识点的理解，拉回注意力，只问1个问题',
    ending: '视频结尾追问：总结性问题，为下次学习铺垫',
  }[questionContext];

  // 构建 prompt
  const userPrompt = QUESTION_GENERATOR_USER_PROMPT_TEMPLATE
    .replace('{{overallLevel}}', String(Math.round(studentProfile.overall_level)))
    .replace('{{preferredStyle}}', studentProfile.preferred_style)
    .replace('{{recentTrend}}', studentProfile.recent_trend)
    .replace('{{problemTags}}', studentProfile.recent_problem_tags?.join(', ') || '无')
    .replace('{{knowledgeGaps}}', studentProfile.knowledge_gaps?.join(', ') || '无明显薄弱点')
    .replace('{{videoTitle}}', videoTitle)
    .replace('{{currentNodeTitle}}', currentNodeTitle)
    .replace('{{currentNodeSummary}}', currentNodeSummary || '无摘要')
    .replace('{{keyConcepts}}', keyConcepts.join(', ') || '无')
    .replace('{{questionContext}}', contextDescription)
    .replace('{{minDifficulty}}', String(minDifficulty))
    .replace('{{maxDifficulty}}', String(maxDifficulty))
    .replace('{{questionCount}}', String(questionCount));

  try {
    const result = await deepseek.chatJSON<GenerateResult>({
      messages: [
        { role: 'system', content: QUESTION_GENERATOR_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7, // 生成任务用稍高温度增加多样性
      maxTokens: 1500,
    });

    // 验证和修正结果
    return validateAndFixResult(result, questionCount);
  } catch (error) {
    console.error('[QuestionGenerator] Generation failed:', error);
    // 返回默认问题
    return getDefaultQuestions(questionContext, studentProfile.preferred_style);
  }
}

/**
 * 验证和修正生成结果
 */
function validateAndFixResult(result: GenerateResult, expectedCount: number): GenerateResult {
  if (!result.questions || !Array.isArray(result.questions)) {
    result.questions = [];
  }

  // 确保每个问题都有必要字段
  result.questions = result.questions.map((q) => ({
    content: q.content || '请回答这个问题',
    style: q.style || '参与感选择',
    difficulty: Math.max(1, Math.min(10, q.difficulty || 5)),
    expectedAnswerType: q.expectedAnswerType || 'short_answer',
    followUp: q.followUp,
    targetConcept: q.targetConcept,
    hints: q.hints || [],
  }));

  // 确保有 reasoning
  if (!result.reasoning) {
    result.reasoning = '根据学生画像生成';
  }

  return result;
}

/**
 * 获取默认问题（当生成失败时使用）
 */
function getDefaultQuestions(
  context: 'intro' | 'midpoint' | 'ending',
  style: QuestionStyle
): GenerateResult {
  const defaultQuestions: Record<string, GeneratedQuestion> = {
    intro: {
      content: '在开始之前，你觉得自己对这个内容了解多少？选一个：完全不知道 / 听过但不太懂 / 比较熟悉',
      style: '参与感选择',
      difficulty: 3,
      expectedAnswerType: 'multiple_choice',
    },
    midpoint: {
      content: '到这里有没有什么不太明白的地方？',
      style: '参与感选择',
      difficulty: 3,
      expectedAnswerType: 'open_ended',
    },
    ending: {
      content: '用一句话说说，今天最重要的一个点是什么？',
      style: '一句话复述',
      difficulty: 4,
      expectedAnswerType: 'short_answer',
    },
  };

  return {
    questions: [defaultQuestions[context]],
    reasoning: '使用默认问题（生成失败时的备选）',
  };
}

/**
 * 快速生成单个问题（简化接口）
 */
export async function generateSingle(params: {
  studentLevel: number;
  preferredStyle: QuestionStyle;
  videoTitle: string;
  nodeTitle: string;
  context: 'intro' | 'midpoint' | 'ending';
}): Promise<GeneratedQuestion | null> {
  const profile: StudentProfile = {
    student_id: 'temp',
    overall_level: params.studentLevel,
    dimensions: {
      conceptUnderstanding: params.studentLevel,
      procedureExecution: params.studentLevel,
      reasoning: params.studentLevel,
      transfer: params.studentLevel,
      selfExplanation: params.studentLevel,
    },
    preferred_style: params.preferredStyle,
    total_sessions: 0,
    recent_trend: 'stable',
    knowledge_gaps: [],
    recent_problem_tags: [],
    created_at: '',
    updated_at: '',
  };

  const result = await generate({
    studentProfile: profile,
    videoTitle: params.videoTitle,
    currentNodeTitle: params.nodeTitle,
    questionContext: params.context,
    constraints: { questionCount: 1 },
  });

  return result.questions[0] || null;
}

export default { generate, generateSingle };
