// ============================================================
// 内存 Fallback Store
// 当 Supabase 不可用时，数据暂存在内存和 localStorage
// Supabase 恢复后自动同步
// ============================================================

import type {
  StudentProfile,
  LearningSnapshot,
  EpisodicMemory,
  ConversationLog,
} from '../types';

// 待同步数据项
interface PendingItem<T> {
  data: T;
  timestamp: number;
  synced: boolean;
  table: string;
}

// 内存存储
class InMemoryFallbackStore {
  private profiles = new Map<string, StudentProfile>();
  private snapshots = new Map<string, LearningSnapshot[]>();
  private episodes = new Map<string, EpisodicMemory[]>();
  private conversationLogs: ConversationLog[] = [];

  // 待同步队列
  private pendingSync: PendingItem<any>[] = [];

  // localStorage key
  private STORAGE_KEY = 'v2_learning_fallback';

  constructor() {
    // 在客户端恢复 localStorage 数据
    if (typeof window !== 'undefined') {
      this.loadFromLocalStorage();
    }
  }

  // ============================================================
  // Profile 操作
  // ============================================================

  getProfile(studentId: string): StudentProfile | null {
    return this.profiles.get(studentId) || null;
  }

  setProfile(profile: StudentProfile): void {
    this.profiles.set(profile.student_id, profile);
    this.addToPending(profile, 'student_profiles');
    this.saveToLocalStorage();
  }

  // ============================================================
  // Snapshot 操作
  // ============================================================

  getSnapshots(studentId: string, limit = 10): LearningSnapshot[] {
    const all = this.snapshots.get(studentId) || [];
    return all.slice(0, limit);
  }

  addSnapshot(snapshot: LearningSnapshot): void {
    const studentId = snapshot.student_id;
    const existing = this.snapshots.get(studentId) || [];
    existing.unshift(snapshot); // 最新的在前面
    this.snapshots.set(studentId, existing.slice(0, 20)); // 最多保留20个
    this.addToPending(snapshot, 'learning_snapshots');
    this.saveToLocalStorage();
  }

  // ============================================================
  // Episode 操作
  // ============================================================

  getEpisodes(studentId: string, limit = 10): EpisodicMemory[] {
    const all = this.episodes.get(studentId) || [];
    return all.slice(0, limit);
  }

  addEpisode(episode: EpisodicMemory): void {
    const studentId = episode.student_id;
    const existing = this.episodes.get(studentId) || [];
    existing.unshift(episode);
    this.episodes.set(studentId, existing.slice(0, 50)); // 最多保留50个
    this.addToPending(episode, 'episodic_memories');
    this.saveToLocalStorage();
  }

  searchEpisodes(studentId: string, keywords: string[], limit = 5): EpisodicMemory[] {
    const all = this.episodes.get(studentId) || [];
    if (keywords.length === 0) {
      return all.slice(0, limit);
    }

    // 简单的关键词匹配
    const matched = all.filter(ep =>
      keywords.some(kw => ep.event.includes(kw))
    );
    return matched.slice(0, limit);
  }

  // ============================================================
  // Conversation Log 操作
  // ============================================================

  addConversationLog(log: ConversationLog): void {
    this.conversationLogs.push(log);
    if (this.conversationLogs.length > 100) {
      this.conversationLogs = this.conversationLogs.slice(-100);
    }
    this.addToPending(log, 'conversation_logs');
    this.saveToLocalStorage();
  }

  // ============================================================
  // 同步相关
  // ============================================================

  private addToPending(data: any, table: string): void {
    this.pendingSync.push({
      data,
      timestamp: Date.now(),
      synced: false,
      table,
    });
  }

  /**
   * 获取待同步的数据
   */
  getPendingItems(): PendingItem<any>[] {
    return this.pendingSync.filter(item => !item.synced);
  }

  /**
   * 标记已同步
   */
  markSynced(indices: number[]): void {
    for (const i of indices) {
      if (this.pendingSync[i]) {
        this.pendingSync[i].synced = true;
      }
    }
    // 清理已同步超过1小时的数据
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    this.pendingSync = this.pendingSync.filter(
      item => !item.synced || item.timestamp > oneHourAgo
    );
    this.saveToLocalStorage();
  }

  /**
   * 清除所有待同步数据（同步成功后调用）
   */
  clearSyncedItems(): void {
    this.pendingSync = this.pendingSync.filter(item => !item.synced);
    this.saveToLocalStorage();
  }

  // ============================================================
  // localStorage 持久化
  // ============================================================

  private saveToLocalStorage(): void {
    if (typeof window === 'undefined') return;

    try {
      const data = {
        profiles: Array.from(this.profiles.entries()),
        snapshots: Array.from(this.snapshots.entries()),
        episodes: Array.from(this.episodes.entries()),
        conversationLogs: this.conversationLogs,
        pendingSync: this.pendingSync,
        savedAt: Date.now(),
      };
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('[FallbackStore] Failed to save to localStorage:', e);
    }
  }

  private loadFromLocalStorage(): void {
    if (typeof window === 'undefined') return;

    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (!stored) return;

      const data = JSON.parse(stored);

      // 检查数据是否过期（7天）
      const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      if (data.savedAt && data.savedAt < sevenDaysAgo) {
        console.log('[FallbackStore] Stored data expired, clearing');
        localStorage.removeItem(this.STORAGE_KEY);
        return;
      }

      if (data.profiles) {
        this.profiles = new Map(data.profiles);
      }
      if (data.snapshots) {
        this.snapshots = new Map(data.snapshots);
      }
      if (data.episodes) {
        this.episodes = new Map(data.episodes);
      }
      if (data.conversationLogs) {
        this.conversationLogs = data.conversationLogs;
      }
      if (data.pendingSync) {
        this.pendingSync = data.pendingSync;
      }

      console.log('[FallbackStore] Loaded from localStorage');
    } catch (e) {
      console.warn('[FallbackStore] Failed to load from localStorage:', e);
    }
  }

  /**
   * 获取存储统计
   */
  getStats(): {
    profileCount: number;
    snapshotCount: number;
    episodeCount: number;
    pendingCount: number;
  } {
    return {
      profileCount: this.profiles.size,
      snapshotCount: Array.from(this.snapshots.values()).reduce((sum, arr) => sum + arr.length, 0),
      episodeCount: Array.from(this.episodes.values()).reduce((sum, arr) => sum + arr.length, 0),
      pendingCount: this.pendingSync.filter(i => !i.synced).length,
    };
  }
}

// 单例导出
export const fallbackStore = new InMemoryFallbackStore();
export default fallbackStore;
