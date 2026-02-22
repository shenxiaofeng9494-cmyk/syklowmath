// ============================================================
// V2 记忆系统（混合模式：Supabase + 内存 Fallback）
// ============================================================

import { supabase } from '@/lib/supabase';
import { fallbackStore } from './fallback-store';
import {
  ok,
  err,
  unwrapOr,
  type Result,
} from '../types';
import type {
  StudentProfile,
  LearningSnapshot,
  EpisodicMemory,
  LearningAnalysis,
  MemoryReadParams,
  MemoryData,
} from '../types';

// 跟踪 Supabase 可用性
let supabaseAvailable = true;
let lastSupabaseCheck = 0;
const SUPABASE_CHECK_INTERVAL = 30000; // 30秒检查一次

/**
 * 检查 Supabase 是否可用
 */
async function checkSupabaseAvailability(): Promise<boolean> {
  if (!supabase) {
    supabaseAvailable = false;
    return false;
  }

  const now = Date.now();
  if (now - lastSupabaseCheck < SUPABASE_CHECK_INTERVAL) {
    return supabaseAvailable;
  }

  try {
    // 简单查询测试连接
    const { error } = await supabase
      .from('student_profiles')
      .select('student_id')
      .limit(1);

    supabaseAvailable = !error;
    lastSupabaseCheck = now;

    if (supabaseAvailable) {
      // Supabase 恢复，尝试同步待同步数据
      await syncPendingData();
    }

    return supabaseAvailable;
  } catch {
    supabaseAvailable = false;
    lastSupabaseCheck = now;
    return false;
  }
}

/**
 * 同步待同步数据到 Supabase
 */
async function syncPendingData(): Promise<void> {
  if (!supabase) return;

  const pending = fallbackStore.getPendingItems();
  if (pending.length === 0) return;

  console.log(`[Memory] Syncing ${pending.length} pending items to Supabase`);

  const syncedIndices: number[] = [];

  for (let i = 0; i < pending.length; i++) {
    const item = pending[i];
    try {
      const { error } = await supabase.from(item.table).upsert(item.data);
      if (!error) {
        syncedIndices.push(i);
      }
    } catch (e) {
      console.warn(`[Memory] Failed to sync item to ${item.table}:`, e);
    }
  }

  if (syncedIndices.length > 0) {
    fallbackStore.markSynced(syncedIndices);
    console.log(`[Memory] Synced ${syncedIndices.length} items`);
  }
}

// ============================================================
// 读取操作
// ============================================================

/**
 * 读取学生记忆
 */
export async function read(params: MemoryReadParams): Promise<Result<MemoryData>> {
  const { studentId, memoryType, limit = 10 } = params;
  const result: MemoryData = {};

  const dbAvailable = await checkSupabaseAvailability();

  try {
    // 读取画像
    if (memoryType === 'profile' || memoryType === 'all') {
      if (dbAvailable && supabase) {
        const { data: profile, error } = await supabase
          .from('student_profiles')
          .select('*')
          .eq('student_id', studentId)
          .single();

        if (!error && profile) {
          result.profile = profile as StudentProfile;
        } else {
          // DB 查询失败，尝试 fallback
          result.profile = fallbackStore.getProfile(studentId);
        }
      } else {
        result.profile = fallbackStore.getProfile(studentId);
      }
    }

    // 读取历史快照
    if (memoryType === 'history' || memoryType === 'all') {
      if (dbAvailable && supabase) {
        const { data: history, error } = await supabase
          .from('learning_snapshots')
          .select('*')
          .eq('student_id', studentId)
          .order('created_at', { ascending: false })
          .limit(limit);

        if (!error) {
          result.history = (history || []) as LearningSnapshot[];
        } else {
          result.history = fallbackStore.getSnapshots(studentId, limit);
        }
      } else {
        result.history = fallbackStore.getSnapshots(studentId, limit);
      }
    }

    // 读取情景记忆
    if (memoryType === 'episodes' || memoryType === 'all') {
      if (dbAvailable && supabase) {
        const { data: episodes, error } = await supabase
          .from('episodic_memories')
          .select('*')
          .eq('student_id', studentId)
          .order('created_at', { ascending: false })
          .limit(limit);

        if (!error) {
          result.episodes = (episodes || []) as EpisodicMemory[];
        } else {
          result.episodes = fallbackStore.getEpisodes(studentId, limit);
        }
      } else {
        result.episodes = fallbackStore.getEpisodes(studentId, limit);
      }
    }

    return ok(result);
  } catch (error) {
    console.error('[Memory] Read error:', error);
    // 全部从 fallback 读取
    return ok({
      profile: fallbackStore.getProfile(studentId),
      history: fallbackStore.getSnapshots(studentId, limit),
      episodes: fallbackStore.getEpisodes(studentId, limit),
    });
  }
}

