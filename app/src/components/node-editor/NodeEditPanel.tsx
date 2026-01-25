'use client'

import { useState, useEffect } from 'react'
import { Play } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { NodeData } from './NodeSegment'

interface NodeEditPanelProps {
  node: NodeData | null
  duration: number
  onTimeChange: (startTime: number, endTime: number) => void
  onPreview: (time: number) => void
}

function parseTimeInput(value: string): number | null {
  // 支持 MM:SS 或纯秒数格式
  if (value.includes(':')) {
    const parts = value.split(':')
    if (parts.length !== 2) return null
    const mins = parseInt(parts[0], 10)
    const secs = parseInt(parts[1], 10)
    if (isNaN(mins) || isNaN(secs) || secs >= 60) return null
    return mins * 60 + secs
  }
  const secs = parseInt(value, 10)
  return isNaN(secs) ? null : secs
}

function formatTimeInput(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

export function NodeEditPanel({
  node,
  duration,
  onTimeChange,
  onPreview,
}: NodeEditPanelProps) {
  const [startInput, setStartInput] = useState('')
  const [endInput, setEndInput] = useState('')

  useEffect(() => {
    if (node) {
      setStartInput(formatTimeInput(node.start_time))
      setEndInput(formatTimeInput(node.end_time))
    }
  }, [node])

  if (!node) {
    return (
      <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
        <p className="text-gray-500 text-sm text-center">点击时间轴上的节点进行编辑</p>
      </div>
    )
  }

  const handleStartChange = (value: string) => {
    setStartInput(value)
    const parsed = parseTimeInput(value)
    if (parsed !== null && parsed >= 0 && parsed < node.end_time) {
      onTimeChange(parsed, node.end_time)
    }
  }

  const handleEndChange = (value: string) => {
    setEndInput(value)
    const parsed = parseTimeInput(value)
    if (parsed !== null && parsed > node.start_time && parsed <= duration) {
      onTimeChange(node.start_time, parsed)
    }
  }

  const handleStartBlur = () => {
    setStartInput(formatTimeInput(node.start_time))
  }

  const handleEndBlur = () => {
    setEndInput(formatTimeInput(node.end_time))
  }

  return (
    <div className="p-4 bg-white rounded-lg border border-gray-200 space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-gray-900">{node.title}</h4>
        <Badge variant="secondary">{node.node_type}</Badge>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            开始时间
          </label>
          <div className="flex gap-2">
            <Input
              value={startInput}
              onChange={(e) => handleStartChange(e.target.value)}
              onBlur={handleStartBlur}
              placeholder="0:00"
              className="font-mono"
            />
            <Button
              size="icon"
              variant="outline"
              onClick={() => onPreview(node.start_time)}
              title="预览开始位置"
            >
              <Play className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            结束时间
          </label>
          <div className="flex gap-2">
            <Input
              value={endInput}
              onChange={(e) => handleEndChange(e.target.value)}
              onBlur={handleEndBlur}
              placeholder="0:00"
              className="font-mono"
            />
            <Button
              size="icon"
              variant="outline"
              onClick={() => onPreview(node.end_time)}
              title="预览结束位置"
            >
              <Play className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="text-sm text-gray-500">
        节点时长: {node.end_time - node.start_time} 秒
      </div>
    </div>
  )
}
