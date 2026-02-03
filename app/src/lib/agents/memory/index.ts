// ============================================================
// V2 记忆系统（无 embedding 版本）
// ============================================================

import { supabase } from '@/lib/supabase';
import type {
  StudentProfile,
  LearningSnapshot,
  EpisodicMemory,
  LearningAnalysis,
  MemoryReadParams,
  MemoryData,
} from '../types';

// ============================================================
// 读取操作
// ============================================================

/**
 * 读取学生记忆
 */
export async function read(params: MemoryReadParams): Promise<MemoryData> {
  const { studentId, memoryType, limit = 10 } = params;
  const result: MemoryData = {};

  if (!supabase) {
    console.warn('[Memory] Supabase not available');
    return result;
  }

  try {
    // 读取画像
    if (memoryType === 'profile' || memoryType === 'all') {
      const { data: profile } = await supabase
        .from('student_profiles')
        .select('*')
        .eq('student_id', studentId)
        .single();
      result.profile = profile as StudentProfile | null;
    }

    // 读取历史快照
    if (memoryType === 'history' || memoryType === 'all') {
      const { data: history } = await supabase
        .from('learning_snapshots')
        .select('*')
        .eq('student_id', studentId)
        .order('created_at', { ascending: false })
        .limit(limit);
      result.history = (history || []) as LearningSnapshot[];
    }

    // 读取情景记忆
    if (memoryType === 'episodes' || memoryType === 'all') {
      const { data: episodes } = await supabase
        .from('episodic_memories')
        .select('*')
        .eq('student_id', studentId)
        .order('created_at', { ascending: false })
        .limit(limit);
      result.episodes = (episodes || []) as EpisodicMemory[];
    }
  } catch (error) {
    console.error('[Memory] Read error:', error);
  }

  return result;
}

/**
 * 获取或创建学生画像
 */
export async function getOrCreateProfile(studentId: string): Promise<StudentProfile> {
  if (!supabase) {
    return createDefaultProfile(studentId);
  }

  try {
    const { data: existing } = await supabase
      .from('student_profiles')
      .select('*')
      .eq('student_id', studentId)
      .single();

    if (existing) {
      return existing as StudentProfile;
    }

    const newProfile = createDefaultProfile(studentId);
    const { data: created, error } = await supabase
      .from('student_profiles')
      .insert(newProfile)
      .select()
      .single();

    if (error) {
      console.error('[Memory] Failed to create profile:', error);
      return newProfile;
    }

    return created as StudentProfile;
  } catch (error) {
    console.error('[Memory] getOrCreateProfile error:', error);
    return createDefaultProfile(studentId);
  }
}

/**
 * 创建默认画像
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

// ============================================================
// 写入操作
// ============================================================

/**
 * 保存学习快照
 */
export async function saveSnapshot(
  studentId: string,
  videoId: string,
  analysis: LearningAnalysis,
  conversationSummary?: string
): Promise<void> {
  if (!supabase) {
    console.warn('[Memory] Supabase not available, skipping snapshot save');
    return;
  }

  try {
    const snapshot: Partial<LearningSnapshot> = {
      student_id: studentId,
      video_id: videoId,
      overall_level: analysis.overallLevel,
      dimensions: analysis.dimensions,
      problem_tags: analysis.problemTags,
      preferred_style: analysis.preferredQuestionStyle,
      next_strategy: analysis.nextStrategy,
      key_observations: analysis.keyObservations,
      conversation_summary: conversationSummary,
    };

    const { error } = await supabase.from('learning_snapshots').insert(snapshot);

    if (error) {
      console.error('[Memory] Failed to save snapshot:', error);
    }
  } catch (error) {
    console.error('[Memory] saveSnapshot error:', error);
  }
}

/**
 * 更新学生画像（增量更新）
 */
