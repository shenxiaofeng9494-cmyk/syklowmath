// Supabase 数据库类型定义

export interface Database {
  public: {
    Tables: {
      videos: {
        Row: {
          id: string
          title: string
          description: string | null
          duration: number
          video_url: string
          teacher: string | null
          node_count: number
          status: 'pending' | 'processing' | 'ready' | 'error'
          created_at: string
          processed_at: string | null
        }
        Insert: {
          id: string
          title: string
          description?: string | null
          duration: number
          video_url: string
          teacher?: string | null
          node_count?: number
          status?: 'pending' | 'processing' | 'ready' | 'error'
          processed_at?: string | null
        }
        Update: Partial<Database['public']['Tables']['videos']['Insert']>
      }
      video_nodes: {
        Row: {
          id: string
          video_id: string
          order: number
          start_time: number
          end_time: number
          title: string
          summary: string
          key_concepts: string[]
          transcript: string | null
          embedding: number[] | null
          created_at: string
          // V1 新字段
          boundary_confidence: number
          boundary_signals: string[]
          boundary_reason: string | null
          node_type: 'intro' | 'concept' | 'method' | 'example' | 'pitfall' | 'summary' | 'transition' | 'other' | null
          version: number
          created_by: 'auto' | 'human'
        }
        Insert: {
          id: string
          video_id: string
          order: number
          start_time: number
          end_time: number
          title: string
          summary: string
          key_concepts?: string[]
          transcript?: string | null
          embedding?: number[] | null
          // V1 新字段
          boundary_confidence?: number
          boundary_signals?: string[]
          boundary_reason?: string | null
          node_type?: 'concept' | 'method' | 'example' | 'summary' | 'transition' | null
          version?: number
          created_by?: 'auto' | 'human'
        }
        Update: Partial<Database['public']['Tables']['video_nodes']['Insert']>
      }
    }
    Functions: {
      search_video_nodes: {
        Args: {
          query_embedding: number[]
          target_video_id: string
          match_threshold?: number
          match_count?: number
        }
        Returns: Array<{
          id: string
          video_id: string
          order: number
          start_time: number
          end_time: number
          title: string
          summary: string
          key_concepts: string[]
          transcript: string | null
          similarity: number
        }>
      }
    }
  }
}

// 便捷类型导出
export type Video = Database['public']['Tables']['videos']['Row']
export type VideoInsert = Database['public']['Tables']['videos']['Insert']
export type VideoUpdate = Database['public']['Tables']['videos']['Update']

export type VideoNode = Database['public']['Tables']['video_nodes']['Row']
export type VideoNodeInsert = Database['public']['Tables']['video_nodes']['Insert']
export type VideoNodeUpdate = Database['public']['Tables']['video_nodes']['Update']

// 检索结果类型
export interface VideoNodeSearchResult extends Omit<VideoNode, 'embedding'> {
  similarity: number
}

// 游戏类型
export type GameType =
  | 'parameter-slider'
  | 'drag-match'
  | 'number-line'
  | 'coordinate-plot'
  | 'equation-balance'
  | 'geometry-construct'
  | 'sequence-puzzle'
  | 'fraction-visual'
  | 'graph-transform'
  | 'custom'

export type GameDifficulty = 'easy' | 'medium' | 'hard'

// 视频游戏表类型
export interface VideoGame {
  id: string
  video_id: string
  node_id: string
  title: string
  description: string
  game_type: GameType
  difficulty: GameDifficulty
  math_concepts: string[]
  learning_objectives: string[]
  component_code: string
  instructions: string
  hints: string[]
  estimated_play_time: number
  agent_model: string
  generation_time_ms: number
  created_at: string
  updated_at: string
}

export type VideoGameInsert = Omit<VideoGame, 'created_at' | 'updated_at'>
export type VideoGameUpdate = Partial<VideoGameInsert>
