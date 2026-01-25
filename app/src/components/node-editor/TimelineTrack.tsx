'use client'

import { NodeSegment, NodeData } from './NodeSegment'
import { ValidationError } from '@/lib/node-validation'

interface TimelineTrackProps {
  nodes: NodeData[]
  duration: number
  selectedNodeId: string | null
  errors: ValidationError[]
  onSelectNode: (nodeId: string) => void
  onNodeTimeChange: (nodeId: string, startTime: number, endTime: number) => void
}

export function TimelineTrack({
  nodes,
  duration,
  selectedNodeId,
  errors,
  onSelectNode,
  onNodeTimeChange,
}: TimelineTrackProps) {
  const errorNodeIds = new Set(errors.map((e) => e.nodeId))

  return (
    <div className="relative h-10 bg-gray-50 border border-gray-200 rounded">
      {nodes.map((node) => (
        <NodeSegment
          key={node.id}
          node={node}
          duration={duration}
          isSelected={selectedNodeId === node.id}
          hasError={errorNodeIds.has(node.id)}
          onSelect={() => onSelectNode(node.id)}
          onTimeChange={(start, end) => onNodeTimeChange(node.id, start, end)}
        />
      ))}
    </div>
  )
}