export async function updateProfile(
  studentId: string,
  analysis: LearningAnalysis
): Promise<void> {
  if (!supabase) {
    console.warn('[Memory] Supabase not available, skipping profile update');
    return;
  }

  try {
    const current = await getOrCreateProfile(studentId);
    const alpha = 0.3;
    const newLevel = current.overall_level * (1 - alpha) + analysis.overallLevel * alpha;

    const newDimensions = {
      conceptUnderstanding:
        current.dimensions.conceptUnderstanding * (1 - alpha) +
        analysis.dimensions.conceptUnderstanding * alpha,
      procedureExecution:
        current.dimensions.procedureExecution * (1 - alpha) +
        analysis.dimensions.procedureExecution * alpha,
      reasoning:
        current.dimensions.reasoning * (1 - alpha) + analysis.dimensions.reasoning * alpha,
      transfer:
        current.dimensions.transfer * (1 - alpha) + analysis.dimensions.transfer * alpha,
      selfExplanation:
        current.dimensions.selfExplanation * (1 - alpha) +
        analysis.dimensions.selfExplanation * alpha,
    };

    const trend = calculateTrend(current.overall_level, analysis.overallLevel);
    const mergedTags = [
      ...new Set([...current.recent_problem_tags.slice(-2), ...analysis.problemTags]),
    ].slice(-4);

    const { error } = await supabase
      .from('student_profiles')
      .update({
        overall_level: Math.round(newLevel * 10) / 10,
        dimensions: newDimensions,
        preferred_style: analysis.preferredQuestionStyle,
        total_sessions: current.total_sessions + 1,
        recent_trend: trend,
        recent_problem_tags: mergedTags,
      })
      .eq('student_id', studentId);

    if (error) {
      console.error('[Memory] Failed to update profile:', error);
    }
  } catch (error) {
    console.error('[Memory] updateProfile error:', error);
  }
}

/**
 * 保存情景记忆（使用关键词替代 embedding）
 */
export async function saveEpisode(
  studentId: string,
  event: string,
  videoId?: string,
  importance = 3
): Promise<void> {
  if (!supabase) {
    console.warn('[Memory] Supabase not available, skipping episode save');
    return;
  }

  try {
    // 从事件文本中提取关键词
    const keywords = extractKeywords(event);

    const episode = {
      student_id: studentId,
      video_id: videoId,
      event,
      keywords,
      importance,
    };

    const { error } = await supabase.from('episodic_memories').insert(episode);

    if (error) {
      console.error('[Memory] Failed to save episode:', error);
    }
  } catch (error) {
    console.error('[Memory] saveEpisode error:', error);
  }
}

/**
 * 搜索相关情景记忆（基于关键词）
 */
export async function searchEpisodes(
  studentId: string,
  query: string,
  limit = 5
): Promise<EpisodicMemory[]> {
  if (!supabase) {
    return [];
  }

  try {
    const searchKeywords = extractKeywords(query);

    if (searchKeywords.length === 0) {
      // 如果没有关键词，返回最近的记忆
      const { data } = await supabase
        .from('episodic_memories')
        .select('*')
        .eq('student_id', studentId)
        .order('created_at', { ascending: false })
        .limit(limit);
      return data || [];
    }

    const { data, error } = await supabase.rpc('search_episodic_memories_by_keywords', {
      target_student_id: studentId,
      search_keywords: searchKeywords,
      match_count: limit,
    });

    if (error) {
      console.error('[Memory] Episode search error:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('[Memory] searchEpisodes error:', error);
    return [];
  }
}

/**
 * 保存对话日志
 */
export async function saveConversationLog(log: {
  studentId: string;
  videoId: string;
  sessionId: string;
  messages: any[];
  totalDuration?: number;
  silenceCount?: number;
  activeQuestionCount?: number;
  checkpointResponses?: any[];
}): Promise<void> {
  if (!supabase) {
    return;
  }

  try {
    const { error } = await supabase.from('conversation_logs').insert({
      student_id: log.studentId,
      video_id: log.videoId,
      session_id: log.sessionId,
      messages: log.messages,
      total_duration_seconds: log.totalDuration,
      silence_count: log.silenceCount,
      active_question_count: log.activeQuestionCount,
      checkpoint_responses: log.checkpointResponses,
    });

    if (error) {
      console.error('[Memory] Failed to save conversation log:', error);
    }
  } catch (error) {
    console.error('[Memory] saveConversationLog error:', error);
  }
}

// ============================================================
// 工具函数
// ============================================================

function calculateTrend(
  oldLevel: number,
  newLevel: number
): 'improving' | 'stable' | 'declining' {
  const diff = newLevel - oldLevel;
  if (diff > 5) return 'improving';
  if (diff < -5) return 'declining';
  return 'stable';
}

/**
 * 从文本中提取关键词
 */
function extractKeywords(text: string): string[] {
  const mathTerms = [
    '函数', '方程', '公式', '计算', '斜率', '截距', '坐标', '图像',
    '一次', '二次', '线性', '变量', '常数', '系数', '解', '根',
    '证明', '推导', '化简', '假懂', '条件', '遗漏', '走神', '理解',
    '概念', '定义', '定理', '公理', '性质', '应用', '迁移',
  ];

  const found: string[] = [];
  for (const term of mathTerms) {
    if (text.includes(term)) {
      found.push(term);
    }
  }

  return found.slice(0, 10); // 最多10个关键词
}

// 导出
export const memory = {
  read,
  getOrCreateProfile,
  saveSnapshot,
  updateProfile,
  saveEpisode,
  searchEpisodes,
  saveConversationLog,
};

export default memory;
