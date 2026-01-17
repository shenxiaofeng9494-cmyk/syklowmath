import Link from "next/link";
import { videos as fallbackVideos } from "@/data/videos";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Video as DBVideo } from "@/types/database";

// 视频数据格式（兼容旧格式）
interface Video {
  id: string;
  title: string;
  description: string;
  videoUrl: string;
  duration: number;
  teacher: string;
}

// 获取所有视频（包括 Supabase 和硬编码的）
async function getAllVideos(): Promise<Video[]> {
  try {
    // 从 Supabase 获取已上传的视频
    const { data, error } = await supabase
      .from('videos')
      .select('*')
      .eq('status', 'ready')
      .order('created_at', { ascending: false })

    const supabaseVideos: Video[] = (data || []).map((v: DBVideo) => ({
      id: v.id,
      title: v.title,
      description: v.description || '',
      videoUrl: v.video_url,
      duration: v.duration,
      teacher: v.teacher || '数学老师',
    }))

    // 合并 Supabase 视频和硬编码的 fallback 视频
    const allVideos = [
      ...supabaseVideos,
      ...fallbackVideos.map(v => ({
        id: v.id,
        title: v.title,
        description: v.description,
        videoUrl: v.videoUrl,
        duration: v.duration,
        teacher: v.teacher,
      }))
    ]

    return allVideos
  } catch (error) {
    console.error('Failed to fetch videos:', error)
    // 如果 Supabase 查询失败，回退到硬编码数据
    return fallbackVideos.map(v => ({
      id: v.id,
      title: v.title,
      description: v.description,
      videoUrl: v.videoUrl,
      duration: v.duration,
      teacher: v.teacher,
    }))
  }
}

export default async function Home() {
  const videos = await getAllVideos()
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold text-blue-600">MathTalkTV</h1>
          <p className="text-sm text-gray-500">对话式数学视频学习平台</p>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Hero Section */}
        <section className="text-center mb-12">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            看视频学数学，随时提问
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            遇到不懂的地方？暂停视频，用语音提问，AI老师立刻为你解答
          </p>
        </section>

        {/* Video List */}
        <section>
          <h3 className="text-2xl font-semibold text-gray-800 mb-6">
            开始学习
          </h3>

          {videos.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-lg border-2 border-dashed">
              <p className="text-gray-500 mb-4">暂无视频</p>
              <p className="text-sm text-gray-400">
                请将视频文件放到 public/videos/ 目录
              </p>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {videos.map((video) => (
                <Link key={video.id} href={`/watch/${video.id}`}>
                  <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
                    {/* Video Thumbnail Placeholder */}
                    <div className="aspect-video bg-gradient-to-br from-blue-100 to-blue-200 rounded-t-lg flex items-center justify-center">
                      <div className="text-6xl">📐</div>
                    </div>
                    <CardHeader>
                      <CardTitle className="text-lg">{video.title}</CardTitle>
                      <CardDescription className="flex items-center gap-2">
                        <span className="text-blue-600">{video.teacher}</span>
                        <span>·</span>
                        <span>{Math.floor(video.duration / 60)}分钟</span>
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-gray-600 line-clamp-2">
                        {video.description}
                      </p>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Features Section */}
        <section className="mt-16 grid gap-8 md:grid-cols-3">
          <div className="text-center p-6">
            <div className="text-4xl mb-4">🎤</div>
            <h4 className="font-semibold text-lg mb-2">语音提问</h4>
            <p className="text-gray-600 text-sm">
              看视频时随时暂停，用语音提出你的疑问
            </p>
          </div>
          <div className="text-center p-6">
            <div className="text-4xl mb-4">🤖</div>
            <h4 className="font-semibold text-lg mb-2">AI即时回答</h4>
            <p className="text-gray-600 text-sm">
              AI老师用语音回答，就像真人老师在旁边
            </p>
          </div>
          <div className="text-center p-6">
            <div className="text-4xl mb-4">📝</div>
            <h4 className="font-semibold text-lg mb-2">画板演示</h4>
            <p className="text-gray-600 text-sm">
              AI可以在画板上写公式、画图形，帮你理解
            </p>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t mt-16 py-8 text-center text-gray-500 text-sm">
        <p>MathTalkTV MVP - 对话式数学视频学习平台</p>
      </footer>
    </div>
  );
}
