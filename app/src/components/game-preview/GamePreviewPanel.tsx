'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Gamepad2, ChevronLeft, ChevronRight, Send, MessageSquare, ThumbsUp, ThumbsDown, RotateCcw, Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { GamePlayer } from '@/components/game-player/GamePlayer'

interface GameData {
  id: string
  title: string
  description: string
  component_code: string
  instructions: string
  hints: string[]
  difficulty: 'easy' | 'medium' | 'hard'
  estimated_play_time: number
  math_concepts: string[]
  learning_objectives: string[]
  created_at: string
}

interface GamePreviewPanelProps {
  videoId: string
  videoTitle: string
  onClose: () => void
}

/**
 * 游戏预览面板
 * 让老师可以逐一体验每个生成的游戏，并提供反馈
 */
export function GamePreviewPanel({ videoId, videoTitle, onClose }: GamePreviewPanelProps) {
  const [games, setGames] = useState<GameData[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [showFeedback, setShowFeedback] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [feedbackType, setFeedbackType] = useState<'positive' | 'negative' | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // 加载游戏数据
  useEffect(() => {
    const fetchGames = async () => {
      try {
        const res = await fetch(`/api/game/generate?videoId=${videoId}`)
        if (res.ok) {
          const data = await res.json()
          setGames(data.games || [])
        }
      } catch (error) {
        console.error('Failed to fetch games:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchGames()
  }, [videoId])

  const currentGame = games[currentIndex]

  const handlePrevious = () => {
    setCurrentIndex(prev => Math.max(0, prev - 1))
    setShowFeedback(false)
    setFeedback('')
    setFeedbackType(null)
  }

  const handleNext = () => {
    setCurrentIndex(prev => Math.min(games.length - 1, prev + 1))
    setShowFeedback(false)
    setFeedback('')
    setFeedbackType(null)
  }

  const handleFeedback = (type: 'positive' | 'negative') => {
    setFeedbackType(type)
    setShowFeedback(true)
  }

  const handleSubmitFeedback = async () => {
    if (!feedback.trim() || !currentGame) return

    setIsSubmitting(true)
    try {
      const res = await fetch(`/api/game/${currentGame.id}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          feedback,
          type: feedbackType,
          gameId: currentGame.id,
          videoId,
        }),
      })

      if (res.ok) {
        setShowFeedback(false)
        setFeedback('')
        setFeedbackType(null)
        alert('反馈已提交，谢谢！')
      }
    } catch (error) {
      console.error('Failed to submit feedback:', error)
      alert('提交反馈失败，请重试')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
        <Card className="w-full max-w-md mx-4">
          <CardContent className="p-6 text-center">
            <div className="animate-spin w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-gray-600">加载游戏预览...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (games.length === 0) {
    return (
      <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
        <Card className="w-full max-w-md mx-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gamepad2 className="w-5 h-5" />
              游戏预览
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 text-center">
            <p className="text-gray-600 mb-4">暂无生成的游戏</p>
            <Button onClick={onClose}>关闭</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <Card className="w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <CardHeader className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Gamepad2 className="w-6 h-6 text-purple-500" />
              <div>
                <CardTitle>游戏预览 - {videoTitle}</CardTitle>
                <CardDescription>
                  第 {currentIndex + 1} / {games.length} 个游戏
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={onClose}>
                关闭预览
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex-1 overflow-auto p-6">
          {/* Game Info */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold">{currentGame.title}</h3>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-1 rounded-full text-xs ${
                  currentGame.difficulty === 'easy' ? 'bg-green-100 text-green-600' :
                  currentGame.difficulty === 'medium' ? 'bg-yellow-100 text-yellow-600' :
                  'bg-red-100 text-red-600'
                }`}>
                  {currentGame.difficulty === 'easy' ? '简单' :
                   currentGame.difficulty === 'medium' ? '中等' : '困难'}
                </span>
                <span className="text-sm text-gray-500">
                  约 {Math.round(currentGame.estimated_play_time / 60)} 分钟
                </span>
              </div>
            </div>
            <p className="text-gray-600 mb-4">{currentGame.description}</p>

            {/* Learning Objectives */}
            {currentGame.learning_objectives.length > 0 && (
              <div className="mb-4">
                <h4 className="font-medium mb-2">学习目标：</h4>
                <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                  {currentGame.learning_objectives.map((objective, index) => (
                    <li key={index}>{objective}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Math Concepts */}
            {currentGame.math_concepts.length > 0 && (
              <div className="mb-4">
                <h4 className="font-medium mb-2">相关概念：</h4>
                <div className="flex flex-wrap gap-2">
                  {currentGame.math_concepts.map((concept, index) => (
                    <span key={index} className="px-2 py-1 bg-blue-100 text-blue-600 rounded text-xs">
                      {concept}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Game Player */}
          <div className="mb-6">
            <h4 className="font-medium mb-3 flex items-center gap-2">
              <Eye className="w-4 h-4" />
              游戏体验
            </h4>
            <GamePlayer
              game={{
                id: currentGame.id,
                title: currentGame.title,
                description: currentGame.description,
                componentCode: currentGame.component_code,
                instructions: currentGame.instructions,
                hints: currentGame.hints,
                difficulty: currentGame.difficulty,
                estimatedPlayTime: currentGame.estimated_play_time,
              }}
              onClose={() => {}}
            />
          </div>

          {/* Feedback Section */}
          <div className="border-t pt-6">
            <h4 className="font-medium mb-4 flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              游戏反馈
            </h4>

            {!showFeedback ? (
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => handleFeedback('positive')}
                  className="flex-1"
                >
                  <ThumbsUp className="w-4 h-4 mr-2" />
                  游戏不错
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleFeedback('negative')}
                  className="flex-1"
                >
                  <ThumbsDown className="w-4 h-4 mr-2" />
                  需要改进
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <Textarea
                  placeholder={`请描述您对「${currentGame.title}」的具体意见和改进建议...`}
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  rows={4}
                />
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowFeedback(false)
                      setFeedback('')
                      setFeedbackType(null)
                    }}
                  >
                    取消
                  </Button>
                  <Button
                    onClick={handleSubmitFeedback}
                    disabled={!feedback.trim() || isSubmitting}
                  >
                    <Send className="w-4 h-4 mr-2" />
                    {isSubmitting ? '提交中...' : '提交反馈'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CardContent>

        {/* Footer */}
        <div className="flex-shrink-0 border-t p-4 flex items-center justify-between">
          <Button
            variant="outline"
            onClick={handlePrevious}
            disabled={currentIndex === 0}
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            上一个
          </Button>

          <div className="flex gap-2">
            {games.map((_, index) => (
              <button
                key={index}
                className={`w-2 h-2 rounded-full transition-colors ${
                  index === currentIndex ? 'bg-purple-500' : 'bg-gray-300'
                }`}
                onClick={() => setCurrentIndex(index)}
              />
            ))}
          </div>

          <Button
            variant="outline"
            onClick={handleNext}
            disabled={currentIndex === games.length - 1}
          >
            下一个
            <ChevronRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </Card>
    </div>
  )
}
