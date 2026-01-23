'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Gamepad2, Play, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { GamePlayer } from './GamePlayer'

interface GamePromptProps {
  videoId: string
  nodeId: string
  nodeTitle: string
  onDismiss: () => void
  onContinue: () => void
}

interface GameData {
  id: string
  title: string
  description: string
  component_code: string
  instructions: string
  hints: string[]
  difficulty: 'easy' | 'medium' | 'hard'
  estimated_play_time: number
}

/**
 * 游戏提示弹窗
 * 在节点播放完后显示，邀请学生玩游戏
 */
export function GamePrompt({ videoId, nodeId, nodeTitle, onDismiss, onContinue }: GamePromptProps) {
  const [game, setGame] = useState<GameData | null>(null)
  const [loading, setLoading] = useState(true)
  const [showGame, setShowGame] = useState(false)

  // 加载该节点的游戏
  useEffect(() => {
    const fetchGame = async () => {
      try {
        const res = await fetch(`/api/game/generate?videoId=${videoId}&nodeId=${nodeId}`)
        if (res.ok) {
          const data = await res.json()
          if (data.games && data.games.length > 0) {
            setGame(data.games[0])
          }
        }
      } catch (error) {
        console.error('Failed to fetch game:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchGame()
  }, [videoId, nodeId])

  // 如果没有游戏，不显示提示
  if (!loading && !game) {
    return null
  }

  const handlePlayGame = () => {
    setShowGame(true)
  }

  const handleCloseGame = () => {
    setShowGame(false)
  }

  const handleGameComplete = (score: number, maxScore: number) => {
    console.log(`Game completed: ${score}/${maxScore}`)
    setShowGame(false)
    onContinue()
  }

  return (
    <>
      <AnimatePresence>
        {!showGame && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-40"
          >
            <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md mx-4 border-2 border-purple-200">
              {loading ? (
                <div className="flex items-center gap-3 text-gray-500">
                  <div className="animate-spin w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full" />
                  <span>检查游戏...</span>
                </div>
              ) : game ? (
                <>
                  <div className="flex items-start gap-4 mb-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-blue-500 rounded-xl flex items-center justify-center flex-shrink-0">
                      <Gamepad2 className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-800 mb-1">
                        巩固一下？
                      </h3>
                      <p className="text-sm text-gray-600">
                        「{nodeTitle}」学完了！来玩个小游戏验证一下吧
                      </p>
                    </div>
                  </div>

                  <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl p-4 mb-4">
                    <h4 className="font-medium text-purple-700 mb-1">{game.title}</h4>
                    <p className="text-sm text-gray-600">{game.description}</p>
                  </div>

                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={onDismiss}
                    >
                      <X className="w-4 h-4 mr-2" />
                      跳过
                    </Button>
                    <Button
                      className="flex-1 bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600"
                      onClick={handlePlayGame}
                    >
                      <Play className="w-4 h-4 mr-2" />
                      开始游戏
                    </Button>
                  </div>
                </>
              ) : null}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 游戏播放器 */}
      <AnimatePresence>
        {showGame && game && (
          <GamePlayer
            game={{
              id: game.id,
              title: game.title,
              description: game.description,
              componentCode: game.component_code,
              instructions: game.instructions,
              hints: game.hints,
              difficulty: game.difficulty,
              estimatedPlayTime: game.estimated_play_time,
            }}
            onClose={handleCloseGame}
            onComplete={handleGameComplete}
          />
        )}
      </AnimatePresence>
    </>
  )
}
