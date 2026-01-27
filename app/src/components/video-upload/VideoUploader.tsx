'use client'

import { useState, useRef, useCallback } from 'react'
import { Upload, FileVideo, Loader2, CheckCircle, XCircle, AlertCircle, Gamepad2, Brain, Code, Sparkles, Eye, MessageSquare } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { GamePreviewPanel } from '@/components/game-preview/GamePreviewPanel'

type SegmentationMethod = 'gpt' | 'volcengine'

interface ProcessProgress {
  stage: string
  progress: number
  message: string
  details?: string
  thinking?: string[]
  steps?: string[]
  currentTurn?: number
  maxTurns?: number
  currentNode?: string
  totalNodes?: number
  completedNodes?: number
}

type UploadStatus = 'idle' | 'uploading' | 'processing' | 'success' | 'error'

export function VideoUploader() {
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [teacher, setTeacher] = useState('')
  const [generateGames, setGenerateGames] = useState(false)
  const [segmentationMethod, setSegmentationMethod] = useState<SegmentationMethod>('gpt')
  const [status, setStatus] = useState<UploadStatus>('idle')
  const [progress, setProgress] = useState<ProcessProgress | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ videoId: string; nodeCount: number; gameCount?: number } | null>(null)
  const [showGamePreview, setShowGamePreview] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      setFile(selectedFile)
      setError(null)
      // 自动填充标题
      if (!title) {
        const nameWithoutExt = selectedFile.name.replace(/\.[^/.]+$/, '')
        setTitle(nameWithoutExt)
      }
    }
  }, [title])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile && droppedFile.type.startsWith('video/')) {
      setFile(droppedFile)
      setError(null)
      if (!title) {
        const nameWithoutExt = droppedFile.name.replace(/\.[^/.]+$/, '')
        setTitle(nameWithoutExt)
      }
    }
  }, [title])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
  }, [])

  const handleUploadAndProcess = async () => {
    if (!file) {
      setError('请选择视频文件')
      return
    }

    setStatus('uploading')
    setError(null)
    setProgress({ stage: 'upload', progress: 0, message: '准备上传...' })

    try {
      // Step 1: 上传到 OSS
      const formData = new FormData()
      formData.append('file', file)
      formData.append('title', title || file.name)
      if (teacher) {
        formData.append('teacher', teacher)
      }

      setProgress({ stage: 'upload', progress: 10, message: '正在上传视频到云端...' })

      const uploadRes = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })

      if (!uploadRes.ok) {
        const err = await uploadRes.json()
        throw new Error(err.error || '上传失败')
      }

      const uploadData = await uploadRes.json()
      const { videoId, fileUrl } = uploadData

      setProgress({ stage: 'upload', progress: 30, message: '上传完成，开始处理...' })

      // Step 2: 触发完整处理流程（流式响应）
      setStatus('processing')

      const processRes = await fetch('/api/video/full-process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoId,
          fileUrl,
          title: title || file.name,
          description: '',
          teacher,
          generateGames,
          segmentationMethod,
        }),
      })

      if (!processRes.ok) {
        throw new Error('处理请求失败')
      }

      // 读取 SSE 流
      const reader = processRes.body?.getReader()
      const decoder = new TextDecoder()

      if (reader) {
        let nodeCount = 0
        let gameCount = 0

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const text = decoder.decode(value)
          const lines = text.split('\n').filter((line) => line.startsWith('data: '))

          for (const line of lines) {
            try {
              const data = JSON.parse(line.slice(6)) as ProcessProgress
              setProgress(data)

              if (data.stage === 'complete') {
                // 解析节点数量
                const nodeMatch = data.message.match(/(\d+)\s*个知识点节点/)
                if (nodeMatch) {
                  nodeCount = parseInt(nodeMatch[1])
                }

                // 解析游戏数量
                const gameMatch = data.message.match(/(\d+)\s*个互动游戏/)
                if (gameMatch) {
                  gameCount = parseInt(gameMatch[1])
                }
              }

              if (data.stage === 'error') {
                throw new Error(data.message)
              }
            } catch (e) {
              // 忽略解析错误
            }
          }
        }

        setStatus('success')
        setResult({ videoId, nodeCount, gameCount })
      }
    } catch (err) {
      setStatus('error')
      setError(err instanceof Error ? err.message : '处理失败')
    }
  }

  const handleReset = () => {
    setFile(null)
    setTitle('')
    setTeacher('')
    setGenerateGames(false)
    setSegmentationMethod('gpt')
    setStatus('idle')
    setProgress(null)
    setError(null)
    setResult(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const getStatusIcon = () => {
    switch (status) {
      case 'uploading':
      case 'processing':
        return <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      case 'success':
        return <CheckCircle className="h-8 w-8 text-green-500" />
      case 'error':
        return <XCircle className="h-8 w-8 text-red-500" />
      default:
        return null
    }
  }

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileVideo className="h-6 w-6" />
          上传视频
        </CardTitle>
        <CardDescription>
          上传视频后，系统将自动进行语音识别、知识点切分和向量化处理
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* 文件选择区域 */}
        {status === 'idle' && (
          <>
            <div
              className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-900/20 transition-colors"
              onClick={() => fileInputRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*"
                onChange={handleFileSelect}
                className="hidden"
              />

              {file ? (
                <div className="space-y-2">
                  <FileVideo className="h-12 w-12 mx-auto text-blue-500" />
                  <p className="font-medium">{file.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <Upload className="h-12 w-12 mx-auto text-muted-foreground" />
                  <p className="text-muted-foreground">点击或拖拽视频文件到这里</p>
                  <p className="text-sm text-muted-foreground">支持 MP4, WebM, MOV 格式</p>
                </div>
              )}
            </div>

            {/* 视频信息 */}
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="title">视频标题</Label>
                <Input
                  id="title"
                  placeholder="请输入视频标题"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="teacher">讲师名称（可选）</Label>
                <Input
                  id="teacher"
                  placeholder="请输入讲师名称"
                  value={teacher}
                  onChange={(e) => setTeacher(e.target.value)}
                />
              </div>

              {/* 切分方案选择 */}
              <div className="grid gap-2">
                <Label htmlFor="segmentation-method">知识点切分方案</Label>
                <Select
                  value={segmentationMethod}
                  onValueChange={(value) => setSegmentationMethod(value as SegmentationMethod)}
                >
                  <SelectTrigger id="segmentation-method">
                    <SelectValue placeholder="选择切分方案" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gpt">
                      <div className="flex items-center gap-2">
                        <MessageSquare className="h-4 w-4 text-green-500" />
                        <span>GPT-4o 语义分析（推荐）</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="volcengine">
                      <div className="flex items-center gap-2">
                        <Eye className="h-4 w-4 text-blue-500" />
                        <span>火山引擎视觉切分</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {segmentationMethod === 'gpt'
                    ? '基于语义分析，理解教学内容结构，适合语音讲解为主的视频'
                    : '基于视觉转场检测，速度快，适合 PPT、板书切换明显的视频'}
                </p>
              </div>

              {/* 生成小游戏开关 */}
              <div className="flex items-center justify-between p-4 bg-gradient-to-r from-purple-900/30 to-blue-900/30 rounded-lg border border-purple-700/50">
                <div className="flex items-center gap-3">
                  <Gamepad2 className="h-5 w-5 text-purple-400" />
                  <div>
                    <Label htmlFor="generate-games" className="text-sm font-medium">
                      生成互动小游戏
                    </Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      AI 将为每个知识点生成趣味游戏，帮助学生巩固理解
                    </p>
                  </div>
                </div>
                <Switch
                  id="generate-games"
                  checked={generateGames}
                  onCheckedChange={setGenerateGames}
                />
              </div>
            </div>

            {/* 错误提示 */}
            {error && (
              <div className="flex items-center gap-2 text-red-400 bg-red-900/30 p-3 rounded-lg border border-red-700/50">
                <AlertCircle className="h-5 w-5" />
                <span>{error}</span>
              </div>
            )}

            {/* 上传按钮 */}
            <Button
              className="w-full"
              size="lg"
              onClick={handleUploadAndProcess}
              disabled={!file}
            >
              <Upload className="mr-2 h-5 w-5" />
              上传并处理
            </Button>
          </>
        )}

        {/* 处理进度 */}
        {(status === 'uploading' || status === 'processing') && progress && (
          <div className="space-y-4">
            <div className="flex items-center justify-center gap-3">
              {getStatusIcon()}
              <span className="text-lg font-medium">
                {status === 'uploading' ? '上传中...' : '处理中...'}
              </span>
            </div>

            <Progress value={progress.progress} className="h-2" />

            <div className="text-center space-y-2">
              <p className="text-muted-foreground">{progress.message}</p>
            </div>

            {/* Agent 游戏生成详细进度 */}
            {progress.stage === 'games' && (
              <div className="mt-4 bg-gradient-to-br from-purple-900/30 to-blue-900/30 border border-purple-700/50 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Gamepad2 className="w-5 h-5 text-purple-400" />
                  <span className="font-semibold text-purple-300">AI Agent 正在生成游戏</span>
                  {progress.currentTurn && progress.maxTurns && (
                    <span className="ml-auto text-sm text-purple-300 bg-purple-900/50 px-2 py-0.5 rounded-full">
                      轮次 {progress.currentTurn}/{progress.maxTurns}
                    </span>
                  )}
                </div>

                {/* 当前节点进度 */}
                {progress.currentNode && (
                  <div className="mb-4 p-3 bg-gray-800/60 rounded-lg border border-purple-700/30">
                    <div className="flex items-center gap-2 text-sm">
                      <Sparkles className="w-4 h-4 text-amber-400" />
                      <span className="text-gray-400">正在处理：</span>
                      <span className="font-medium text-purple-300">{progress.currentNode}</span>
                    </div>
                    {progress.completedNodes !== undefined && progress.totalNodes && (
                      <div className="mt-2 flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-purple-900/50 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-purple-500 to-blue-500 transition-all duration-300"
                            style={{ width: `${(progress.completedNodes / progress.totalNodes) * 100}%` }}
                          />
                        </div>
                        <span className="text-xs text-purple-400">{progress.completedNodes}/{progress.totalNodes}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Agent 思考过程 */}
                {progress.thinking && progress.thinking.length > 0 && (
                  <div className="mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Brain className="w-4 h-4 text-blue-400" />
                      <span className="text-sm font-medium text-blue-300">Agent 思考</span>
                    </div>
                    <div className="space-y-2 max-h-32 overflow-y-auto">
                      {progress.thinking.slice(-3).map((thought, i) => (
                        <div key={i} className="text-sm text-gray-300 bg-gray-800/80 p-2 rounded border-l-2 border-blue-500">
                          {thought.length > 150 ? thought.slice(0, 150) + '...' : thought}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 生成步骤 */}
                {progress.steps && progress.steps.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Code className="w-4 h-4 text-green-400" />
                      <span className="text-sm font-medium text-green-300">生成步骤</span>
                    </div>
                    <div className="space-y-1.5">
                      {progress.steps.slice(-4).map((step, i) => (
                        <div key={i} className="flex items-start gap-2 text-sm">
                          <CheckCircle className="w-3.5 h-3.5 text-green-400 mt-0.5 flex-shrink-0" />
                          <span className="text-gray-300">
                            {step.length > 80 ? step.slice(0, 80) + '...' : step}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 详细信息 */}
                {progress.details && !progress.thinking?.length && !progress.steps?.length && (
                  <div className="text-sm text-purple-300 bg-gray-800/60 p-3 rounded-lg">
                    {progress.details}
                  </div>
                )}
              </div>
            )}

            {/* 非游戏阶段的详细信息 */}
            {progress.stage !== 'games' && progress.details && (
              <div className="bg-blue-900/30 border border-blue-700/50 rounded-lg p-3">
                <p className="text-sm text-blue-300">
                  <span className="font-medium">详细进度：</span>
                  {progress.details}
                </p>
              </div>
            )}
          </div>
        )}

        {/* 成功结果 */}
        {status === 'success' && result && (
          <div className="space-y-4">
            <div className="flex items-center justify-center gap-3">
              {getStatusIcon()}
              <span className="text-lg font-medium text-green-400">处理完成！</span>
            </div>

            <div className="bg-green-900/30 border border-green-700/50 p-4 rounded-lg text-center">
              <p className="text-gray-200">
                视频 <strong>{result.videoId}</strong> 已处理完成
              </p>
              <p className="text-gray-300 mt-1">
                共生成 <strong>{result.nodeCount}</strong> 个知识点节点
                {result.gameCount !== undefined && result.gameCount > 0 && (
                  <span>、<strong>{result.gameCount}</strong> 个互动游戏</span>
                )}
              </p>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={handleReset}>
                继续上传
              </Button>
              <Button
                className="flex-1"
                onClick={() => window.open(`/watch/${result.videoId}`, '_blank')}
              >
                查看视频
              </Button>
              {result.gameCount !== undefined && result.gameCount > 0 && (
                <Button
                  className="flex-1 bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600"
                  onClick={() => setShowGamePreview(true)}
                >
                  <Gamepad2 className="w-4 h-4 mr-2" />
                  预览游戏
                </Button>
              )}
            </div>
          </div>
        )}

        {/* 错误结果 */}
        {status === 'error' && (
          <div className="space-y-4">
            <div className="flex items-center justify-center gap-3">
              {getStatusIcon()}
              <span className="text-lg font-medium text-red-400">处理失败</span>
            </div>

            <div className="bg-red-900/30 border border-red-700/50 p-4 rounded-lg text-center">
              <p className="text-red-400">{error}</p>
            </div>

            <Button variant="outline" className="w-full" onClick={handleReset}>
              重试
            </Button>
          </div>
        )}
      </CardContent>

      {/* 游戏预览面板 */}
      {showGamePreview && result && (
        <GamePreviewPanel
          videoId={result.videoId}
          videoTitle={title || file?.name || result.videoId}
          onClose={() => setShowGamePreview(false)}
        />
      )}
    </Card>
  )
}
