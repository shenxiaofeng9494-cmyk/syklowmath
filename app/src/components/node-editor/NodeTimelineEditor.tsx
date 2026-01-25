'use client'

import { useState, useCallback, useMemo } from 'react'
import { Save, X, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { TimelineRuler } from './TimelineRuler'
import { TimelineTrack } from './TimelineTrack'
import { NodeEditPanel } from './NodeEditPanel'
import { NodeData } from './NodeSegment'
import { validateNodeTimes, ValidationError } from '@/lib/node-validation'

interface VideoNode {
  id: string
  title: string
  summary: string
  start_time: number
  end_time: number
  node_type: string
  order: number
}

interface NodeTimelineEditorProps {
  videoId: string
  nodes: VideoNode[]
  duration: number
  onSave: () => void
  onCancel: () => void
  onPreviewTime: (time: number) => void
}

export function NodeTimelineEditor({
  videoId,
  nodes: initialNodes,
  duration,
  onSave,
  onCancel,
  onPreviewTime,
}: NodeTimelineEditorProps) {
  const [editedNodes, setEditedNodes] = useState<NodeData[]>(() =>
    initialNodes.map((n) => ({
      id: n.id,
      title: n.title,
      start_time: n.start_time,
      end_time: n.end_time,
      node_type: n.node_type,
    }))
  )
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // 验证节点
  const validation = useMemo(() => {
    return validateNodeTimes(
      editedNodes.map((n) => ({
        id: n.id,
        start_time: n.start_time,
        end_time: n.end_time,
      })),
      duration
    )
  }, [editedNodes, duration])

  // 检查是否有更改
  const hasChanges = useMemo(() => {
    return editedNodes.some((edited) => {
      const original = initialNodes.find((n) => n.id === edited.id)
      if (!original) return true
      return (
        edited.start_time !== original.start_time ||
        edited.end_time !== original.end_time
      )
    })
  }, [editedNodes, initialNodes])

  const selectedNode = useMemo(
    () => editedNodes.find((n) => n.id === selectedNodeId) || null,
    [editedNodes, selectedNodeId]
  )

  const handleNodeTimeChange = useCallback(
    (nodeId: string, startTime: number, endTime: number) => {
      setEditedNodes((prev) =>
        prev.map((n) =>
          n.id === nodeId ? { ...n, start_time: startTime, end_time: endTime } : n
        )
      )
    },
    []
  )

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
          nodes: editedNodes.map((n) => ({
            id: n.id,
            start_time: n.start_time,
            end_time: n.end_time,
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

  return (
    <div className="space-y-4">
      {/* 工具栏 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="font-medium">节点时间编辑器</h3>
          {!validation.valid && (
            <span className="text-red-500 text-sm flex items-center gap-1">
              <AlertCircle className="w-4 h-4" />
              {validation.errors.length} 个错误
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onCancel} disabled={saving}>
            <X className="w-4 h-4 mr-2" />
            取消
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || !validation.valid || !hasChanges}
          >
            <Save className="w-4 h-4 mr-2" />
            {saving ? '保存中...' : '保存更改'}
          </Button>
        </div>
      </div>

      {/* 错误提示 */}
      {saveError && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded">
          {saveError}
        </div>
      )}

      {/* 验证错误列表 */}
      {validation.errors.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 px-4 py-2 rounded">
          <ul className="text-sm text-yellow-800 space-y-1">
            {validation.errors.map((error, index) => (
              <li key={index}>
                {editedNodes.find((n) => n.id === error.nodeId)?.title}:{' '}
                {error.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 时间轴 */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <TimelineRuler duration={duration} width={800} />
        <TimelineTrack
          nodes={editedNodes}
          duration={duration}
          selectedNodeId={selectedNodeId}
          errors={validation.errors}
          onSelectNode={setSelectedNodeId}
          onNodeTimeChange={handleNodeTimeChange}
        />
      </div>

      {/* 编辑面板 */}
      <NodeEditPanel
        node={selectedNode}
        duration={duration}
        onTimeChange={(start, end) => {
          if (selectedNodeId) {
            handleNodeTimeChange(selectedNodeId, start, end)
          }
        }}
        onPreview={onPreviewTime}
      />

      {/* 未保存更改提示 */}
      {hasChanges && (
        <div className="text-sm text-amber-600">
          * 有未保存的更改
        </div>
      )}
    </div>
  )
}
