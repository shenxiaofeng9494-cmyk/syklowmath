/**
 * 必停点介入UI组件
 * 当AI主动介入时显示特殊的UI状态
 */

"use client"

import { VideoNode } from '@/types/database'
import { AlertCircle, MessageSquare } from 'lucide-react'

interface CheckpointInterventionUIProps {
  checkpoint: VideoNode
  isVisible: boolean
}

export function CheckpointInterventionUI({
  checkpoint,
  isVisible
}: CheckpointInterventionUIProps) {
  if (!isVisible || !checkpoint) {
    return null
  }

  return (
    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center animate-in fade-in duration-300">
      <div className="bg-gradient-to-br from-orange-500 to-red-500 rounded-2xl p-8 max-w-2xl mx-4 shadow-2xl animate-in zoom-in duration-300">
        {/* 标题 */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
            <AlertCircle className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-2xl font-bold text-white">
              老师介入
            </h3>
            <p className="text-white/80 text-sm">
              {checkpoint.checkpoint_type === 'motivation' && '动机确认'}
              {checkpoint.checkpoint_type === 'definition' && '定义验证'}
              {checkpoint.checkpoint_type === 'pitfall' && '易错点检查'}
              {checkpoint.checkpoint_type === 'summary' && '总结确认'}
              {checkpoint.checkpoint_type === 'verification' && '理解验证'}
            </p>
          </div>
        </div>

        {/* 提示信息 */}
        <div className="bg-white/10 rounded-xl p-6 mb-6">
          <div className="flex items-start gap-3">
            <MessageSquare className="w-5 h-5 text-white mt-1 flex-shrink-0" />
            <div className="text-white">
              <p className="font-medium mb-2">
                这是一个关键知识点，老师需要确认你的理解
              </p>
              <p className="text-sm text-white/80">
                请准备回答老师的提问
              </p>
            </div>
          </div>
        </div>

        {/* 动画指示器 */}
        <div className="flex items-center justify-center gap-2">
          <div className="w-2 h-2 rounded-full bg-white animate-pulse" style={{ animationDelay: '0ms' }} />
          <div className="w-2 h-2 rounded-full bg-white animate-pulse" style={{ animationDelay: '150ms' }} />
          <div className="w-2 h-2 rounded-full bg-white animate-pulse" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  )
}
