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

const NODE_TYPE_COLORS: Record<string, string> = {
  intro: 'bg-blue-400',
  concept: 'bg-green-400',
  method: 'bg-purple-400',
  example: 'bg-orange-400',
  pitfall: 'bg-red-400',
  summary: 'bg-teal-400',
  transition: 'bg-gray-400',
  other: 'bg-slate-400',
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

  const bgColor = NODE_TYPE_COLORS[node.node_type] || NODE_TYPE_COLORS.other

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
      className={`absolute top-1 bottom-1 rounded cursor-pointer transition-all ${bgColor} ${
        isSelected ? 'ring-2 ring-blue-600 ring-offset-1' : ''
      } ${hasError ? 'ring-2 ring-red-500' : ''}`}
      style={{
        left: `${left}%`,
        width: `${Math.max(width, 0.5)}%`,
      }}
      onClick={onSelect}
    >
      {/* 左拖拽手柄 */}
      <div
        className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-black/20 rounded-l"
        onMouseDown={(e) => handleMouseDown(e, 'left')}
      />

      {/* 中间区域 - 可拖动整体 */}
      <div
        className="absolute left-2 right-2 top-0 bottom-0 cursor-move overflow-hidden"
        onMouseDown={(e) => handleMouseDown(e, 'move')}
      >
        <span className="text-xs text-white font-medium truncate px-1 leading-8">
          {node.title}
        </span>
      </div>

      {/* 右拖拽手柄 */}
      <div
        className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-black/20 rounded-r"
        onMouseDown={(e) => handleMouseDown(e, 'right')}
      />
    </div>
  )
}
