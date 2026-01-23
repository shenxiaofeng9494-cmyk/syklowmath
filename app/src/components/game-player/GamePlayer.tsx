'use client'

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { LiveProvider, LivePreview, LiveError } from 'react-live'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Gamepad2, HelpCircle, Lightbulb, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { transform } from 'sucrase'

interface GamePlayerProps {
  game: {
    id: string
    title: string
    description: string
    componentCode: string
    instructions: string
    hints: string[]
    difficulty: 'easy' | 'medium' | 'hard'
    estimatedPlayTime: number
  }
  onClose: () => void
  onComplete?: (score: number, maxScore: number) => void
}

// 为 LiveProvider 提供的全局作用域
const scope = {
  React,
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
  motion,
  AnimatePresence,
  Math,
}

/**
 * 游戏播放器组件
 * 使用 react-live 安全地渲染 AI 生成的游戏代码
 */
export function GamePlayer({ game, onClose, onComplete }: GamePlayerProps) {
  const [showInstructions, setShowInstructions] = useState(true)
  const [showHints, setShowHints] = useState(false)
  const [currentHint, setCurrentHint] = useState(0)
  const [key, setKey] = useState(0)

  // 预处理代码：使用 sucrase 转换 TypeScript 到 JavaScript
  const processedCode = useMemo(() => {
    try {
      let code = game.componentCode

      // 移除 import 语句
      code = code.replace(/^import\s+.*$/gm, '').trim()

      // 移除 export default
      code = code.replace(/export\s+default\s+/, '').trim()

      // 提取函数名
      let functionName = 'MathGame'
      const funcMatch = code.match(/function\s+(\w+)/)
      if (funcMatch) {
        functionName = funcMatch[1]
      } else {
        const constMatch = code.match(/const\s+(\w+)\s*=/)
        if (constMatch) {
          functionName = constMatch[1]
        }
      }

      // 使用 sucrase 转换 TypeScript 到 JavaScript
      const transformed = transform(code, {
        transforms: ['typescript', 'jsx'],
        jsxRuntime: 'classic',
        jsxPragma: 'React.createElement',
        jsxFragmentPragma: 'React.Fragment',
      })

      const jsCode = transformed.code

      // 清理多余空行
      const cleanedCode = jsCode.replace(/\n{3,}/g, '\n\n').trim()

      const finalCode = `${cleanedCode}

render(<${functionName} />)`

      console.log('[GamePlayer] 函数名:', functionName)
      console.log('[GamePlayer] 转换后代码前500字符:', finalCode.slice(0, 500))
      return finalCode
    } catch (error) {
      console.error('[GamePlayer] 代码转换失败:', error)
      return `render(<div className="text-red-500 p-4">代码转换失败: ${error instanceof Error ? error.message : '未知错误'}</div>)`
    }
  }, [game.componentCode])

  const difficultyConfig = {
    easy: { color: 'text-green-500', bg: 'bg-green-100', label: '简单' },
    medium: { color: 'text-yellow-500', bg: 'bg-yellow-100', label: '中等' },
    hard: { color: 'text-red-500', bg: 'bg-red-100', label: '困难' },
  }

  const difficulty = difficultyConfig[game.difficulty]

  const handleReset = () => {
    setKey(prev => prev + 1)
  }

  const handleNextHint = () => {
    if (currentHint < game.hints.length - 1) {
      setCurrentHint(prev => prev + 1)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-gradient-to-r from-purple-50 to-blue-50">
          <div className="flex items-center gap-3">
            <Gamepad2 className="w-6 h-6 text-purple-500" />
            <div>
              <h2 className="font-bold text-lg text-gray-800">{game.title}</h2>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <span className={`px-2 py-0.5 rounded-full text-xs ${difficulty.bg} ${difficulty.color}`}>
                  {difficulty.label}
                </span>
                <span>约 {Math.round(game.estimatedPlayTime / 60)} 分钟</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowInstructions(true)}
              title="查看说明"
            >
              <HelpCircle className="w-5 h-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowHints(true)}
              title="获取提示"
            >
              <Lightbulb className="w-5 h-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleReset}
              title="重新开始"
            >
              <RotateCcw className="w-5 h-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Game Area */}
        <div className="flex-1 overflow-auto p-6 bg-gray-50">
          <LiveProvider code={processedCode} scope={scope} key={key} noInline>
            <div className="bg-white rounded-xl shadow-sm p-6 min-h-[400px]">
              <LiveError className="text-red-500 bg-red-50 p-4 rounded-lg mb-4 font-mono text-sm" />
              <LivePreview />
            </div>
          </LiveProvider>
        </div>

        {/* Instructions Modal */}
        <AnimatePresence>
          {showInstructions && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/50 flex items-center justify-center p-4"
              onClick={() => setShowInstructions(false)}
            >
              <motion.div
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0.9 }}
                className="bg-white rounded-xl p-6 max-w-md w-full shadow-xl"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                  <HelpCircle className="w-5 h-5 text-blue-500" />
                  游戏说明
                </h3>
                <p className="text-gray-700 mb-4">{game.description}</p>
                <div className="bg-blue-50 p-4 rounded-lg text-gray-700 mb-6">
                  {game.instructions}
                </div>
                <Button className="w-full" onClick={() => setShowInstructions(false)}>
                  开始游戏
                </Button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Hints Modal */}
        <AnimatePresence>
          {showHints && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/50 flex items-center justify-center p-4"
              onClick={() => setShowHints(false)}
            >
              <motion.div
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0.9 }}
                className="bg-white rounded-xl p-6 max-w-md w-full shadow-xl"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                  <Lightbulb className="w-5 h-5 text-yellow-500" />
                  提示 {currentHint + 1}/{game.hints.length}
                </h3>
                <div className="bg-yellow-50 p-4 rounded-lg text-gray-700 mb-6">
                  {game.hints[currentHint]}
                </div>
                <div className="flex gap-3">
                  <Button variant="outline" className="flex-1" onClick={() => setShowHints(false)}>
                    关闭
                  </Button>
                  {currentHint < game.hints.length - 1 && (
                    <Button className="flex-1" onClick={handleNextHint}>
                      下一个提示
                    </Button>
                  )}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  )
}
