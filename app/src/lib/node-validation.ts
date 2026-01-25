// 节点时间验证工具

export interface NodeTimeUpdate {
  id: string
  start_time: number
  end_time: number
  title?: string
}

export interface ValidationError {
  nodeId: string
  type: 'invalid_range' | 'overlap' | 'out_of_bounds'
  message: string
}

export interface ValidationResult {
  valid: boolean
  errors: ValidationError[]
}

/**
 * 验证节点时间更新
 * @param nodes 要验证的节点列表
 * @param videoDuration 视频总时长（秒）
 * @returns 验证结果
 */
export function validateNodeTimes(
  nodes: NodeTimeUpdate[],
  videoDuration: number
): ValidationResult {
  const errors: ValidationError[] = []

  // 按开始时间排序
  const sortedNodes = [...nodes].sort((a, b) => a.start_time - b.start_time)

  for (let i = 0; i < sortedNodes.length; i++) {
    const node = sortedNodes[i]

    // 检查 start_time < end_time
    if (node.start_time >= node.end_time) {
      errors.push({
        nodeId: node.id,
        type: 'invalid_range',
        message: `节点开始时间必须小于结束时间`,
      })
    }

    // 检查时间在视频范围内
    if (node.start_time < 0 || node.end_time > videoDuration) {
      errors.push({
        nodeId: node.id,
        type: 'out_of_bounds',
        message: `节点时间必须在 0 到 ${videoDuration} 秒之间`,
      })
    }

    // 检查与下一个节点是否重叠
    if (i < sortedNodes.length - 1) {
      const nextNode = sortedNodes[i + 1]
      if (node.end_time > nextNode.start_time) {
        errors.push({
          nodeId: node.id,
          type: 'overlap',
          message: `节点与下一个节点时间重叠`,
        })
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}
