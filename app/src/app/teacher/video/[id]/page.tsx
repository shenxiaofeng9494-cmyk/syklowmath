'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Play, Clock, Users, Gamepad2, MessageCircle, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { GamePlayer } from '@/components/game-player/GamePlayer'

interface Video {
  id: string
  title: string
  description: string
  video_url: string
  status: string
  node_count: number
  created_at: string
  teacher?: string
}

interface VideoNode {
  id: string
  title: string
  summary: string
  start_time: number
  end_time: number
  node_type: string
  order: number
}

interface Game {
  id: string
  title: string
  description: string
  difficulty: string
  game_type: string
  component_code: string
  instructions: string
  hints: string[]
  estimated_play_time: number
  created_at: string
}

export default function VideoDetailPage() {
  const params = useParams()
  const router = useRouter()
  const videoId = params.id as string

  const [video, setVideo] = useState<Video | null>(null)
  const [nodes, setNodes] = useState<VideoNode[]>([])
  const [games, setGames] = useState<Game[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedGame, setSelectedGame] = useState<Game | null>(null)
  const [showFeedback, setShowFeedback] = useState(false)
  const [feedbackText, setFeedbackText] = useState('')
  const [submittingFeedback, setSubmittingFeedback] = useState(false)

  useEffect(() => {
    fetchVideoDetail()
  }, [videoId])

  const fetchVideoDetail = async () => {
    try {
      // 获取视频详情
      const videoRes = await fetch(`/api/video/${videoId}`)
      const videoData = await videoRes.json()
      setVideo(videoData.video)

      // 获取节点列表
      const nodesRes = await fetch(`/api/video/${videoId}/nodes`)
      const nodesData = await nodesRes.json()
      setNodes(nodesData.nodes || [])

      // 获取游戏列表
      const gamesRes = await fetch(`/api/game/generate?videoId=${videoId}`)
      const gamesData = await gamesRes.json()
      setGames(gamesData.games || [])

    } catch (error) {
      console.error('Failed to fetch video detail:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmitFeedback = async () => {
    if (!selectedGame || !feedbackText.trim()) return

    setSubmittingFeedback(true)
    try {
      const res = await fetch(`/api/game/${selectedGame.id}/feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          feedback: feedbackText,
          type: 'negative', // 老师反馈默认为改进建议
          gameId: selectedGame.id,
          videoId: videoId,
        }),
      })

      if (res.ok) {
        alert('反馈已提交！Agent将根据您的建议优化游戏。')
        setShowFeedback(false)
        setFeedbackText('')
      } else {
        alert('反馈提交失败，请重试')
      }
    } catch (error) {
      console.error('Failed to submit feedback:', error)
      alert('反馈提交失败')
    } finally {
      setSubmittingFeedback(false)
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const getDifficultyBadge = (difficulty: string) => {
    const config = {
      easy: { color: 'bg-green-100 text-green-800', label: '简单' },
      medium: { color: 'bg-yellow-100 text-yellow-800', label: '中等' },
      hard: { color: 'bg-red-100 text-red-800', label: '困难' },
    }
    const style = config[difficulty as keyof typeof config] || config.medium
    return <Badge className={style.color}>{style.label}</Badge>
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-lg">加载中...</div>
      </div>
    )
  }

  if (!video) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-lg text-gray-600 mb-4">视频不存在</div>
          <Link href="/teacher">
            <Button>返回视频列表</Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Link href="/teacher">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                返回视频列表
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{video.title}</h1>
              <p className="text-gray-600">{video.description || '暂无描述'}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* 左侧 - 视频播放器 */}
          <div className="lg:col-span-2 space-y-6">
            {/* 视频播放器 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Play className="w-5 h-5" />
                  视频播放器
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="aspect-video bg-black rounded-lg overflow-hidden">
                  <video
                    controls
                    className="w-full h-full"
                    poster="/api/placeholder/640/360"
                  >
                    <source src={video.video_url} type="video/mp4" />
                    您的浏览器不支持视频播放。
                  </video>
                </div>
                <div className="mt-4 flex items-center gap-4 text-sm text-gray-600">
                  <span>创建时间: {new Date(video.created_at).toLocaleDateString('zh-CN')}</span>
                  {video.teacher && <span>讲师: {video.teacher}</span>}
                </div>
              </CardContent>
            </Card>

            {/* 知识点节点 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  知识点分段 ({nodes.length} 个)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {nodes.map((node, index) => (
                    <div
                      key={node.id}
                      className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">节点 {index + 1}</Badge>
                          <Badge variant="secondary">{node.node_type}</Badge>
                        </div>
                        <div className="text-sm text-gray-500">
                          {formatTime(node.start_time)} - {formatTime(node.end_time)}
                        </div>
                      </div>
                      <h4 className="font-medium text-gray-900 mb-2">{node.title}</h4>
                      <p className="text-gray-600 text-sm">{node.summary}</p>
                    </div>
                  ))}
                  {nodes.length === 0 && (
                    <div className="text-center text-gray-500 py-8">
                      暂无知识点节点
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 右侧 - 游戏列表 */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Gamepad2 className="w-5 h-5" />
                  生成的游戏 ({games.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {games.map((game) => (
                    <div
                      key={game.id}
                      className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="font-medium text-sm">{game.title}</h4>
                        {getDifficultyBadge(game.difficulty)}
                      </div>
                      <p className="text-gray-600 text-xs mb-3">{game.description}</p>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="flex-1"
                          onClick={() => setSelectedGame(game)}
                        >
                          试玩游戏
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedGame(game)
                            setShowFeedback(true)
                          }}
                        >
                          <MessageCircle className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  {games.length === 0 && (
                    <div className="text-center text-gray-500 py-8">
                      暂无生成的游戏
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* 游戏试玩模态框 */}
        {selectedGame && !showFeedback && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b">
                <div>
                  <h3 className="font-semibold">{selectedGame.title}</h3>
                  <p className="text-sm text-gray-600">{selectedGame.description}</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowFeedback(true)}
                  >
                    <MessageCircle className="w-4 h-4 mr-2" />
                    提供反馈
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setSelectedGame(null)}
                  >
                    关闭
                  </Button>
                </div>
              </div>
              <div className="p-4 max-h-[70vh] overflow-auto">
                <GamePlayer
                  game={{
                    id: selectedGame.id,
                    title: selectedGame.title,
                    description: selectedGame.description,
                    componentCode: selectedGame.component_code,
                    instructions: selectedGame.instructions || '按照游戏规则进行操作',
                    hints: selectedGame.hints || [],
                    difficulty: selectedGame.difficulty as 'easy' | 'medium' | 'hard',
                    estimatedPlayTime: selectedGame.estimated_play_time,
                  }}
                  onClose={() => setSelectedGame(null)}
                  onComplete={(score, maxScore) => {
                    alert(`游戏完成！得分: ${score}/${maxScore}`)
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* 反馈模态框 */}
        {showFeedback && selectedGame && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl">
              <div className="p-6">
                <h3 className="text-lg font-semibold mb-4">
                  为 "{selectedGame.title}" 提供反馈
                </h3>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    您的改进建议：
                  </label>
                  <Textarea
                    value={feedbackText}
                    onChange={(e) => setFeedbackText(e.target.value)}
                    placeholder="请描述您对游戏的意见和改进建议，例如：游戏难度、交互方式、内容准确性等..."
                    rows={4}
                  />
                </div>
                <div className="flex justify-end gap-3">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowFeedback(false)
                      setFeedbackText('')
                    }}
                  >
                    取消
                  </Button>
                  <Button
                    onClick={handleSubmitFeedback}
                    disabled={!feedbackText.trim() || submittingFeedback}
                  >
                    <Send className="w-4 h-4 mr-2" />
                    {submittingFeedback ? '提交中...' : '提交反馈'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
