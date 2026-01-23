import Link from 'next/link'
import { VideoUploader } from '@/components/video-upload/VideoUploader'
import { ArrowLeft, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function AdminPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/" className="text-gray-500 hover:text-gray-700">
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-800">视频管理</h1>
                <p className="text-sm text-gray-500">上传和处理教学视频</p>
              </div>
            </div>
            <Link href="/teacher">
              <Button variant="outline">
                <Settings className="h-4 w-4 mr-2" />
                老师端管理
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        <VideoUploader />

        {/* Help Section */}
        <div className="mt-12 max-w-2xl mx-auto">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">处理流程说明</h3>

          <div className="space-y-4">
            <div className="flex gap-4 items-start">
              <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold flex-shrink-0">
                1
              </div>
              <div>
                <h4 className="font-medium">上传视频</h4>
                <p className="text-sm text-gray-600">
                  视频文件上传至阿里云 OSS 对象存储
                </p>
              </div>
            </div>

            <div className="flex gap-4 items-start">
              <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold flex-shrink-0">
                2
              </div>
              <div>
                <h4 className="font-medium">语音识别</h4>
                <p className="text-sm text-gray-600">
                  调用阿里云 Paraformer-v2 模型生成带时间戳的字幕（支持词级精度）
                </p>
              </div>
            </div>

            <div className="flex gap-4 items-start">
              <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold flex-shrink-0">
                3
              </div>
              <div>
                <h4 className="font-medium">知识点切分</h4>
                <p className="text-sm text-gray-600">
                  使用 GPT-4o-mini 基于教学环节智能切分为知识点节点
                </p>
              </div>
            </div>

            <div className="flex gap-4 items-start">
              <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold flex-shrink-0">
                4
              </div>
              <div>
                <h4 className="font-medium">向量化存储</h4>
                <p className="text-sm text-gray-600">
                  使用阿里云 text-embedding-v3 生成节点向量，存入 Supabase pgvector
                </p>
              </div>
            </div>

            <div className="flex gap-4 items-start">
              <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center font-bold flex-shrink-0">
                5
              </div>
              <div>
                <h4 className="font-medium">游戏生成（可选）</h4>
                <p className="text-sm text-gray-600">
                  使用 Claude Agent SDK 为每个知识点生成互动数学游戏
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
