'use client'

import { useState, useRef, useCallback } from 'react'
import { Upload, FileVideo, Loader2, CheckCircle, XCircle, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'

interface ProcessProgress {
  stage: string
  progress: number
  message: string
}

type UploadStatus = 'idle' | 'uploading' | 'processing' | 'success' | 'error'

export function VideoUploader() {
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [teacher, setTeacher] = useState('')
  const [status, setStatus] = useState<UploadStatus>('idle')
  const [progress, setProgress] = useState<ProcessProgress | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ videoId: string; nodeCount: number } | null>(null)

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
                const match = data.message.match(/(\d+)/)
                if (match) {
                  nodeCount = parseInt(match[1])
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
        setResult({ videoId, nodeCount })
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
              className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
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
                  <p className="text-sm text-gray-500">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <Upload className="h-12 w-12 mx-auto text-gray-400" />
                  <p className="text-gray-600">点击或拖拽视频文件到这里</p>
                  <p className="text-sm text-gray-400">支持 MP4, WebM, MOV 格式</p>
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
            </div>

            {/* 错误提示 */}
            {error && (
              <div className="flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-lg">
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

            <p className="text-center text-gray-600">{progress.message}</p>
          </div>
        )}

        {/* 成功结果 */}
        {status === 'success' && result && (
          <div className="space-y-4">
            <div className="flex items-center justify-center gap-3">
              {getStatusIcon()}
              <span className="text-lg font-medium text-green-600">处理完成！</span>
            </div>

            <div className="bg-green-50 p-4 rounded-lg text-center">
              <p className="text-gray-700">
                视频 <strong>{result.videoId}</strong> 已处理完成
              </p>
              <p className="text-gray-600 mt-1">
                共生成 <strong>{result.nodeCount}</strong> 个知识点节点
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
            </div>
          </div>
        )}

        {/* 错误结果 */}
        {status === 'error' && (
          <div className="space-y-4">
            <div className="flex items-center justify-center gap-3">
              {getStatusIcon()}
              <span className="text-lg font-medium text-red-600">处理失败</span>
            </div>

            <div className="bg-red-50 p-4 rounded-lg text-center">
              <p className="text-red-600">{error}</p>
            </div>

            <Button variant="outline" className="w-full" onClick={handleReset}>
              重试
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
