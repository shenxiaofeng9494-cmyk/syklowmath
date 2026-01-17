// 测试视频数据
// 用户需要将自己的视频文件放到 public/videos/ 目录下

export interface Video {
  id: string;
  title: string;
  description: string;
  videoUrl: string;
  thumbnailUrl?: string;
  duration: number; // 秒
  teacher: string;
  // 模拟字幕数据
  subtitles: SubtitleCue[];
}

export interface SubtitleCue {
  start: number; // 开始时间（秒）
  end: number;   // 结束时间（秒）
  text: string;
}

// 测试视频列表
// 请将你的视频文件命名为 demo.mp4 并放到 public/videos/ 目录
export const videos: Video[] = [
  {
    id: "demo",
    title: "一元二次方程的定义",
    description: "了解一元二次方程的定义，学会判断一个方程是否为一元二次方程，掌握整式方程、化简、二次项系数等关键概念",
    videoUrl: "/videos/demo.mp4",
    duration: 307, // 约5分钟
    teacher: "数学老师",
    // 字幕现在通过 Whisper API 自动生成，这里保留空数组作为后备
    subtitles: [],
  },
];

// 根据 ID 获取视频
export function getVideoById(id: string): Video | undefined {
  return videos.find((v) => v.id === id);
}

// 获取当前字幕上下文（前后30秒内的字幕）
export function getSubtitleContext(
  subtitles: SubtitleCue[],
  currentTime: number,
  windowSeconds: number = 30
): string {
  const startTime = Math.max(0, currentTime - windowSeconds);

  return subtitles
    .filter((cue) => cue.start >= startTime && cue.start <= currentTime)
    .map((cue) => cue.text)
    .join(" ");
}

// 获取当前字幕
export function getCurrentSubtitle(
  subtitles: SubtitleCue[],
  currentTime: number
): string {
  const cue = subtitles.find(
    (c) => currentTime >= c.start && currentTime <= c.end
  );
  return cue?.text || "";
}