/**
 * 获取或创建学生画像
 */
export async function getOrCreateProfile(studentId: string): Promise<Result<StudentProfile>> {
  const dbAvailable = await checkSupabaseAvailability();

  // 先检查 fallback 是否有
  const cachedProfile = fallbackStore.getProfile(studentId);

  if (dbAvailable && supabase) {
    try {
      const { data: existing, error } = await supabase
        .from('student_profiles')
        .select('*')
        .eq('student_id', studentId)
        .single();

      if (!error && existing) {
        const profile = existing as StudentProfile;
        // 更新 fallback 缓存
        fallbackStore.setProfile(profile);
        return ok(profile);
      }

      // 不存在，创建新的
      const newProfile = createDefaultProfile(studentId);
      const { data: created, error: insertError } = await supabase
        .from('student_profiles')
        .insert(newProfile)
        .select()
        .single();

      if (!insertError && created) {
        const profile = created as StudentProfile;
        fallbackStore.setProfile(profile);
        return ok(profile);
      }

      // 插入失败，返回默认并保存到 fallback
      fallbackStore.setProfile(newProfile);
      return err(
        insertError?.message || 'Failed to create profile',
        'DB_ERROR',
        newProfile
      );
    } catch (error) {
      const newProfile = cachedProfile || createDefaultProfile(studentId);
      fallbackStore.setProfile(newProfile);
      return err(
        error instanceof Error ? error.message : 'Unknown error',
        'DB_ERROR',
        newProfile
      );
    }
  }

  // Supabase 不可用，使用 fallback
  const profile = cachedProfile || createDefaultProfile(studentId);
  if (!cachedProfile) {
    fallbackStore.setProfile(profile);
  }
  return err('Supabase unavailable', 'DB_UNAVAILABLE', profile);
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
): Promise<Result<void>> {
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
    created_at: new Date().toISOString(),
  };

  const dbAvailable = await checkSupabaseAvailability();

  if (dbAvailable && supabase) {
    try {
      const { error } = await supabase.from('learning_snapshots').insert(snapshot);

      if (error) {
        console.error('[Memory] Failed to save snapshot to DB:', error);
        // 保存到 fallback
        fallbackStore.addSnapshot(snapshot as LearningSnapshot);
        return err(error.message, 'DB_ERROR');
      }

      return ok(undefined);
    } catch (error) {
      fallbackStore.addSnapshot(snapshot as LearningSnapshot);
      return err(
        error instanceof Error ? error.message : 'Unknown error',
        'DB_ERROR'
      );
    }
  }

  // Supabase 不可用，保存到 fallback
  fallbackStore.addSnapshot(snapshot as LearningSnapshot);
  return err('Supabase unavailable, saved to fallback', 'DB_UNAVAILABLE');
}

/**
 * 更新学生画像（增量更新）
 */
export async function updateProfile(
  studentId: string,
  analysis: LearningAnalysis
): Promise<Result<void>> {
  const currentResult = await getOrCreateProfile(studentId);
  const current = unwrapOr(currentResult, createDefaultProfile(studentId));

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

  const updatedProfile: StudentProfile = {
    ...current,
    overall_level: Math.round(newLevel * 10) / 10,
    dimensions: newDimensions,
    preferred_style: analysis.preferredQuestionStyle,
    total_sessions: current.total_sessions + 1,
    recent_trend: trend,
    recent_problem_tags: mergedTags,
    updated_at: new Date().toISOString(),
  };

  // 始终更新 fallback 缓存
  fallbackStore.setProfile(updatedProfile);

  const dbAvailable = await checkSupabaseAvailability();

  if (dbAvailable && supabase) {
    try {
      const { error } = await supabase
        .from('student_profiles')
        .update({
          overall_level: updatedProfile.overall_level,
          dimensions: updatedProfile.dimensions,
          preferred_style: updatedProfile.preferred_style,
          total_sessions: updatedProfile.total_sessions,
          recent_trend: updatedProfile.recent_trend,
          recent_problem_tags: updatedProfile.recent_problem_tags,
          updated_at: updatedProfile.updated_at,
        })
        .eq('student_id', studentId);

      if (error) {
        return err(error.message, 'DB_ERROR');
      }
      return ok(undefined);
    } catch (error) {
      return err(
        error instanceof Error ? error.message : 'Unknown error',
        'DB_ERROR'
      );
    }
  }

  return err('Supabase unavailable, saved to fallback', 'DB_UNAVAILABLE');
}

