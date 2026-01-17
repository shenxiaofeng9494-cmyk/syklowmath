import { supabase } from './supabase'
import { generateQueryEmbedding } from './embedding'
import type { VideoNode, VideoNodeSearchResult } from '@/types/database'

/**
 * 通过向量相似度搜索视频节点
 */
export async function searchNodes(
  videoId: string,
  query: string,
  limit = 3
): Promise<VideoNodeSearchResult[]> {
  // 1. 生成查询向量
  const queryEmbedding = await generateQueryEmbedding(query)

  // 2. 调用 Supabase RPC 函数进行向量搜索
  const { data, error } = await supabase.rpc('search_video_nodes', {
    query_embedding: queryEmbedding,
    target_video_id: videoId,
    match_threshold: 0.5,
    match_count: limit,
  })

  if (error) {
    console.error('Search nodes error:', error)
    throw new Error(`Failed to search nodes: ${error.message}`)
  }

  return data as VideoNodeSearchResult[]
}

/**
 * 根据关键词搜索视频节点（精确匹配）
 */
export async function searchNodesByKeywords(
  videoId: string,
  keywords: string[],
  limit = 3
): Promise<VideoNode[]> {
  const { data, error } = await supabase
    .from('video_nodes')
    .select('*')
    .eq('video_id', videoId)
    .overlaps('key_concepts', keywords)
    .order('order', { ascending: true })
    .limit(limit)

  if (error) {
    console.error('Search by keywords error:', error)
    throw new Error(`Failed to search by keywords: ${error.message}`)
  }

  return data
}

/**
 * 混合搜索：结合向量相似度和关键词匹配
 */
export async function hybridSearch(
  videoId: string,
  query: string,
  keywords: string[] = [],
  limit = 3
): Promise<VideoNodeSearchResult[]> {
  // 并行执行向量搜索和关键词搜索
  const [semanticResults, keywordResults] = await Promise.all([
    searchNodes(videoId, query, limit),
    keywords.length > 0 ? searchNodesByKeywords(videoId, keywords, limit) : Promise.resolve([]),
  ])

  // 合并结果并去重
  const resultMap = new Map<string, VideoNodeSearchResult>()

  // 添加语义搜索结果（权重 0.7）
  for (const node of semanticResults) {
    resultMap.set(node.id, {
      ...node,
      similarity: node.similarity * 0.7,
    })
  }

  // 添加关键词搜索结果（权重 0.3）
  for (const node of keywordResults) {
    const existing = resultMap.get(node.id)
    if (existing) {
      // 如果已存在，增加权重
      existing.similarity += 0.3
    } else {
      // 从 VideoNode 转换为 VideoNodeSearchResult，移除 embedding 字段
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { embedding: _, ...nodeWithoutEmbedding } = node
      resultMap.set(node.id, {
        ...nodeWithoutEmbedding,
        similarity: 0.3,
      })
    }
  }

  // 按相似度排序并返回前 limit 个
  return Array.from(resultMap.values())
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit)
}

/**
 * 根据播放时间获取当前节点
 */
export async function getNodeByTime(
  videoId: string,
  currentTime: number
): Promise<VideoNode | null> {
  // 将浮点数时间转换为整数（数据库字段是整数类型）
  const timeInt = Math.floor(currentTime)

  const { data, error } = await supabase
    .from('video_nodes')
    .select('*')
    .eq('video_id', videoId)
    .lte('start_time', timeInt)
    .gte('end_time', timeInt)
    .single()

  if (error) {
    // PGRST116 表示没有找到记录，不是真正的错误
    if (error.code === 'PGRST116') {
      return null
    }
    console.error('Get node by time error:', error)
    return null
  }

  return data
}

/**
 * 获取视频的所有节点列表
 */
export async function getAllNodes(videoId: string): Promise<VideoNode[]> {
  const { data, error } = await supabase
    .from('video_nodes')
    .select('*')
    .eq('video_id', videoId)
    .order('order', { ascending: true })

  if (error) {
    console.error('Get all nodes error:', error)
    throw new Error(`Failed to get nodes: ${error.message}`)
  }

  return data
}

/**
 * 获取节点的上下文（当前节点 + 相邻节点）
 */
export async function getNodeContext(
  videoId: string,
  nodeOrder: number
): Promise<{
  previous: VideoNode | null
  current: VideoNode | null
  next: VideoNode | null
}> {
  const { data, error } = await supabase
    .from('video_nodes')
    .select('*')
    .eq('video_id', videoId)
    .gte('order', nodeOrder - 1)
    .lte('order', nodeOrder + 1)
    .order('order', { ascending: true })

  if (error) {
    console.error('Get node context error:', error)
    throw new Error(`Failed to get node context: ${error.message}`)
  }

  const nodes = (data || []) as VideoNode[]
  const currentIdx = nodes.findIndex((n) => n.order === nodeOrder)

  return {
    previous: currentIdx > 0 ? nodes[currentIdx - 1] : null,
    current: currentIdx >= 0 ? nodes[currentIdx] : null,
    next: currentIdx >= 0 && currentIdx < nodes.length - 1 ? nodes[currentIdx + 1] : null,
  }
}

/**
 * 格式化时间为 MM:SS 格式
 */
export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

/**
 * 组装 RAG 上下文用于 AI 系统提示
 */
export function assembleRAGContext(
  currentNode: VideoNode | null,
  relevantNodes: VideoNodeSearchResult[]
): string {
  let context = ''

  if (currentNode) {
    context += `
## 当前播放的知识点

【${currentNode.title}】(${formatTime(currentNode.start_time)} - ${formatTime(currentNode.end_time)})
${currentNode.summary}

详细内容：
${currentNode.transcript || '(无详细内容)'}
`
  }

  if (relevantNodes.length > 0) {
    // 过滤掉当前节点
    const filtered = relevantNodes.filter((n) => n.id !== currentNode?.id)
    if (filtered.length > 0) {
      context += `
## 相关知识点

以下是本节课中与学生问题可能相关的其他部分：
`
      for (const node of filtered) {
        context += `
【${node.title}】(${formatTime(node.start_time)} - ${formatTime(node.end_time)})
${node.summary}
关键词: ${node.key_concepts.join(', ')}
`
      }
    }
  }

  return context
}
