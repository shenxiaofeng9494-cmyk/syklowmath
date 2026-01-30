import { useState, useEffect, useRef, useCallback } from 'react'
import { VideoNode } from '@/types/database'

/**
 * 必停点介入状态
 */
export interface CheckpointInterventionState {
  isIntervening: boolean
  currentCheckpoint: VideoNode | null
  silenceTimer: NodeJS.Timeout | null
}

/**
 * 必停点介入Hook
 * 监听视频播放到必停点节点结束，如果学生沉默则触发AI主动介入
 */
export function useCheckpointIntervention({
  nodes,
  currentTime,
  isPlaying,
  onIntervention
}: {
  nodes: VideoNode[]
  currentTime: number
  isPlaying: boolean
  onIntervention: (checkpoint: VideoNode) => void
}) {
  const [state, setState] = useState<CheckpointInterventionState>({
    isIntervening: false,
    currentCheckpoint: null,
    silenceTimer: null
  })

  const lastCheckedNodeRef = useRef<string | null>(null)
  const hasUserSpokenRef = useRef<boolean>(false)
  // 防止在 0-5 秒内重复清除 sessionStorage
  const hasResetOnRestartRef = useRef<boolean>(false)

  // 使用 sessionStorage 持久化已触发的节点ID（按视频ID分组）
  const getStorageKey = () => {
    // 从第一个节点获取 video_id，如果没有则使用默认值
    const videoId = nodes.length > 0 && nodes[0].video_id ? nodes[0].video_id : 'default'
    return `checkpoint_triggered_nodes_${videoId}`
  }

  const getTriggeredNodes = (): Set<string> => {
    if (typeof window === 'undefined') return new Set()
    try {
      const key = getStorageKey()
      const stored = sessionStorage.getItem(key)
      return stored ? new Set(JSON.parse(stored)) : new Set()
    } catch {
      return new Set()
    }
  }

  const saveTriggeredNode = (nodeId: string) => {
    if (typeof window === 'undefined') return
    try {
      const key = getStorageKey()
      const triggered = getTriggeredNodes()
      triggered.add(nodeId)
      sessionStorage.setItem(key, JSON.stringify(Array.from(triggered)))
    } catch (error) {
      console.error('[CheckpointIntervention] 保存触发记录失败:', error)
    }
  }

  // 重置用户说话标记
  const resetUserSpoken = useCallback(() => {
    hasUserSpokenRef.current = false
  }, [])

  // 标记用户已说话（从外部调用）
  const markUserSpoken = useCallback(() => {
    hasUserSpokenRef.current = true

    // 如果有沉默计时器，清除它
    if (state.silenceTimer) {
      clearTimeout(state.silenceTimer)
      setState(prev => ({ ...prev, silenceTimer: null }))
    }
  }, [state.silenceTimer])

  // 【方案二】监听视频重启：当视频从头播放时清除所有介入点记录
  useEffect(() => {
    // 当视频播放到开头（< 5秒）时，清除所有触发记录
    if (isPlaying && currentTime < 5 && !hasResetOnRestartRef.current) {
      console.log('[CheckpointIntervention] 检测到视频重启，清除所有介入点记录')

      // 清除 sessionStorage
      if (typeof window !== 'undefined') {
        const key = getStorageKey()
        sessionStorage.removeItem(key)
      }

      // 标记已清除，防止在 0-5 秒内重复清除
      hasResetOnRestartRef.current = true
    }

    // 当视频播放超过 10 秒后，重置标记（允许下次重启时再次清除）
    if (currentTime > 10) {
      hasResetOnRestartRef.current = false
    }
  }, [currentTime, isPlaying, getStorageKey])

  // 监听视频播放进度
  useEffect(() => {
    if (!isPlaying || nodes.length === 0) {
      return
    }

    // 找到当前播放的节点
    const currentNode = nodes.find(
      node => currentTime >= node.start_time && currentTime < node.end_time
    )

    if (!currentNode) {
      return
    }

    // 检查是否是必停点
    if (!currentNode.is_critical_checkpoint) {
      return
    }

    // 【方案五】检查是否已经触发过这个节点
    // 只有当前正在介入同一个节点时，才阻止重复触发
    const triggeredNodes = getTriggeredNodes()
    const isCurrentlyIntervening = state.isIntervening && state.currentCheckpoint?.id === currentNode.id

    if (triggeredNodes.has(currentNode.id) && isCurrentlyIntervening) {
      console.log(`[CheckpointIntervention] 节点 "${currentNode.title}" 正在介入中，阻止重复触发`)
      return
    }

    // 检查是否接近节点结束（最后0.5秒）
    const timeUntilEnd = currentNode.end_time - currentTime
    if (timeUntilEnd > 0.5) {
      return
    }

    // 标记已触发（保存到 sessionStorage，确保刷新页面后也不会再次触发）
    saveTriggeredNode(currentNode.id)
    lastCheckedNodeRef.current = currentNode.id

    console.log(`[CheckpointIntervention] 节点 "${currentNode.title}" 结束，立即触发AI介入（首次）`)

    // 立即触发介入（不等待沉默）
    setState({
      isIntervening: true,
      currentCheckpoint: currentNode,
      silenceTimer: null
    })

    onIntervention(currentNode)
  }, [currentTime, isPlaying, nodes, onIntervention])

  // 结束介入
  const endIntervention = useCallback(() => {
    // 【方案五】清除当前介入节点的 sessionStorage 记录
    // 这样用户 seek 回去时可以再次触发
    if (state.currentCheckpoint && typeof window !== 'undefined') {
      const key = getStorageKey()
      const triggered = getTriggeredNodes()
      triggered.delete(state.currentCheckpoint.id)
      sessionStorage.setItem(key, JSON.stringify(Array.from(triggered)))
      console.log(`[CheckpointIntervention] 介入结束，清除节点 "${state.currentCheckpoint.title}" 的触发记录`)
    }

    setState({
      isIntervening: false,
      currentCheckpoint: null,
      silenceTimer: null
    })
  }, [state.currentCheckpoint, getStorageKey, getTriggeredNodes])

  // 清理计时器
  useEffect(() => {
    return () => {
      if (state.silenceTimer) {
        clearTimeout(state.silenceTimer)
      }
    }
  }, [state.silenceTimer])

  return {
    isIntervening: state.isIntervening,
    currentCheckpoint: state.currentCheckpoint,
    markUserSpoken,
    resetUserSpoken,
    endIntervention
  }
}