/**
 * 节点级轻量画像更新（规则驱动，不调 LLM）
 *
 * 每个 checkpoint 精准模式完成后调用。
 * 正确：小幅提升 level + 概念理解维度
 * 错误：不降 level，但记录 knowledge_gap 和 problem_tag
 */
export async function updateProfileFromCheckpoint(
  studentId: string,
  checkpoint: {
    nodeId: string;
    keyConcepts: string[];
    isCorrect: boolean;
    interventionType?: string; // quick_check | trap_alert | final_check
  }
): Promise<Result<void>> {
  const currentResult = await getOrCreateProfile(studentId);
  const current = unwrapOr(currentResult, createDefaultProfile(studentId));

  let updatedProfile: StudentProfile;

  if (checkpoint.isCorrect) {
    // 答对：小幅提升（比完整分析的 α=0.3 轻得多）
    const levelBoost = checkpoint.interventionType === 'trap_alert' ? 2 : 1;
    const newLevel = Math.min(100, current.overall_level + levelBoost);
    const conceptBoost = checkpoint.interventionType === 'trap_alert' ? 2.5 : 1.5;

    // 从 knowledge_gaps 中移除已掌握的概念
    const resolvedGaps = current.knowledge_gaps.filter(
      gap => !checkpoint.keyConcepts.some(c => gap.includes(c))
    );

    updatedProfile = {
      ...current,
      overall_level: Math.round(newLevel * 10) / 10,
      dimensions: {
        ...current.dimensions,
        conceptUnderstanding: Math.min(100,
          current.dimensions.conceptUnderstanding + conceptBoost
        ),
      },
      knowledge_gaps: resolvedGaps,
      recent_trend: calculateTrend(current.overall_level, newLevel),
      updated_at: new Date().toISOString(),
    };
  } else {
    // 答错：不降 level，记录知识盲点
    const newGaps = [
      ...new Set([...current.knowledge_gaps, ...checkpoint.keyConcepts]),
    ].slice(-10);

    // trap_alert 答错 → 标记 "条件遗漏"
    const newTags = checkpoint.interventionType === 'trap_alert'
      ? [...new Set([...current.recent_problem_tags, '条件遗漏'])].slice(-4)
      : current.recent_problem_tags;

    updatedProfile = {
      ...current,
      // level 不降，避免惩罚心态
      knowledge_gaps: newGaps,
      recent_problem_tags: newTags,
      updated_at: new Date().toISOString(),
    };
  }

  // 写入 fallback 缓存
  fallbackStore.setProfile(updatedProfile);

  // 写入 Supabase
  const dbAvailable = await checkSupabaseAvailability();
  if (dbAvailable && supabase) {
    try {
      const { error } = await supabase
        .from('student_profiles')
        .update({
          overall_level: updatedProfile.overall_level,
          dimensions: updatedProfile.dimensions,
          knowledge_gaps: updatedProfile.knowledge_gaps,
          recent_problem_tags: updatedProfile.recent_problem_tags,
          recent_trend: updatedProfile.recent_trend,
          updated_at: updatedProfile.updated_at,
        })
        .eq('student_id', studentId);

      if (error) {
        console.warn('[Memory] Checkpoint profile update DB error:', error.message);
        return err(error.message, 'DB_ERROR');
      }
    } catch (error) {
      console.warn('[Memory] Checkpoint profile update exception:', error);
      return err(
        error instanceof Error ? error.message : 'Unknown error',
        'DB_ERROR'
      );
    }
  }

  console.log(
    `[Memory] Checkpoint profile updated: student=${studentId} node=${checkpoint.nodeId} correct=${checkpoint.isCorrect} level=${updatedProfile.overall_level}`
  );
  return ok(undefined);
}

