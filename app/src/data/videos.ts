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
  {
    id: "linear-function",
    title: "一次函数",
    description: "了解一次函数的定义 y=kx+b，理解正比例函数是特殊的一次函数，掌握一次函数的图像和性质",
    videoUrl: "/videos/linear-function.mp4",
    duration: 1593, // 26分33秒
    teacher: "数学老师",
    subtitles: [],
  },
];

// 根据 ID 获取视频
export function getVideoById(id: string): Video | undefined {
  return videos.find((v) => v.id === id);
}

// 分层字幕上下文结构
export interface LayeredSubtitleContext {
  // 最近几秒的内容（学生说"这个"最可能指的内容）
  recent: string;
  // 背景上下文（更长时间窗口的内容）
  background: string;
  // 格式化后的完整上下文（用于传给AI）
  formatted: string;
}

// 获取当前字幕上下文（分层：最近5秒精准 + 前30秒背景）
export function getSubtitleContext(
  subtitles: SubtitleCue[],
  currentTime: number,
  recentSeconds: number = 5,
  backgroundSeconds: number = 30
): string {
  const layered = getLayeredSubtitleContext(subtitles, currentTime, recentSeconds, backgroundSeconds);
  return layered.formatted;
}

// 获取分层字幕上下文
export function getLayeredSubtitleContext(
  subtitles: SubtitleCue[],
  currentTime: number,
  recentSeconds: number = 5,
  backgroundSeconds: number = 30
): LayeredSubtitleContext {
  const recentStart = Math.max(0, currentTime - recentSeconds);
  const backgroundStart = Math.max(0, currentTime - backgroundSeconds);

  // 最近几秒的字幕（精准匹配"这个"）
  const recentCues = subtitles
    .filter((cue) => cue.start >= recentStart && cue.start <= currentTime)
    .map((cue) => cue.text)
    .join(" ");

  // 背景上下文（排除最近几秒，避免重复）
  const backgroundCues = subtitles
    .filter((cue) => cue.start >= backgroundStart && cue.start < recentStart)
    .map((cue) => cue.text)
    .join(" ");

  // 格式化输出
  let formatted = "";

  if (recentCues) {
    formatted += `【刚才说的】（最近${recentSeconds}秒，学生说"这个"很可能指这里）\n${recentCues}`;
  }

  if (backgroundCues) {
    if (formatted) formatted += "\n\n";
    formatted += `【前面的内容】（背景信息）\n${backgroundCues}`;
  }

  return {
    recent: recentCues,
    background: backgroundCues,
    formatted: formatted || "(暂无字幕内容)",
  };
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
