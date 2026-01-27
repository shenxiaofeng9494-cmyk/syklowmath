'use client'

import { useRef, useCallback } from 'react'

export interface NodeData {
  id: string
  title: string
  start_time: number
  end_time: number
  node_type: string
}

interface NodeSegmentProps {
  node: NodeData
  duration: number
  isSelected: boolean
  hasError: boolean
  onSelect: () => void
  onTimeChange: (startTime: number, endTime: number) => void
}

// 深色主题配色：20% 透明度背景 + 亮色边框 + 400 级别文字
const NODE_TYPE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  intro: { bg: 'bg-blue-500/20', border: 'border-blue-500', text: 'text-blue-400' },
  concept: { bg: 'bg-emerald-500/20', border: 'border-emerald-500', text: 'text-emerald-400' },
  method: { bg: 'bg-violet-500/20', border: 'border-violet-500', text: 'text-violet-400' },
  example: { bg: 'bg-amber-500/20', border: 'border-amber-500', text: 'text-amber-400' },
  pitfall: { bg: 'bg-red-500/20', border: 'border-red-500', text: 'text-red-400' },
  summary: { bg: 'bg-teal-500/20', border: 'border-teal-500', text: 'text-teal-400' },
  transition: { bg: 'bg-gray-500/20', border: 'border-gray-500', text: 'text-gray-400' },
  other: { bg: 'bg-slate-500/20', border: 'border-slate-500', text: 'text-slate-400' },
}

export function NodeSegment({
  node,
  duration,
  isSelected,
  hasError,
  onSelect,
  onTimeChange,
}: NodeSegmentProps) {
  const segmentRef = useRef<HTMLDivElement>(null)
  const isDragging = useRef<'left' | 'right' | 'move' | null>(null)
  const dragStartX = useRef(0)
  const dragStartTimes = useRef({ start: 0, end: 0 })

  const left = (node.start_time / duration) * 100
  const width = ((node.end_time - node.start_time) / duration) * 100

  const colors = NODE_TYPE_COLORS[node.node_type] || NODE_TYPE_COLORS.other

  const handleMouseDown = useCallback(
    (e: React.MouseEvent, type: 'left' | 'right' | 'move') => {
      e.preventDefault()
      e.stopPropagation()
      isDragging.current = type
      dragStartX.current = e.clientX
      dragStartTimes.current = { start: node.start_time, end: node.end_time }

      const handleMouseMove = (moveEvent: MouseEvent) => {
        if (!isDragging.current || !segmentRef.current) return

        const parent = segmentRef.current.parentElement
        if (!parent) return

        const parentRect = parent.getBoundingClientRect()
        const deltaX = moveEvent.clientX - dragStartX.current
        const deltaTime = (deltaX / parentRect.width) * duration

        let newStart = dragStartTimes.current.start
        let newEnd = dragStartTimes.current.end

        if (isDragging.current === 'left') {
          newStart = Math.max(0, Math.round(dragStartTimes.current.start + deltaTime))
          newStart = Math.min(newStart, newEnd - 1) // 至少1秒
        } else if (isDragging.current === 'right') {
          newEnd = Math.min(duration, Math.round(dragStartTimes.current.end + deltaTime))
          newEnd = Math.max(newEnd, newStart + 1) // 至少1秒
        } else if (isDragging.current === 'move') {
          const nodeDuration = dragStartTimes.current.end - dragStartTimes.current.start
          newStart = Math.round(dragStartTimes.current.start + deltaTime)
          newStart = Math.max(0, Math.min(newStart, duration - nodeDuration))
          newEnd = newStart + nodeDuration
        }

        onTimeChange(newStart, newEnd)
      }

      const handleMouseUp = () => {
        isDragging.current = null
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }

      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    },
    [node.start_time, node.end_time, duration, onTimeChange]
  )

  return (
    <div
      ref={segmentRef}
      className={`absolute top-1 bottom-1 rounded cursor-pointer transition-all border ${colors.bg} ${colors.border} hover:brightness-125 ${
        isSelected ? 'ring-2 ring-white/50 ring-offset-1 ring-offset-zinc-900' : ''
      } ${hasError ? 'ring-2 ring-red-500' : ''}`}
      style={{
        left: `${left}%`,
        width: `${Math.max(width, 0.5)}%`,
      }}
      onClick={onSelect}
    >
      {/* 左拖拽手柄 */}
      <div
        className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-white/10 rounded-l"
        onMouseDown={(e) => handleMouseDown(e, 'left')}
      />

      {/* 中间区域 - 可拖动整体 */}
      <div
        className="absolute left-2 right-2 top-0 bottom-0 cursor-move overflow-hidden flex items-center justify-center"
        onMouseDown={(e) => handleMouseDown(e, 'move')}
      >
        <span className={`text-sm font-medium truncate px-1 ${colors.text}`}>
          {node.title}
        </span>
      </div>

      {/* 右拖拽手柄 */}
      <div
        className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-white/10 rounded-r"
        onMouseDown={(e) => handleMouseDown(e, 'right')}
      />
    </div>
  )
}
