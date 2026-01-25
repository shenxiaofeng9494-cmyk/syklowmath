'use client'

import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { Save, X, AlertCircle, Scissors, Trash2, ChevronLeft, ChevronRight, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { validateNodeTimes } from '@/lib/node-validation'

interface VideoNode {
  id: string
  title: string
  summary: string
  start_time: number
  end_time: number
  node_type: string
  order: number
}

interface VideoNodeTimelineProps {
  videoId: string
  nodes: VideoNode[]
  duration: number
  currentTime: number
  isEditing: boolean
  onSeek: (time: number) => void
  onNodesChange: (nodes: VideoNode[]) => void
  onSave: () => void
  onCancel: () => void
}

const NODE_TYPE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  intro: { bg: 'bg-blue-200', border: 'border-blue-500', text: 'text-blue-800' },
  concept: { bg: 'bg-green-200', border: 'border-green-500', text: 'text-green-800' },
  method: { bg: 'bg-purple-200', border: 'border-purple-500', text: 'text-purple-800' },
  example: { bg: 'bg-orange-200', border: 'border-orange-500', text: 'text-orange-800' },
  pitfall: { bg: 'bg-red-200', border: 'border-red-500', text: 'text-red-800' },
  summary: { bg: 'bg-teal-200', border: 'border-teal-500', text: 'text-teal-800' },
  transition: { bg: 'bg-gray-300', border: 'border-gray-500', text: 'text-gray-800' },
  other: { bg: 'bg-slate-200', border: 'border-slate-500', text: 'text-slate-800' },
}