/**
 * 保存情景记忆（使用关键词替代 embedding）
 */
export async function saveEpisode(
  studentId: string,
  event: string,
  videoId?: string,
  importance = 3
): Promise<Result<void>> {
  const keywords = extractKeywords(event);

  const episode: Partial<EpisodicMemory> = {
    student_id: studentId,
    video_id: videoId,
    event,
    keywords,
    importance,
    created_at: new Date().toISOString(),
  } as any;

  const dbAvailable = await checkSupabaseAvailability();

  if (dbAvailable && supabase) {
    try {
      const { error } = await supabase.from('episodic_memories').insert(episode);

      if (error) {
        fallbackStore.addEpisode(episode as EpisodicMemory);
        return err(error.message, 'DB_ERROR');
      }
      return ok(undefined);
    } catch (error) {
      fallbackStore.addEpisode(episode as EpisodicMemory);
      return err(
        error instanceof Error ? error.message : 'Unknown error',
        'DB_ERROR'
      );
    }
  }

  fallbackStore.addEpisode(episode as EpisodicMemory);
  return err('Supabase unavailable, saved to fallback', 'DB_UNAVAILABLE');
}

/**
 * 搜索相关情景记忆（基于关键词）
 */
export async function searchEpisodes(
  studentId: string,
  query: string,
  limit = 5
): Promise<Result<EpisodicMemory[]>> {
  const searchKeywords = extractKeywords(query);
  const dbAvailable = await checkSupabaseAvailability();

  if (dbAvailable && supabase) {
    try {
      if (searchKeywords.length === 0) {
        const { data, error } = await supabase
          .from('episodic_memories')
          .select('*')
          .eq('student_id', studentId)
          .order('created_at', { ascending: false })
          .limit(limit);

        if (error) {
          return ok(fallbackStore.searchEpisodes(studentId, searchKeywords, limit));
        }
        return ok(data || []);
      }

      const { data, error } = await supabase.rpc('search_episodic_memories_by_keywords', {
        target_student_id: studentId,
        search_keywords: searchKeywords,
        match_count: limit,
      });

      if (error) {
        return ok(fallbackStore.searchEpisodes(studentId, searchKeywords, limit));
      }
      return ok(data || []);
    } catch (error) {
      return ok(fallbackStore.searchEpisodes(studentId, searchKeywords, limit));
    }
  }

  return ok(fallbackStore.searchEpisodes(studentId, searchKeywords, limit));
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
}): Promise<Result<void>> {
  const dbLog = {
    student_id: log.studentId,
    video_id: log.videoId,
    session_id: log.sessionId,
    messages: log.messages,
    total_duration_seconds: log.totalDuration,
    silence_count: log.silenceCount,
    active_question_count: log.activeQuestionCount,
    checkpoint_responses: log.checkpointResponses,
  };

  const dbAvailable = await checkSupabaseAvailability();

  if (dbAvailable && supabase) {
    try {
      const { error } = await supabase.from('conversation_logs').insert(dbLog);

      if (error) {
        fallbackStore.addConversationLog(log as any);
        return err(error.message, 'DB_ERROR');
      }
      return ok(undefined);
    } catch (error) {
      fallbackStore.addConversationLog(log as any);
      return err(
        error instanceof Error ? error.message : 'Unknown error',
        'DB_ERROR'
      );
    }
  }

  fallbackStore.addConversationLog(log as any);
  return err('Supabase unavailable, saved to fallback', 'DB_UNAVAILABLE');
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

  return found.slice(0, 10);
}

/**
 * 获取 fallback 存储状态（用于调试）
 */
export function getFallbackStats() {
  return {
    ...fallbackStore.getStats(),
    supabaseAvailable,
  };
}

/**
 * 手动触发同步
 */
export async function manualSync(): Promise<{ synced: number }> {
  if (!supabase) {
    return { synced: 0 };
  }

  await syncPendingData();
  return { synced: fallbackStore.getPendingItems().filter(i => i.synced).length };
}

// 导出
export const memory = {
  read,
  getOrCreateProfile,
  saveSnapshot,
  updateProfile,
  updateProfileFromCheckpoint,
  saveEpisode,
  searchEpisodes,
  saveConversationLog,
  getFallbackStats,
  manualSync,
};

export default memory;
