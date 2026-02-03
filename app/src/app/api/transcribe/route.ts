import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { transcribeWithAliyun, SubtitleData } from "@/lib/aliyun-asr";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

interface WhisperSegment {
  id: number;
  seek: number;
  start: number;
  end: number;
  text: string;
  tokens: number[];
  temperature: number;
  avg_logprob: number;
  compression_ratio: number;
  no_speech_prob: number;
}

interface WhisperResponse {
  task: string;
  language: string;
  duration: number;
  text: string;
  segments: WhisperSegment[];
}

/**
 * 使用 OpenAI Whisper 转写（本地文件）
 */
async function transcribeWithWhisper(videoId: string): Promise<SubtitleData> {
  if (!OPENAI_API_KEY) {
    throw new Error("Missing OpenAI API key");
  }

  const videoPath = path.join(process.cwd(), "public", "videos", `${videoId}.mp4`);

  try {
    await fs.access(videoPath);
  } catch {
    throw new Error("Video file not found");
  }

  const videoBuffer = await fs.readFile(videoPath);
  const videoBlob = new Blob([videoBuffer], { type: "video/mp4" });

  const formData = new FormData();
  formData.append("file", videoBlob, `${videoId}.mp4`);
  formData.append("model", "whisper-1");
  formData.append("language", "zh");
  formData.append("response_format", "verbose_json");
  formData.append("timestamp_granularities[]", "segment");

  console.log(`[Whisper] Transcribing video: ${videoId}`);

  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("Whisper API error:", error);
    throw new Error("Failed to transcribe video with Whisper");
  }

  const result: WhisperResponse = await response.json();

  const subtitles = result.segments.map((seg) => ({
    start: seg.start,
    end: seg.end,
    text: seg.text.trim(),
  }));

  return {
    videoId,
    language: result.language,
    duration: result.duration,
    fullText: result.text,
    subtitles,
  };
}

/**
 * POST /api/transcribe
 * 转写视频为字幕
 *
 * Body:
 * - videoId: 视频 ID（必需）
 * - fileUrl: 公网可访问的视频 URL（可选，用于阿里云 ASR）
 * - provider: "aliyun" | "whisper"（可选，默认自动选择）
 */
export async function POST(req: NextRequest) {
  try {
    const { videoId, fileUrl, provider } = await req.json();

    if (!videoId) {
      return NextResponse.json(
        { error: "Missing videoId" },
        { status: 400 }
      );
    }

    // 检查是否有缓存的字幕
    const cacheDir = path.join(process.cwd(), "public", "subtitles");
    const cachePath = path.join(cacheDir, `${videoId}.json`);

    try {
      const cached = await fs.readFile(cachePath, "utf-8");
      console.log(`Using cached subtitles for ${videoId}`);
      return NextResponse.json(JSON.parse(cached));
    } catch {
      // 缓存不存在，继续生成
    }

    let subtitleData: SubtitleData;

    // 根据 provider 选择转写服务
    const useAliyun = provider === "aliyun" || (fileUrl && provider !== "whisper");

    if (useAliyun) {
      // 使用阿里云 ASR（需要公网 URL）
      if (!fileUrl) {
        return NextResponse.json(
          { error: "fileUrl is required for Aliyun ASR. Provide a publicly accessible URL." },
          { status: 400 }
        );
      }

      console.log(`[Transcribe] Using Aliyun ASR for ${videoId}`);
      subtitleData = await transcribeWithAliyun(videoId, fileUrl);
    } else {
      // 使用 Whisper（本地文件）
      // 如果没有 API key，返回空字幕而不是报错
      if (!OPENAI_API_KEY) {
        console.log(`[Transcribe] No OpenAI API key configured, returning empty subtitles for ${videoId}`);
        return NextResponse.json({
          videoId,
          language: "zh",
          duration: 0,
          fullText: "",
          subtitles: [],
        });
      }
      console.log(`[Transcribe] Using OpenAI Whisper for ${videoId}`);
      subtitleData = await transcribeWithWhisper(videoId);
    }

    // 缓存字幕
    try {
      await fs.mkdir(cacheDir, { recursive: true });
      await fs.writeFile(cachePath, JSON.stringify(subtitleData, null, 2));
      console.log(`Cached subtitles to ${cachePath}`);
    } catch (e) {
      console.error("Failed to cache subtitles:", e);
    }

    return NextResponse.json(subtitleData);
  } catch (error) {
    console.error("Transcription error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