export function VideoNodeTimeline({
  videoId,
  nodes,
  duration,
  currentTime,
  isEditing,
  onSeek,
  onNodesChange,
  onSave,
  onCancel,
}: VideoNodeTimelineProps) {
  const timelineRef = useRef<HTMLDivElement>(null)
  const [dragState, setDragState] = useState<{
    nodeId: string
    type: 'start' | 'end'
    initialX: number
    initialTime: number
  } | null>(null)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [titleInput, setTitleInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null)

  // 验证节点
  const validation = useMemo(() => {
    return validateNodeTimes(
      nodes.map((n) => ({
        id: n.id,
        start_time: n.start_time,
        end_time: n.end_time,
      })),
      duration
    )
  }, [nodes, duration])

  const errorNodeIds = new Set(validation.errors.map((e) => e.nodeId))

  // 格式化时间
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // 计算时间轴位置
  const getPositionFromTime = (time: number) => {
    return (time / duration) * 100
  }

  const getTimeFromPosition = useCallback((clientX: number) => {
    if (!timelineRef.current) return 0
    const rect = timelineRef.current.getBoundingClientRect()
    const x = clientX - rect.left
    const percent = Math.max(0, Math.min(1, x / rect.width))
    return Math.round(percent * duration)
  }, [duration])

  // 处理拖拽开始
  const handleDragStart = useCallback((
    e: React.MouseEvent,
    nodeId: string,
    type: 'start' | 'end'
  ) => {
    if (!isEditing) return
    e.preventDefault()
    e.stopPropagation()

    const node = nodes.find(n => n.id === nodeId)
    if (!node) return

    setDragState({
      nodeId,
      type,
      initialX: e.clientX,
      initialTime: type === 'start' ? node.start_time : node.end_time,
    })
    setSelectedNodeId(nodeId)
  }, [isEditing, nodes])

  // 处理拖拽
  useEffect(() => {
    if (!dragState) return

    const handleMouseMove = (e: MouseEvent) => {
      const newTime = getTimeFromPosition(e.clientX)
      const node = nodes.find(n => n.id === dragState.nodeId)
      if (!node) return

      // 按 start_time 排序找到当前节点的位置
      const sorted = [...nodes].sort((a, b) => a.start_time - b.start_time)
      const currentIndex = sorted.findIndex(n => n.id === dragState.nodeId)
      const prevNode = currentIndex > 0 ? sorted[currentIndex - 1] : null
      const nextNode = currentIndex < sorted.length - 1 ? sorted[currentIndex + 1] : null

      let newStart = node.start_time
      let newEnd = node.end_time

      if (dragState.type === 'start') {
        // 拖动左边界
        newStart = newTime
        // 不能超过自身右边界（至少保留1秒）
        newStart = Math.min(newStart, node.end_time - 1)
        // 不能小于0（视频开头）
        newStart = Math.max(0, newStart)
        // 不能超过前一个节点的右边界
        if (prevNode) {
          newStart = Math.max(newStart, prevNode.end_time)
        }
      } else {
        // 拖动右边界
        newEnd = newTime
        // 不能小于自身左边界（至少保留1秒）
        newEnd = Math.max(newEnd, node.start_time + 1)
        // 不能超过视频结尾
        newEnd = Math.min(newEnd, duration)
        // 不能超过下一个节点的左边界
        if (nextNode) {
          newEnd = Math.min(newEnd, nextNode.start_time)
        }
      }

      const updatedNodes = nodes.map(n =>
        n.id === dragState.nodeId
          ? { ...n, start_time: newStart, end_time: newEnd }
          : n
      )
      onNodesChange(updatedNodes)
    }

    const handleMouseUp = () => {
      setDragState(null)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [dragState, nodes, duration, getTimeFromPosition, onNodesChange])

  // 点击时间轴跳转
  const handleTimelineClick = useCallback((e: React.MouseEvent) => {
    if (dragState) return
    const target = e.target as HTMLElement
    if (target.closest('[data-node-segment]')) return

    const time = getTimeFromPosition(e.clientX)
    onSeek(time)
  }, [dragState, getTimeFromPosition, onSeek])

  // 选中节点
  const handleSelectNode = useCallback((nodeId: string) => {
    setSelectedNodeId(nodeId)
    setIsEditingTitle(false)
    const node = nodes.find(n => n.id === nodeId)
    if (node) {
      setTitleInput(node.title)
      onSeek(node.start_time)
    }
  }, [nodes, onSeek])

  // 开始编辑标题
  const handleStartEditTitle = useCallback(() => {
    if (!isEditing || !selectedNodeId) return
    const node = nodes.find(n => n.id === selectedNodeId)
    if (node) {
      setTitleInput(node.title)
      setIsEditingTitle(true)
    }
  }, [isEditing, selectedNodeId, nodes])

  // 保存标题
  const handleSaveTitle = useCallback(() => {
    if (!selectedNodeId || !titleInput.trim()) return
    const updatedNodes = nodes.map(n =>
      n.id === selectedNodeId ? { ...n, title: titleInput.trim() } : n
    )
    onNodesChange(updatedNodes)
    setIsEditingTitle(false)
  }, [selectedNodeId, titleInput, nodes, onNodesChange])

  // 删除节点
  const handleDeleteNode = useCallback((nodeId: string) => {
    const updatedNodes = nodes.filter(n => n.id !== nodeId)
    onNodesChange(updatedNodes)
    if (selectedNodeId === nodeId) {
      setSelectedNodeId(null)
      setIsEditingTitle(false)
    }
  }, [nodes, selectedNodeId, onNodesChange])

  // 拆分节点
  const handleSplitNode = useCallback((nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId)
    if (!node) return

    let splitTime = Math.floor(currentTime)
    if (splitTime <= node.start_time || splitTime >= node.end_time) {
      splitTime = Math.floor((node.start_time + node.end_time) / 2)
    }

    if (splitTime <= node.start_time + 1 || splitTime >= node.end_time - 1) {
      setSaveError('节点太短，无法拆分')
      return
    }

    const newId = `node-new-${Date.now()}`
    const newNode: VideoNode = {
      id: newId,
      title: `${node.title} (续)`,
      summary: '',
      start_time: splitTime,
      end_time: node.end_time,
      node_type: node.node_type,
      order: node.order + 0.5,
    }

    const updatedNodes = nodes.map(n =>
      n.id === nodeId ? { ...n, end_time: splitTime } : n
    )

    const allNodes = [...updatedNodes, newNode].sort((a, b) => a.start_time - b.start_time)
    const reorderedNodes = allNodes.map((n, index) => ({ ...n, order: index + 1 }))

    onNodesChange(reorderedNodes)
    setSelectedNodeId(newId)
    setTitleInput(newNode.title)
    setIsEditingTitle(true)
  }, [nodes, currentTime, onNodesChange])

  // 保存
  const handleSave = async () => {
    if (!validation.valid) {
      setSaveError('请先修复验证错误')
      return
    }

    setSaving(true)
    setSaveError(null)

    try {
      const response = await fetch(`/api/video/${videoId}/nodes`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodes: nodes.map((n, index) => ({
            id: n.id,
            start_time: n.start_time,
            end_time: n.end_time,
            title: n.title,
            node_type: n.node_type,
            order: index + 1,
          })),
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || '保存失败')
      }

      onSave()
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const selectedNode = nodes.find(n => n.id === selectedNodeId)
  const hoveredNode = nodes.find(n => n.id === hoveredNodeId)

  // 按 start_time 排序的节点
  const sortedNodes = useMemo(() =>
    [...nodes].sort((a, b) => a.start_time - b.start_time),
    [nodes]
  )

  return (
    <div className="space-y-3">
      {/* 编辑工具栏 */}
      {isEditing && (
        <div className="flex items-center justify-between bg-blue-50 px-3 py-2 rounded-lg">
          <div className="flex items-center gap-3">
            <span className="text-blue-700 font-medium text-sm">编辑模式</span>
            {!validation.valid && (
              <span className="text-red-500 text-sm flex items-center gap-1">
                <AlertCircle className="w-4 h-4" />
                {validation.errors.length} 个错误
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onCancel} disabled={saving}>
              <X className="w-4 h-4 mr-1" />
              取消
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving || !validation.valid}>
              <Save className="w-4 h-4 mr-1" />
              {saving ? '保存中...' : '保存'}
            </Button>
          </div>
        </div>
      )}

      {/* 错误提示 */}
      {saveError && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">
          {saveError}
        </div>
      )}

      {/* 当前时间显示 */}
      <div className="flex items-center justify-between text-sm text-gray-600">
        <span>{formatTime(currentTime)}</span>
        <span>{formatTime(duration)}</span>
      </div>

      {/* 时间轴轨道 - 简洁设计，只显示色块 */}
      <div
        ref={timelineRef}
        className="relative h-10 bg-gray-200 rounded cursor-pointer"
        onClick={handleTimelineClick}
      >
        {/* 节点段 - 只显示色块和序号 */}
        {sortedNodes.map((node, index) => {
          const left = getPositionFromTime(node.start_time)
          const width = getPositionFromTime(node.end_time) - left
          const colors = NODE_TYPE_COLORS[node.node_type] || NODE_TYPE_COLORS.other
          const isSelected = selectedNodeId === node.id
          const isHovered = hoveredNodeId === node.id
          const hasError = errorNodeIds.has(node.id)

          return (
            <div
              key={node.id}
              data-node-segment
              className={`absolute top-1 bottom-1 rounded border-2 transition-all cursor-pointer ${colors.bg} ${colors.border} ${
                isSelected ? 'ring-2 ring-blue-500 ring-offset-1 z-10' : ''
              } ${hasError ? 'ring-2 ring-red-500' : ''} ${isHovered && !isSelected ? 'brightness-95' : ''}`}
              style={{
                left: `${left}%`,
                width: `${Math.max(width, 2)}%`,
              }}
              onClick={(e) => {
                e.stopPropagation()
                handleSelectNode(node.id)
              }}
              onMouseEnter={() => setHoveredNodeId(node.id)}
              onMouseLeave={() => setHoveredNodeId(null)}
              title={node.title}
            >
              {/* 节点序号 */}
              <div className={`absolute inset-0 flex items-center justify-center text-xs font-medium ${colors.text} pointer-events-none`}>
                {width > 3 && (index + 1)}
              </div>

              {/* 左拖拽手柄 */}
              {isEditing && (
                <div
                  className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize flex items-center justify-center hover:bg-black/20 rounded-l"
                  onMouseDown={(e) => handleDragStart(e, node.id, 'start')}
                >
                  <ChevronLeft className="w-3 h-3 text-gray-700" />
                </div>
              )}

              {/* 右拖拽手柄 */}
              {isEditing && (
                <div
                  className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize flex items-center justify-center hover:bg-black/20 rounded-r"
                  onMouseDown={(e) => handleDragStart(e, node.id, 'end')}
                >
                  <ChevronRight className="w-3 h-3 text-gray-700" />
                </div>
              )}
            </div>
          )
        })}

        {/* 播放位置指示线 */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-20 pointer-events-none"
          style={{ left: `${getPositionFromTime(currentTime)}%` }}
        >
          <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[5px] border-r-[5px] border-t-[6px] border-l-transparent border-r-transparent border-t-red-500" />
        </div>
      </div>

      {/* 悬停提示 */}
      {hoveredNode && !selectedNode && (
        <div className="text-sm text-gray-600">
          <span className="font-medium">{hoveredNode.title}</span>
          <span className="ml-2 text-gray-400">
            {formatTime(hoveredNode.start_time)} - {formatTime(hoveredNode.end_time)}
          </span>
        </div>
      )}

      {/* 选中节点编辑面板 */}
      {selectedNode && (
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="flex items-center justify-between gap-3">
            {/* 左侧：标题编辑区 */}
            <div className="flex-1 flex items-center gap-3">
              {isEditing && isEditingTitle ? (
                <Input
                  value={titleInput}
                  onChange={(e) => setTitleInput(e.target.value)}
                  onBlur={handleSaveTitle}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveTitle()
                    if (e.key === 'Escape') setIsEditingTitle(false)
                  }}
                  className="h-8 text-sm font-medium max-w-xs"
                  autoFocus
                />
              ) : (
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{selectedNode.title}</span>
                  {isEditing && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0"
                      onClick={handleStartEditTitle}
                    >
                      <Pencil className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              )}
              <span className="text-gray-500 text-sm">
                {formatTime(selectedNode.start_time)} - {formatTime(selectedNode.end_time)}
                （{selectedNode.end_time - selectedNode.start_time}秒）
              </span>
              <span className={`px-2 py-0.5 rounded text-xs ${NODE_TYPE_COLORS[selectedNode.node_type]?.bg || 'bg-gray-100'}`}>
                {selectedNode.node_type}
              </span>
            </div>

            {/* 右侧：操作按钮 */}
            {isEditing && (
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleSplitNode(selectedNode.id)}
                  disabled={selectedNode.end_time - selectedNode.start_time < 3}
                  title={selectedNode.end_time - selectedNode.start_time < 3 ? '节点太短，无法拆分' : '在当前播放位置拆分节点'}
                >
                  <Scissors className="w-4 h-4 mr-1" />
                  拆分
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-red-500 hover:text-red-700 hover:bg-red-50"
                  onClick={() => handleDeleteNode(selectedNode.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 验证错误列表 */}
      {isEditing && validation.errors.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 px-3 py-2 rounded text-sm">
          <ul className="text-yellow-800 space-y-1">
            {validation.errors.map((error, index) => (
              <li key={index}>
                {nodes.find((n) => n.id === error.nodeId)?.title}: {error.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 操作提示 */}
      {isEditing && (
        <div className="text-xs text-gray-500">
          提示：点击节点选中 | 拖拽边缘调整时间 | 选中后可编辑名称、拆分或删除
        </div>
      )}
    </div>
  )
}
