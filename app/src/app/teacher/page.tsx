'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Plus, Search, Play, Edit, Trash2, Eye, Clock, Users, Gamepad2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface Video {
  id: string
  title: string
  description: string
  video_url: string
  status: 'processing' | 'completed' | 'error'
  node_count: number
  created_at: string
  teacher?: string
}

interface GameSummary {
  video_id: string
  game_count: number
  game_titles: string[]
}

export default function TeacherPage() {
  const [videos, setVideos] = useState<Video[]>([])
  const [gamesMap, setGamesMap] = useState<Record<string, GameSummary>>({})
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedStatus, setSelectedStatus] = useState<string>('all')

  useEffect(() => {
    fetchVideos()
  }, [])

  const fetchVideos = async () => {
    try {
      // 获取视频列表
      const videosRes = await fetch('/api/video')
      const videosData = await videosRes.json()
      setVideos(videosData.videos || [])

      // 获取所有游戏统计
      const gameStats: Record<string, GameSummary> = {}
      for (const video of videosData.videos || []) {
        const gamesRes = await fetch(`/api/game/generate?videoId=${video.id}`)
        const gamesData = await gamesRes.json()
        gameStats[video.id] = {
          video_id: video.id,
          game_count: gamesData.games?.length || 0,
          game_titles: gamesData.games?.map((g: any) => g.title) || []
        }
      }
      setGamesMap(gameStats)
    } catch (error) {
      console.error('Failed to fetch videos:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredVideos = videos.filter(video => {
    const matchesSearch = video.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         video.description?.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = selectedStatus === 'all' || video.status === selectedStatus
    return matchesSearch && matchesStatus
  })

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-900 text-green-300">已完成</Badge>
      case 'processing':
        return <Badge className="bg-yellow-900 text-yellow-300">处理中</Badge>
      case 'error':
        return <Badge className="bg-red-900 text-red-300">失败</Badge>
      default:
        return <Badge className="bg-muted text-muted-foreground">未知</Badge>
    }
  }

  const handleDeleteVideo = async (videoId: string) => {
    if (!confirm('确定要删除这个视频吗？这将同时删除相关的游戏数据。')) {
      return
    }

    try {
      const res = await fetch(`/api/video/${videoId}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        setVideos(prev => prev.filter(v => v.id !== videoId))
        setGamesMap(prev => {
          const { [videoId]: _, ...rest } = prev
          return rest
        })
        alert('视频删除成功')
      } else {
        alert('删除失败')
      }
    } catch (error) {
      console.error('Delete failed:', error)
      alert('删除失败')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-lg">加载中...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card shadow-sm border-b border-border">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">老师端 - 视频管理中心</h1>
              <p className="text-muted-foreground mt-1">管理教学视频、查看分段、测试游戏</p>
            </div>
            <div className="flex gap-3">
              <Link href="/admin">
                <Button variant="outline">
                  <Plus className="w-4 h-4 mr-2" />
                  上传新视频
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* 搜索和筛选 */}
        <div className="mb-8">
          <div className="flex gap-4 mb-4">
            <div className="flex-1 relative">
              <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="搜索视频标题或描述..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-3 py-2 border border-border bg-card text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">全部状态</option>
              <option value="completed">已完成</option>
              <option value="processing">处理中</option>
              <option value="error">失败</option>
            </select>
          </div>
        </div>

        {/* 统计卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">总视频数</CardTitle>
              <Play className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{videos.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">已完成</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {videos.filter(v => v.status === 'completed').length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">知识点节点</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {videos.reduce((sum, v) => sum + (v.node_count || 0), 0)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">生成游戏</CardTitle>
              <Gamepad2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">
                {Object.values(gamesMap).reduce((sum, g) => sum + g.game_count, 0)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 视频列表 */}
        <div className="space-y-6">
          {filteredVideos.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <div className="text-muted-foreground mb-4">
                  {searchQuery || selectedStatus !== 'all' ? '没有找到匹配的视频' : '还没有上传任何视频'}
                </div>
                <Link href="/admin">
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    上传第一个视频
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            filteredVideos.map((video) => {
              const gameSummary = gamesMap[video.id]
              return (
                <Card key={video.id} className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-xl mb-2">{video.title}</CardTitle>
                        <CardDescription className="text-base">
                          {video.description || '暂无描述'}
                        </CardDescription>
                        <div className="flex items-center gap-4 mt-3">
                          {getStatusBadge(video.status)}
                          <span className="text-sm text-muted-foreground">
                            {new Date(video.created_at).toLocaleDateString('zh-CN')}
                          </span>
                          {video.teacher && (
                            <span className="text-sm text-muted-foreground">
                              讲师: {video.teacher}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Link href={`/teacher/video/${video.id}`}>
                          <Button size="sm" variant="outline">
                            <Eye className="w-4 h-4 mr-2" />
                            查看详情
                          </Button>
                        </Link>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDeleteVideo(video.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm">
                          <strong>{video.node_count || 0}</strong> 个知识点节点
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Gamepad2 className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm">
                          <strong>{gameSummary?.game_count || 0}</strong> 个生成游戏
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Play className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">
                          视频时长: 约 {Math.round((video.node_count || 0) * 1.5)} 分钟
                        </span>
                      </div>
                    </div>

                    {/* 游戏列表预览 */}
                    {gameSummary && gameSummary.game_count > 0 && (
                      <div className="mt-4 pt-4 border-t border-border">
                        <div className="text-sm font-medium text-foreground mb-2">生成的游戏:</div>
                        <div className="flex flex-wrap gap-2">
                          {gameSummary.game_titles.slice(0, 3).map((title, index) => (
                            <Badge key={index} variant="secondary" className="text-xs">
                              {title}
                            </Badge>
                          ))}
                          {gameSummary.game_titles.length > 3 && (
                            <Badge variant="outline" className="text-xs">
                              +{gameSummary.game_titles.length - 3} 更多
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })
          )}
        </div>
      </main>
    </div>
  )
}
