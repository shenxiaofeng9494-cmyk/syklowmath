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
  const getStorageKey = useCallback(() => {
    // 从第一个节点获取 video_id，如果没有则使用默认值
    const videoId = nodes.length > 0 && nodes[0].video_id ? nodes[0].video_id : 'default'
    return `checkpoint_triggered_nodes_${videoId}`
  }, [nodes])

  const getTriggeredNodes = useCallback((): Set<string> => {
    if (typeof window === 'undefined') return new Set()
    try {
      const key = getStorageKey()
      const stored = sessionStorage.getItem(key)
      return stored ? new Set(JSON.parse(stored)) : new Set()
    } catch {
      return new Set()
    }
  }, [getStorageKey])

  const saveTriggeredNode = useCallback((nodeId: string) => {
    if (typeof window === 'undefined') return
    try {
      const key = getStorageKey()
      const triggered = getTriggeredNodes()
      triggered.add(nodeId)
      sessionStorage.setItem(key, JSON.stringify(Array.from(triggered)))
    } catch (error) {
      console.error('[CheckpointIntervention] 保存触发记录失败:', error)
    }
  }, [getStorageKey, getTriggeredNodes])

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

  // 追踪用户是否 seek 到了节点之前（用于重新触发）
  const lastCurrentTimeRef = useRef<number>(0)

  // 监听视频播放进度
  useEffect(() => {
    if (!isPlaying || nodes.length === 0) {
      return
    }

    // 每10秒打印一次调试信息
    if (Math.floor(currentTime) % 10 === 0 && Math.floor(currentTime) !== Math.floor(lastCurrentTimeRef.current)) {
      console.log(`[CheckpointIntervention] 当前时间: ${currentTime.toFixed(1)}s, 节点数: ${nodes.length}`)
    }

    // 检测用户是否 seek 到了更早的位置（倒退）
    const isSeekingBack = currentTime < lastCurrentTimeRef.current - 1 // 允许1秒的抖动
    lastCurrentTimeRef.current = currentTime

    // 找到当前播放的节点
    const currentNode = nodes.find(
      node => currentTime >= node.start_time && currentTime < node.end_time
    )

    if (!currentNode) {
      return
    }

    // 检查是否是必停点
    if (!currentNode.is_critical_checkpoint) {
      // 每5秒打印一次（避免日志太多）
      if (Math.floor(currentTime) % 5 === 0 && Math.floor(currentTime) !== Math.floor(lastCurrentTimeRef.current - 1)) {
        console.log(`[CheckpointIntervention] 节点 "${currentNode.title}" 不是必停点`)
      }
      return
    }

    // 打印必停点检测信息
    const timeUntilEndPreview = currentNode.end_time - currentTime
    console.log(`[CheckpointIntervention] ⭐ 检测到必停点节点 "${currentNode.title}", 距离结束: ${timeUntilEndPreview.toFixed(1)}s`)

    // 如果用户 seek 回到了节点之前，清除该节点的触发记录
    if (isSeekingBack) {
      const triggeredNodes = getTriggeredNodes()
      if (triggeredNodes.has(currentNode.id)) {
        console.log(`[CheckpointIntervention] 检测到用户 seek 回到节点 "${currentNode.title}" 之前，清除触发记录`)
        triggeredNodes.delete(currentNode.id)
        if (typeof window !== 'undefined') {
          const key = getStorageKey()
          sessionStorage.setItem(key, JSON.stringify(Array.from(triggeredNodes)))
        }
      }
    }

    // 检查是否正在介入同一个节点（防止重复触发）
    const isCurrentlyIntervening = state.isIntervening && state.currentCheckpoint?.id === currentNode.id
    if (isCurrentlyIntervening) {
      console.log(`[CheckpointIntervention] 节点 "${currentNode.title}" 正在介入中，阻止重复触发`)
      return
    }

    // 检查是否已经触发过（sessionStorage 中有记录）
    const triggeredNodes = getTriggeredNodes()
    if (triggeredNodes.has(currentNode.id)) {
      // 只在调试时打印，避免日志过多
      return
    }

    // 检查是否接近节点结束（最后1秒，放宽窗口以确保不会错过）
    const timeUntilEnd = currentNode.end_time - currentTime
    if (timeUntilEnd > 1.0) {
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
  }, [currentTime, isPlaying, nodes, onIntervention, getStorageKey, getTriggeredNodes, saveTriggeredNode, state.isIntervening, state.currentCheckpoint?.id])

  // 结束介入
  // keepTriggeredRecord: 是否保留触发记录（默认 false，清除记录以便 seek 回去时可以再次触发）
  // 当用户按播放键继续时应传 true，防止立即再次触发
  const endIntervention = useCallback((keepTriggeredRecord: boolean = false) => {
    // 只有当 keepTriggeredRecord 为 false 时才清除记录
    // 这样用户 seek 回去时可以再次触发，但按播放键继续时不会重复触发
    if (!keepTriggeredRecord && state.currentCheckpoint && typeof window !== 'undefined') {
      const key = getStorageKey()
      const triggered = getTriggeredNodes()
      triggered.delete(state.currentCheckpoint.id)
      sessionStorage.setItem(key, JSON.stringify(Array.from(triggered)))
      console.log(`[CheckpointIntervention] 介入结束，清除节点 "${state.currentCheckpoint.title}" 的触发记录`)
    } else if (keepTriggeredRecord && state.currentCheckpoint) {
      console.log(`[CheckpointIntervention] 介入结束，保留节点 "${state.currentCheckpoint.title}" 的触发记录（防止重复触发）`)
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
