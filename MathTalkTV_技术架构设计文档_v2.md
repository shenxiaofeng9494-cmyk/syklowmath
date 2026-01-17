# MathTalkTV 技术架构设计文档

> **设计原则：Buy over Build** — 优先采购最佳现成组件，最小化自研，快速验证产品价值。

---

## 1. 产品概述

MathTalkTV 是一个对话式视频教学平台，核心体验是让学生在观看数学视频时可以**随时打断提问**，AI 用教师声音实时回答，并能在画板上推导公式、在 IDE 中演示代码。

### 1.1 核心功能

| 功能 | 描述 |
|------|------|
| 视频播放 | 播放教学视频，同步显示字幕 |
| 语音提问 | 学生语音提问，自动暂停视频 |
| AI 回答 | 理解上下文，用教师克隆声音实时回答 |
| 画板演示 | 公式推导、函数图像、几何绘图 |
| 代码演示 | Python 代码实时执行演示 |
| 学习追踪 | 记录困惑点，生成学习报告 |

---

## 2. 系统架构概览

### 2.1 架构图

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           【客户端】                                      │
│                     Vercel 托管的 Next.js 应用                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │ 视频播放器    │  │ 语音交互UI    │ │  画板组件     │  │  代码IDE     │     │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘     │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        │                       │                       │
        ▼                       ▼                       ▼
┌───────────────┐      ┌───────────────┐       ┌───────────────┐
│   Supabase    │      │    OpenAI     │       │  Cloudflare   │
│ Auth + DB +   │      │  Realtime API │       │ Stream + R2   │
│   Realtime    │      │  (语音全链路)   │       │  (视频CDN)     │
└───────────────┘      └───────────────┘       └───────────────┘
```

### 2.2 核心设计决策

**🎯 关键简化：用 OpenAI Realtime API 替代 ASR + LLM + TTS 三件套**

| 之前（分离方案） | 现在（统一方案） |
|-----------------|-----------------|
| 讯飞 ASR → Claude → ElevenLabs TTS | OpenAI Realtime API 一站式 |
| 3 个服务商，3 次 API 调用 | 1 个 WebSocket 连接 |
| 延迟 800-1200ms | 延迟 ~300ms |
| 需要自己处理流式拼接 | 原生支持打断、VAD |

---

## 3. 技术组件采购清单

### 3.1 基础设施层

| 能力 | 推荐方案 | 价格参考 | 为什么选它 |
|------|----------|----------|------------|
| **前端框架** | Next.js 14 | 免费 | React 生态，TypeScript |
| **前端托管** | Vercel | 免费起步 | Next.js 原生支持，全球 CDN |
| **后端服务** | Supabase | $25/月 Pro | Auth + DB + Realtime 一站式 |
| **视频托管** | Cloudflare Stream | $5/1000分钟 | 自适应码率，全球加速 |
| **对象存储** | Cloudflare R2 | $0.015/GB | 无出口费用 |

### 3.2 AI 服务层（核心简化）

| 能力 | 方案 | 价格参考 | 说明 |
|------|------|----------|------|
| **语音交互全链路** | OpenAI Realtime API | ~$0.30/分钟对话 | ASR + LLM + TTS 一体化 |
| **声音克隆** | OpenAI Custom Voices | 包含在上述价格 | 30秒样本，每组织20个声音 |
| **公式渲染** | KaTeX | 免费 | 轻量快速 |
| **函数图形** | Desmos API | 免费 | 最专业的数学图形 |
| **代码执行** | Pyodide (WASM) | 免费 | 纯前端 Python |

### 3.3 辅助服务

| 能力 | 方案 | 价格参考 |
|------|------|----------|
| **埋点分析** | PostHog Cloud | 免费起步 |
| **错误监控** | Sentry | 免费起步 |
| **短信验证** | 阿里云 SMS | ¥0.045/条 |

---

## 4. 核心模块设计

### 4.1 视频播放模块

**采购组件**：Cloudflare Stream Player

```tsx
// components/video-player/VideoPlayer.tsx
import { useRef, useEffect, useState } from 'react';
import { Stream } from '@cloudflare/stream-react';

interface VideoPlayerProps {
  videoId: string;
  subtitleUrl: string;
  onTimeUpdate: (time: number, subtitle: string) => void;
  onInteractionStart: () => void;
  onInteractionEnd: () => void;
}

export function VideoPlayer({ 
  videoId, 
  subtitleUrl,
  onTimeUpdate,
  onInteractionStart,
  onInteractionEnd 
}: VideoPlayerProps) {
  const streamRef = useRef<HTMLStreamElement>(null);
  const [subtitles, setSubtitles] = useState<SubtitleCue[]>([]);
  
  // 加载字幕文件
  useEffect(() => {
    fetch(subtitleUrl)
      .then(res => res.text())
      .then(vtt => setSubtitles(parseVTT(vtt)));
  }, [subtitleUrl]);
  
  // 时间更新时查找当前字幕
  const handleTimeUpdate = (time: number) => {
    const currentSubtitle = subtitles.find(
      cue => time >= cue.start && time <= cue.end
    );
    onTimeUpdate(time, currentSubtitle?.text || '');
  };

  return (
    <div className="relative aspect-video">
      <Stream
        ref={streamRef}
        src={videoId}
        controls
        onTimeUpdate={(e) => handleTimeUpdate(e.target.currentTime)}
      />
      {/* 提问按钮 */}
      <button
        className="absolute bottom-20 right-4 bg-blue-500 text-white px-4 py-2 rounded-full"
        onClick={() => {
          streamRef.current?.pause();
          onInteractionStart();
        }}
      >
        🎤 提问
      </button>
    </div>
  );
}
```

**字幕上下文管理**：

```typescript
// lib/subtitle-context.ts
export function getSubtitleContext(
  subtitles: SubtitleCue[],
  currentTime: number,
  windowSeconds: number = 30
): string {
  const startTime = Math.max(0, currentTime - windowSeconds);
  
  return subtitles
    .filter(cue => cue.start >= startTime && cue.start <= currentTime)
    .map(cue => cue.text)
    .join(' ');
}
```

---

### 4.2 语音交互模块（OpenAI Realtime API）

**这是核心模块，用一个 API 实现 ASR + LLM + TTS 全链路。**

#### 4.2.1 架构流程

```
┌──────────────────────────────────────────────────────────────────┐
│                     OpenAI Realtime API                          │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐       │
│  │   ASR   │ -> │   LLM   │ -> │   TTS   │ -> │ 音频流  │       │
│  │ (转写)  │    │ (推理)  │    │(克隆声) │    │  输出   │       │
│  └─────────┘    └─────────┘    └─────────┘    └─────────┘       │
└──────────────────────────────────────────────────────────────────┘
        ▲                                              │
        │ WebSocket (双向音频流)                        │
        │                                              ▼
┌───────────────────────────────────────────────────────────────────┐
│                         浏览器                                     │
│   麦克风 ──> 音频采集 ──> 发送                  接收 ──> 播放扬声器  │
└───────────────────────────────────────────────────────────────────┘
```

#### 4.2.2 创建 Realtime 会话

```typescript
// lib/openai-realtime.ts
import { RealtimeClient } from '@openai/realtime-api-beta';

const SYSTEM_PROMPT = `你是一位经验丰富的初中数学老师，正在为学生进行一对一答疑。

## 角色设定
- 说话风格亲切、耐心，像邻家大姐姐
- 用学生能理解的语言解释概念
- 善于用生活例子帮助理解抽象概念

## 回答原则
1. 针对性：只回答学生问的问题，不发散
2. 简洁性：控制在 30 秒内能说完（约 100-150 字）
3. 确认理解：回答后简单确认"听懂了吗？"

## 工具使用
当需要可视化展示时，调用对应工具：
- use_whiteboard: 公式推导、函数图像、几何图形
- use_code_demo: 数值计算、算法演示

## 当前上下文
学生正在观看数学视频，可能会针对视频内容提问。`;

// 工具定义
const TOOLS = [
  {
    type: 'function',
    name: 'use_whiteboard',
    description: '在画板上展示数学内容（公式推导、函数图像、几何图形）',
    parameters: {
      type: 'object',
      properties: {
        content_type: {
          type: 'string',
          enum: ['formula', 'graph', 'geometry'],
          description: '内容类型'
        },
        latex: {
          type: 'string',
          description: 'LaTeX 公式，用于 formula 类型'
        },
        expression: {
          type: 'string',
          description: 'Desmos 表达式，用于 graph 类型，如 y=x^2'
        },
        steps: {
          type: 'array',
          items: { type: 'string' },
          description: '分步骤展示的内容'
        }
      },
      required: ['content_type']
    }
  },
  {
    type: 'function',
    name: 'use_code_demo',
    description: '在 IDE 中演示 Python 代码执行',
    parameters: {
      type: 'object',
      properties: {
        code: {
          type: 'string',
          description: 'Python 代码'
        },
        explanation: {
          type: 'string',
          description: '代码解释'
        }
      },
      required: ['code']
    }
  }
];

export interface RealtimeSessionConfig {
  teacherVoiceId?: string;  // 教师克隆声音 ID
  videoContext?: string;     // 视频字幕上下文
}

export async function createRealtimeSession(config: RealtimeSessionConfig) {
  const client = new RealtimeClient({
    apiKey: process.env.OPENAI_API_KEY,
  });

  // 配置会话
  await client.updateSession({
    instructions: SYSTEM_PROMPT + (config.videoContext 
      ? `\n\n【当前视频内容】\n${config.videoContext}` 
      : ''),
    voice: config.teacherVoiceId || 'alloy',  // 使用教师克隆声音或默认声音
    input_audio_transcription: { model: 'whisper-1' },
    turn_detection: { 
      type: 'server_vad',  // 服务端语音活动检测
      threshold: 0.5,
      prefix_padding_ms: 300,
      silence_duration_ms: 500,
    },
    tools: TOOLS,
  });

  return client;
}
```

#### 4.2.3 React Hook 封装

```typescript
// hooks/useRealtimeVoice.ts
import { useState, useCallback, useRef, useEffect } from 'react';
import { RealtimeClient } from '@openai/realtime-api-beta';

interface UseRealtimeVoiceOptions {
  teacherVoiceId?: string;
  onTranscript?: (text: string, isFinal: boolean) => void;
  onAnswer?: (text: string) => void;
  onToolCall?: (tool: string, params: any) => void;
  onAudioOutput?: (audio: ArrayBuffer) => void;
}

export function useRealtimeVoice(options: UseRealtimeVoiceOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const clientRef = useRef<RealtimeClient | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  // 初始化连接
  const connect = useCallback(async (videoContext?: string) => {
    const client = new RealtimeClient({
      apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY,
      dangerouslyAllowAPIKeyInBrowser: true, // 生产环境应使用后端代理
    });

    // 事件监听
    client.on('conversation.updated', (event) => {
      const { item } = event;
      
      // 用户语音转写
      if (item.type === 'message' && item.role === 'user') {
        const transcript = item.formatted.transcript || '';
        setTranscript(transcript);
        options.onTranscript?.(transcript, item.status === 'completed');
      }
      
      // AI 回答文本
      if (item.type === 'message' && item.role === 'assistant') {
        const text = item.formatted.text || '';
        options.onAnswer?.(text);
      }
    });

    // 工具调用
    client.on('conversation.item.completed', (event) => {
      const { item } = event;
      if (item.type === 'function_call') {
        options.onToolCall?.(item.name, JSON.parse(item.arguments));
      }
    });

    // 音频输出
    client.on('response.audio.delta', (event) => {
      const audioData = base64ToArrayBuffer(event.delta);
      options.onAudioOutput?.(audioData);
    });

    await client.connect();
    
    // 更新会话配置
    await client.updateSession({
      instructions: SYSTEM_PROMPT + (videoContext 
        ? `\n\n【当前视频内容】\n${videoContext}` 
        : ''),
      voice: options.teacherVoiceId || 'alloy',
      tools: TOOLS,
    });

    clientRef.current = client;
    setIsConnected(true);
  }, [options]);

  // 开始录音
  const startListening = useCallback(async () => {
    if (!clientRef.current) return;

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioContextRef.current = new AudioContext({ sampleRate: 24000 });
    
    const source = audioContextRef.current.createMediaStreamSource(stream);
    const processor = audioContextRef.current.createScriptProcessor(4096, 1, 1);
    
    processor.onaudioprocess = (e) => {
      const inputData = e.inputBuffer.getChannelData(0);
      const pcm16 = floatTo16BitPCM(inputData);
      clientRef.current?.appendInputAudio(pcm16);
    };
    
    source.connect(processor);
    processor.connect(audioContextRef.current.destination);
    
    setIsListening(true);
  }, []);

  // 停止录音
  const stopListening = useCallback(() => {
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    clientRef.current?.createResponse();  // 触发 AI 响应
    setIsListening(false);
  }, []);

  // 更新视频上下文
  const updateContext = useCallback((videoContext: string) => {
    clientRef.current?.updateSession({
      instructions: SYSTEM_PROMPT + `\n\n【当前视频内容】\n${videoContext}`,
    });
  }, []);

  // 断开连接
  const disconnect = useCallback(() => {
    clientRef.current?.disconnect();
    clientRef.current = null;
    setIsConnected(false);
  }, []);

  return {
    isConnected,
    isListening,
    transcript,
    connect,
    startListening,
    stopListening,
    updateContext,
    disconnect,
  };
}

// 工具函数
function floatTo16BitPCM(float32Array: Float32Array): ArrayBuffer {
  const buffer = new ArrayBuffer(float32Array.length * 2);
  const view = new DataView(buffer);
  for (let i = 0; i < float32Array.length; i++) {
    const s = Math.max(-1, Math.min(1, float32Array[i]));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return buffer;
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}
```

#### 4.2.4 语音交互组件

```tsx
// components/voice-interaction/VoiceInteraction.tsx
import { useState, useRef, useEffect } from 'react';
import { useRealtimeVoice } from '@/hooks/useRealtimeVoice';
import { Whiteboard } from '../whiteboard/Whiteboard';
import { CodeDemo } from '../code-demo/CodeDemo';

interface VoiceInteractionProps {
  videoContext: string;
  teacherVoiceId?: string;
  onComplete: () => void;  // 回答完成，继续播放视频
}

export function VoiceInteraction({ 
  videoContext, 
  teacherVoiceId,
  onComplete 
}: VoiceInteractionProps) {
  const [status, setStatus] = useState<'idle' | 'listening' | 'thinking' | 'speaking'>('idle');
  const [answerText, setAnswerText] = useState('');
  const [whiteboardData, setWhiteboardData] = useState<any>(null);
  const [codeDemoData, setCodeDemoData] = useState<any>(null);
  const audioQueueRef = useRef<ArrayBuffer[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);

  const {
    isConnected,
    isListening,
    transcript,
    connect,
    startListening,
    stopListening,
    disconnect,
  } = useRealtimeVoice({
    teacherVoiceId,
    onTranscript: (text, isFinal) => {
      if (isFinal) {
        setStatus('thinking');
      }
    },
    onAnswer: (text) => {
      setAnswerText(text);
      setStatus('speaking');
    },
    onToolCall: (tool, params) => {
      if (tool === 'use_whiteboard') {
        setWhiteboardData(params);
      } else if (tool === 'use_code_demo') {
        setCodeDemoData(params);
      }
    },
    onAudioOutput: (audio) => {
      // 播放 AI 语音
      playAudio(audio);
    },
  });

  // 初始化连接
  useEffect(() => {
    connect(videoContext);
    return () => disconnect();
  }, []);

  // 播放音频
  const playAudio = async (audioData: ArrayBuffer) => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext({ sampleRate: 24000 });
    }
    
    const audioBuffer = await audioContextRef.current.decodeAudioData(audioData.slice(0));
    const source = audioContextRef.current.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioContextRef.current.destination);
    source.start();
    
    source.onended = () => {
      // 检查是否还有更多音频
      if (audioQueueRef.current.length === 0) {
        setStatus('idle');
        // 延迟一下再继续视频
        setTimeout(onComplete, 1000);
      }
    };
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-6 max-w-2xl w-full mx-4 space-y-4">
        {/* 状态指示 */}
        <div className="text-center">
          {status === 'idle' && (
            <p className="text-gray-500">点击下方按钮开始提问</p>
          )}
          {status === 'listening' && (
            <div className="flex items-center justify-center gap-2">
              <span className="animate-pulse text-red-500">●</span>
              <p>正在听...</p>
            </div>
          )}
          {status === 'thinking' && (
            <p className="text-blue-500">老师正在思考...</p>
          )}
          {status === 'speaking' && (
            <p className="text-green-500">老师正在回答...</p>
          )}
        </div>

        {/* 用户问题 */}
        {transcript && (
          <div className="bg-gray-100 rounded-lg p-3">
            <p className="text-sm text-gray-500">你的问题：</p>
            <p>{transcript}</p>
          </div>
        )}

        {/* AI 回答文本 */}
        {answerText && (
          <div className="bg-blue-50 rounded-lg p-3">
            <p className="text-sm text-blue-500">老师的回答：</p>
            <p>{answerText}</p>
          </div>
        )}

        {/* 画板 */}
        {whiteboardData && (
          <Whiteboard {...whiteboardData} />
        )}

        {/* 代码演示 */}
        {codeDemoData && (
          <CodeDemo {...codeDemoData} />
        )}

        {/* 录音按钮 */}
        <div className="flex justify-center">
          {!isListening ? (
            <button
              onClick={startListening}
              disabled={!isConnected || status === 'thinking' || status === 'speaking'}
              className="w-16 h-16 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 
                         rounded-full flex items-center justify-center text-white text-2xl
                         transition-colors"
            >
              🎤
            </button>
          ) : (
            <button
              onClick={stopListening}
              className="w-16 h-16 bg-red-500 hover:bg-red-600 rounded-full 
                         flex items-center justify-center text-white text-2xl
                         animate-pulse"
            >
              ⏹
            </button>
          )}
        </div>

        {/* 关闭按钮 */}
        <button
          onClick={onComplete}
          className="w-full py-2 text-gray-500 hover:text-gray-700"
        >
          继续观看视频
        </button>
      </div>
    </div>
  );
}
```

---

### 4.3 教师声音克隆

**OpenAI Custom Voices 支持 30 秒音频样本创建克隆声音。**

```typescript
// lib/voice-clone.ts

export async function createTeacherVoice(
  teacherName: string,
  audioSample: File
): Promise<string> {
  // 转换为 base64
  const base64Audio = await fileToBase64(audioSample);
  
  const response = await fetch('https://api.openai.com/v1/audio/voices', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: `teacher_${teacherName}`,
      file: base64Audio,
      description: `${teacherName}老师的声音`,
    }),
  });

  const data = await response.json();
  return data.voice_id;  // 返回声音 ID，存储到数据库
}

// 教师配置页面使用
export async function uploadVoiceSample(file: File, teacherId: string) {
  // 验证文件
  if (file.size > 5 * 1024 * 1024) {
    throw new Error('音频文件不能超过 5MB');
  }
  
  const duration = await getAudioDuration(file);
  if (duration > 30) {
    throw new Error('音频时长不能超过 30 秒');
  }

  // 创建声音
  const voiceId = await createTeacherVoice(teacherId, file);
  
  // 保存到数据库
  await supabase
    .from('teachers')
    .update({ voice_id: voiceId })
    .eq('id', teacherId);

  return voiceId;
}
```

---

### 4.4 多模态画板模块

**采购组件**：KaTeX + Desmos API + Framer Motion

```tsx
// components/whiteboard/Whiteboard.tsx
import { motion } from 'framer-motion';
import { FormulaDisplay } from './FormulaDisplay';
import { GraphDisplay } from './GraphDisplay';

interface WhiteboardProps {
  content_type: 'formula' | 'graph' | 'geometry';
  latex?: string;
  expression?: string;
  steps?: string[];
}

export function Whiteboard({ content_type, latex, expression, steps }: WhiteboardProps) {
  if (content_type === 'formula') {
    return steps ? (
      <StepByStepFormula steps={steps} />
    ) : (
      <FormulaDisplay latex={latex || ''} />
    );
  }

  if (content_type === 'graph') {
    return <GraphDisplay expression={expression || ''} />;
  }

  return null;
}

// 公式渲染
function FormulaDisplay({ latex }: { latex: string }) {
  const html = katex.renderToString(latex, { 
    throwOnError: false,
    displayMode: true,
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white border rounded-lg p-4 text-center text-xl"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

// 分步骤公式
function StepByStepFormula({ steps }: { steps: string[] }) {
  return (
    <div className="space-y-3">
      {steps.map((step, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 1.5 }}  // 每步间隔 1.5 秒
        >
          <FormulaDisplay latex={step} />
        </motion.div>
      ))}
    </div>
  );
}

// Desmos 图形
function GraphDisplay({ expression }: { expression: string }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const calculator = Desmos.GraphingCalculator(containerRef.current, {
      expressions: false,
      settingsMenu: false,
      zoomButtons: true,
    });

    calculator.setExpression({ latex: expression });

    return () => calculator.destroy();
  }, [expression]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      ref={containerRef}
      className="h-64 rounded-lg overflow-hidden"
    />
  );
}
```

---

### 4.5 代码演示 IDE 模块

**采购组件**：Pyodide（纯前端 Python）

```tsx
// components/code-demo/CodeDemo.tsx
import { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';

interface CodeDemoProps {
  code: string;
  explanation?: string;
}

export function CodeDemo({ code, explanation }: CodeDemoProps) {
  const [output, setOutput] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const pyodideRef = useRef<any>(null);

  // 加载 Pyodide
  useEffect(() => {
    async function loadPyodide() {
      if (!window.loadPyodide) {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/pyodide/v0.24.1/full/pyodide.js';
        document.head.appendChild(script);
        await new Promise(resolve => script.onload = resolve);
      }
      pyodideRef.current = await window.loadPyodide();
      await pyodideRef.current.loadPackage(['numpy', 'sympy']);
    }
    loadPyodide();
  }, []);

  // 自动运行代码
  useEffect(() => {
    if (pyodideRef.current && code) {
      runCode();
    }
  }, [code, pyodideRef.current]);

  async function runCode() {
    if (!pyodideRef.current) return;
    
    setIsRunning(true);
    try {
      // 捕获输出
      pyodideRef.current.runPython(`
import sys
from io import StringIO
sys.stdout = StringIO()
      `);

      pyodideRef.current.runPython(code);

      const stdout = pyodideRef.current.runPython('sys.stdout.getvalue()');
      setOutput(stdout);
    } catch (error: any) {
      setOutput(`错误: ${error.message}`);
    }
    setIsRunning(false);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gray-900 rounded-lg overflow-hidden"
    >
      {/* 代码区域 */}
      <pre className="p-4 text-green-400 text-sm overflow-x-auto">
        <code>{code}</code>
      </pre>

      {/* 输出区域 */}
      {output && (
        <div className="border-t border-gray-700 p-4 bg-black">
          <p className="text-gray-500 text-xs mb-2">输出结果：</p>
          <pre className="text-white text-sm">{output}</pre>
        </div>
      )}

      {/* 解释 */}
      {explanation && (
        <div className="border-t border-gray-700 p-4 bg-gray-800">
          <p className="text-gray-300 text-sm">{explanation}</p>
        </div>
      )}

      {/* 运行按钮 */}
      <div className="p-2 bg-gray-800 flex justify-end">
        <button
          onClick={runCode}
          disabled={isRunning || !pyodideRef.current}
          className="px-3 py-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 
                     text-white text-sm rounded"
        >
          {isRunning ? '运行中...' : '▶ 重新运行'}
        </button>
      </div>
    </motion.div>
  );
}
```

---

### 4.6 用户认证（Supabase Auth）

```typescript
// lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// 手机号登录
export async function sendOTP(phone: string) {
  return supabase.auth.signInWithOtp({ phone });
}

export async function verifyOTP(phone: string, token: string) {
  return supabase.auth.verifyOtp({ phone, token, type: 'sms' });
}

// 获取当前用户
export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}
```

---

### 4.7 数据追踪（PostHog）

```typescript
// lib/analytics.ts
import posthog from 'posthog-js';

if (typeof window !== 'undefined') {
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
    api_host: 'https://app.posthog.com',
  });
}

export const analytics = {
  videoPlay: (videoId: string) => 
    posthog.capture('video_play', { video_id: videoId }),

  questionStart: (videoId: string, videoTime: number, subtitle: string) =>
    posthog.capture('question_start', { 
      video_id: videoId, 
      video_time: videoTime, 
      subtitle_context: subtitle 
    }),

  questionComplete: (questionText: string) =>
    posthog.capture('question_complete', { question_text: questionText }),

  answerComplete: (params: {
    latencyMs: number;
    toolUsed: string | null;
    answerLength: number;
  }) => posthog.capture('answer_complete', params),

  feedback: (questionId: string, rating: number) =>
    posthog.capture('feedback', { question_id: questionId, rating }),
};
```

---

## 5. 数据库设计（Supabase PostgreSQL）

```sql
-- 用户表（Supabase Auth 自动创建 auth.users）
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users PRIMARY KEY,
  phone VARCHAR(20) UNIQUE,
  nickname VARCHAR(50),
  avatar_url VARCHAR(255),
  grade INT CHECK (grade BETWEEN 7 AND 9),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 教师表
CREATE TABLE public.teachers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) NOT NULL,
  avatar_url VARCHAR(255),
  voice_id VARCHAR(100),  -- OpenAI Custom Voice ID
  voice_sample_url VARCHAR(500),  -- 原始音频样本
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 视频表
CREATE TABLE public.videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(200) NOT NULL,
  cloudflare_video_id VARCHAR(100),
  subtitle_url VARCHAR(500),
  duration INT,
  teacher_id UUID REFERENCES public.teachers(id),
  knowledge_points JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 学习会话表
CREATE TABLE public.learning_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id),
  video_id UUID REFERENCES public.videos(id),
  start_time TIMESTAMPTZ DEFAULT NOW(),
  end_time TIMESTAMPTZ,
  last_progress INT DEFAULT 0,
  question_count INT DEFAULT 0
);

-- 问答记录表
CREATE TABLE public.qa_turns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.learning_sessions(id),
  video_timestamp INT,
  subtitle_context TEXT,
  question_text TEXT,
  answer_text TEXT,
  tool_used VARCHAR(50),
  tool_params JSONB,
  latency_ms INT,
  feedback_rating INT CHECK (feedback_rating BETWEEN 1 AND 5),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_sessions_user ON public.learning_sessions(user_id);
CREATE INDEX idx_sessions_video ON public.learning_sessions(video_id);
CREATE INDEX idx_qa_session ON public.qa_turns(session_id);

-- RLS 策略
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qa_turns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can view own sessions" ON public.learning_sessions
  FOR ALL USING (auth.uid() = user_id);
```

---

## 6. 项目结构

```
mathtalktv/
├── app/                          # Next.js App Router
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── callback/page.tsx
│   ├── (main)/
│   │   ├── videos/page.tsx       # 视频列表
│   │   └── watch/[id]/page.tsx   # 视频播放页
│   ├── layout.tsx
│   └── globals.css
├── components/
│   ├── video-player/
│   │   └── VideoPlayer.tsx
│   ├── voice-interaction/
│   │   └── VoiceInteraction.tsx
│   ├── whiteboard/
│   │   ├── Whiteboard.tsx
│   │   ├── FormulaDisplay.tsx
│   │   └── GraphDisplay.tsx
│   ├── code-demo/
│   │   └── CodeDemo.tsx
│   └── ui/                       # shadcn/ui 组件
├── hooks/
│   └── useRealtimeVoice.ts       # OpenAI Realtime Hook
├── lib/
│   ├── supabase.ts
│   ├── openai-realtime.ts
│   ├── voice-clone.ts
│   ├── subtitle-context.ts
│   └── analytics.ts
├── public/
└── package.json
```

---

## 7. 环境变量

```bash
# .env.local

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx

# OpenAI
NEXT_PUBLIC_OPENAI_API_KEY=sk-xxx  # 注意：生产环境应通过后端代理
OPENAI_API_KEY=sk-xxx

# Cloudflare
CLOUDFLARE_ACCOUNT_ID=xxx
CLOUDFLARE_API_TOKEN=xxx

# PostHog
NEXT_PUBLIC_POSTHOG_KEY=phc_xxx

# 阿里云 SMS（用于验证码）
ALIYUN_ACCESS_KEY_ID=xxx
ALIYUN_ACCESS_KEY_SECRET=xxx
ALIYUN_SMS_SIGN_NAME=MathTalkTV
ALIYUN_SMS_TEMPLATE_CODE=SMS_xxx
```

---

## 8. 成本估算（MVP 阶段）

| 服务 | 月费用估算 | 说明 |
|------|------------|------|
| Vercel | $0 | Hobby 免费 |
| Supabase | $25 | Pro 套餐 |
| Cloudflare Stream | ~$20 | 1000 分钟视频存储 |
| Cloudflare R2 | ~$5 | 100GB 存储 |
| **OpenAI Realtime API** | **~$150** | 约 500 分钟对话（核心成本） |
| PostHog | $0 | 免费套餐 |
| 阿里云 SMS | ~$20 | 约 500 次验证 |
| **合计** | **~$220/月** | MVP 验证阶段 |

**成本优化提示**：
- 开启 Prompt Caching，缓存命中可降低 80% 输入成本
- 使用 `gpt-realtime-mini` 替代 `gpt-realtime` 可降低约 40% 成本
- 控制 AI 回答时长（30秒内），音频输出是最大成本项

---

## 9. 开发实施计划

### Phase 1: 基础框架（Week 1）
- [ ] 初始化 Next.js + Tailwind + shadcn/ui
- [ ] 配置 Supabase（Auth + Database）
- [ ] 实现登录/注册流程
- [ ] 部署到 Vercel

### Phase 2: 视频播放（Week 2）
- [ ] 集成 Cloudflare Stream
- [ ] 实现字幕解析和上下文管理
- [ ] 视频列表和详情页
- [ ] 播放进度保存

### Phase 3: 语音交互核心（Week 3）
- [ ] 集成 OpenAI Realtime API
- [ ] 实现 `useRealtimeVoice` Hook
- [ ] 语音交互 UI 组件
- [ ] 端到端语音对话流程

### Phase 4: 多模态展示（Week 4）
- [ ] KaTeX 公式渲染
- [ ] Desmos 图形嵌入
- [ ] Pyodide 代码执行
- [ ] Function Calling 联动

### Phase 5: 完善上线（Week 5）
- [ ] 教师声音克隆功能
- [ ] 数据埋点和反馈
- [ ] 性能优化
- [ ] Beta 测试

---

## 10. Claude Code 实施指引

```bash
# 1. 创建项目
npx create-next-app@latest mathtalktv --typescript --tailwind --app --src-dir

# 2. 安装依赖
npm install @supabase/supabase-js @openai/realtime-api-beta posthog-js katex framer-motion

# 3. 安装 UI 组件
npx shadcn@latest init
npx shadcn@latest add button card input dialog

# 4. 初始化 Supabase
npx supabase init
npx supabase db push
```

**开发顺序**：
1. 跑通登录 + 视频播放基础流程
2. 集成 OpenAI Realtime API，实现语音对话
3. 添加画板和代码演示
4. 完善数据追踪和用户反馈

---

## 11. 关键服务注册链接

| 服务 | 注册地址 |
|------|----------|
| Vercel | https://vercel.com |
| Supabase | https://supabase.com |
| OpenAI | https://platform.openai.com |
| Cloudflare | https://cloudflare.com |
| PostHog | https://posthog.com |
| 阿里云 | https://aliyun.com |

---

---

## 12. RAG 系统设计

### 12.1 整体架构

RAG（Retrieval-Augmented Generation）系统让 AI 能基于教师的课程内容回答问题，而非依赖通用知识。

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         RAG 系统架构                                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  【离线处理】教师上传视频                                                  │
│       │                                                                 │
│       ▼                                                                 │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────────────┐      │
│  │ 提取音频 │ -> │ Whisper │ -> │ 文本分段 │ -> │ Embedding向量化  │      │
│  │ (FFmpeg) │    │  转写   │    │(按知识点)│    │ (text-embedding) │      │
│  └─────────┘    └─────────┘    └─────────┘    └────────┬────────┘      │
│                                                         │               │
│                                                         ▼               │
│                                              ┌─────────────────────┐    │
│                                              │  Supabase pgvector  │    │
│                                              │    (向量存储)        │    │
│                                              └──────────┬──────────┘    │
│                                                         │               │
├─────────────────────────────────────────────────────────┼───────────────┤
│                                                         │               │
│  【在线检索】学生提问                                     │               │
│       │                                                 │               │
│       ▼                                                 ▼               │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────┐         │
│  │ 问题+上下文  │ -> │  向量检索   │ -> │ Top-K 相关片段       │         │
│  │  Embedding  │    │ (余弦相似度) │    │ + 置信度分数         │         │
│  └─────────────┘    └─────────────┘    └──────────┬──────────┘         │
│                                                    │                    │
│                                                    ▼                    │
│                                        ┌─────────────────────┐          │
│                                        │   置信度 > 阈值？    │          │
│                                        └─────────┬───────────┘          │
│                                       是 /       \ 否                   │
│                                         /         \                     │
│                              ┌─────────▼─┐    ┌───▼───────────┐        │
│                              │ RAG 回答   │    │ 通用知识回答   │        │
│                              │(引用课程)  │    │(提示非课程内容) │        │
│                              └───────────┘    └───────────────┘        │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 12.2 技术选型

| 组件 | 方案 | 说明 |
|------|------|------|
| 向量数据库 | Supabase pgvector | 与现有 Supabase 统一，免维护 |
| Embedding 模型 | OpenAI text-embedding-3-small | 性价比高，1536 维 |
| 语音转写 | OpenAI Whisper API | 支持中文，准确率高 |
| 文本分段 | 自定义规则 + LLM 辅助 | 按知识点/段落切分 |

### 12.3 数据库 Schema 扩展

```sql
-- 启用 pgvector 扩展
CREATE EXTENSION IF NOT EXISTS vector;

-- 视频转写文本表
CREATE TABLE public.video_transcripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID REFERENCES public.videos(id) ON DELETE CASCADE,
  full_text TEXT,                    -- 完整转写文本
  language VARCHAR(10) DEFAULT 'zh', -- 语言
  word_count INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 知识片段表（RAG 检索单元）
CREATE TABLE public.knowledge_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID REFERENCES public.videos(id) ON DELETE CASCADE,
  chunk_index INT,                           -- 片段序号
  content TEXT NOT NULL,                     -- 片段内容
  start_time FLOAT,                          -- 视频起始时间（秒）
  end_time FLOAT,                            -- 视频结束时间（秒）
  knowledge_point VARCHAR(200),              -- 知识点标签（如"配方法"）
  embedding VECTOR(1536),                    -- 向量嵌入
  token_count INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建向量索引（HNSW 算法，检索更快）
CREATE INDEX idx_chunks_embedding ON public.knowledge_chunks
  USING hnsw (embedding vector_cosine_ops);

-- 创建视频+序号联合索引
CREATE INDEX idx_chunks_video_order ON public.knowledge_chunks(video_id, chunk_index);
```

### 12.4 离线处理 Pipeline

```typescript
// lib/rag/video-processor.ts
import OpenAI from 'openai';
import { supabase } from '../supabase';

const openai = new OpenAI();

interface ProcessingResult {
  transcriptId: string;
  chunkCount: number;
  duration: number;
}

/**
 * 视频处理主流程
 * 触发方式：教师上传视频后，通过 Supabase Edge Function 或队列触发
 */
export async function processVideo(videoId: string, videoUrl: string): Promise<ProcessingResult> {
  const startTime = Date.now();

  // 1. 提取音频（使用 Cloudflare Workers 或 FFmpeg 服务）
  const audioUrl = await extractAudio(videoUrl);

  // 2. Whisper 转写
  const transcript = await transcribeAudio(audioUrl);

  // 3. 保存完整转写
  const { data: transcriptData } = await supabase
    .from('video_transcripts')
    .insert({
      video_id: videoId,
      full_text: transcript.text,
      word_count: transcript.text.length,
    })
    .select()
    .single();

  // 4. 智能分段
  const chunks = await splitIntoChunks(transcript);

  // 5. 批量向量化并存储
  await embedAndStoreChunks(videoId, chunks);

  // 6. 更新视频状态
  await supabase
    .from('videos')
    .update({
      processing_status: 'completed',
      processed_at: new Date().toISOString(),
    })
    .eq('id', videoId);

  return {
    transcriptId: transcriptData.id,
    chunkCount: chunks.length,
    duration: Date.now() - startTime,
  };
}

/**
 * Whisper 转写（支持长音频自动分段）
 */
async function transcribeAudio(audioUrl: string): Promise<{ text: string; segments: any[] }> {
  // 下载音频文件
  const audioResponse = await fetch(audioUrl);
  const audioBlob = await audioResponse.blob();
  const audioFile = new File([audioBlob], 'audio.mp3', { type: 'audio/mpeg' });

  const response = await openai.audio.transcriptions.create({
    file: audioFile,
    model: 'whisper-1',
    language: 'zh',
    response_format: 'verbose_json',  // 包含时间戳
    timestamp_granularities: ['segment'],
  });

  return {
    text: response.text,
    segments: response.segments || [],
  };
}

/**
 * 智能分段策略
 * - 优先按知识点边界切分
 * - 每个 chunk 控制在 200-500 token
 * - 保留前后重叠以维持上下文
 */
async function splitIntoChunks(transcript: { text: string; segments: any[] }): Promise<Chunk[]> {
  // 使用 LLM 辅助识别知识点边界
  const boundaryPrompt = `
分析以下数学教学转写文本，识别知识点切换的位置。
返回 JSON 数组，每个元素包含：
- start_segment: 起始段落索引
- end_segment: 结束段落索引
- knowledge_point: 知识点名称（如"配方法的定义"、"配方法的步骤"）

转写文本：
${transcript.text.slice(0, 4000)}
`;

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: boundaryPrompt }],
    response_format: { type: 'json_object' },
  });

  const boundaries = JSON.parse(completion.choices[0].message.content || '{"chunks":[]}');

  // 根据边界切分并添加重叠
  return createChunksWithOverlap(transcript.segments, boundaries.chunks, {
    overlapTokens: 50,
    maxTokens: 500,
  });
}

/**
 * 批量向量化并存储
 */
async function embedAndStoreChunks(videoId: string, chunks: Chunk[]): Promise<void> {
  // 批量获取 embeddings（每次最多 100 个）
  const batchSize = 100;

  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);

    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: batch.map(c => c.content),
    });

    // 准备插入数据
    const insertData = batch.map((chunk, idx) => ({
      video_id: videoId,
      chunk_index: i + idx,
      content: chunk.content,
      start_time: chunk.startTime,
      end_time: chunk.endTime,
      knowledge_point: chunk.knowledgePoint,
      embedding: embeddingResponse.data[idx].embedding,
      token_count: chunk.tokenCount,
    }));

    await supabase.from('knowledge_chunks').insert(insertData);
  }
}

interface Chunk {
  content: string;
  startTime: number;
  endTime: number;
  knowledgePoint: string;
  tokenCount: number;
}
```

### 12.5 在线检索模块

```typescript
// lib/rag/retriever.ts
import OpenAI from 'openai';
import { supabase } from '../supabase';

const openai = new OpenAI();

interface RetrievalResult {
  chunks: RetrievedChunk[];
  confidence: number;       // 0-1，检索置信度
  useRAG: boolean;          // 是否使用 RAG 结果
  fallbackReason?: string;  // 降级原因
}

interface RetrievedChunk {
  content: string;
  knowledgePoint: string;
  similarity: number;
  videoTimestamp: number;
}

// 置信度阈值
const CONFIDENCE_THRESHOLD = 0.75;
const TOP_K = 3;

/**
 * 检索相关知识片段
 */
export async function retrieveContext(
  videoId: string,
  question: string,
  currentSubtitle: string,  // 当前字幕上下文
): Promise<RetrievalResult> {

  // 1. 构建检索 query（问题 + 当前上下文）
  const queryText = `
当前视频内容：${currentSubtitle}
学生问题：${question}
`.trim();

  // 2. 向量化 query
  const embeddingResponse = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: queryText,
  });
  const queryEmbedding = embeddingResponse.data[0].embedding;

  // 3. 向量检索（使用 Supabase RPC 函数）
  const { data: chunks, error } = await supabase.rpc('match_knowledge_chunks', {
    query_embedding: queryEmbedding,
    match_video_id: videoId,
    match_threshold: 0.5,  // 最低相似度阈值
    match_count: TOP_K,
  });

  if (error || !chunks || chunks.length === 0) {
    return {
      chunks: [],
      confidence: 0,
      useRAG: false,
      fallbackReason: '未找到相关课程内容',
    };
  }

  // 4. 计算综合置信度（取 top-1 相似度）
  const topSimilarity = chunks[0].similarity;
  const confidence = topSimilarity;

  // 5. 判断是否使用 RAG
  const useRAG = confidence >= CONFIDENCE_THRESHOLD;

  return {
    chunks: chunks.map((c: any) => ({
      content: c.content,
      knowledgePoint: c.knowledge_point,
      similarity: c.similarity,
      videoTimestamp: c.start_time,
    })),
    confidence,
    useRAG,
    fallbackReason: useRAG ? undefined : `置信度 ${(confidence * 100).toFixed(0)}% 低于阈值`,
  };
}

/**
 * 构建最终 Prompt（区分 RAG 模式和通用模式）
 */
export function buildAnswerPrompt(
  question: string,
  currentSubtitle: string,
  retrievalResult: RetrievalResult,
): string {
  const basePrompt = `你是一位经验丰富的初中数学老师，正在为学生答疑。
说话风格亲切耐心，用学生能理解的语言解释。
回答控制在 30 秒内能说完（约 100-150 字）。`;

  if (retrievalResult.useRAG) {
    // RAG 模式：基于课程内容回答
    const contextText = retrievalResult.chunks
      .map(c => `【${c.knowledgePoint}】${c.content}`)
      .join('\n\n');

    return `${basePrompt}

## 课程相关内容
${contextText}

## 当前视频正在讲
${currentSubtitle}

## 学生问题
${question}

## 回答要求
1. 优先基于上述课程内容回答
2. 如果课程内容已经讲过，引导学生回顾："这个我们刚才讲过..."
3. 如需补充，可以用生活例子帮助理解
4. 回答后确认："听懂了吗？"`;
  } else {
    // 通用模式：使用 LLM 通用知识
    return `${basePrompt}

## 当前视频正在讲
${currentSubtitle}

## 学生问题
${question}

## 特别提示
这个问题老师在视频里没有专门讲过。请用你的知识来解释，但要在开头说明：
"这个问题老师没有专门讲，我来帮你解释一下..."

## 回答要求
1. 解释要通俗易懂，适合初中生理解
2. 可以用生活例子帮助理解
3. 回答后确认："听懂了吗？"`;
  }
}
```

### 12.6 Supabase RPC 函数

```sql
-- 向量相似度检索函数
CREATE OR REPLACE FUNCTION match_knowledge_chunks(
  query_embedding VECTOR(1536),
  match_video_id UUID,
  match_threshold FLOAT DEFAULT 0.5,
  match_count INT DEFAULT 3
)
RETURNS TABLE (
  id UUID,
  content TEXT,
  knowledge_point VARCHAR(200),
  start_time FLOAT,
  end_time FLOAT,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    kc.id,
    kc.content,
    kc.knowledge_point,
    kc.start_time,
    kc.end_time,
    1 - (kc.embedding <=> query_embedding) AS similarity
  FROM public.knowledge_chunks kc
  WHERE kc.video_id = match_video_id
    AND 1 - (kc.embedding <=> query_embedding) > match_threshold
  ORDER BY kc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
```

### 12.7 与 OpenAI Realtime API 集成

```typescript
// 修改 hooks/useRealtimeVoice.ts 中的 connect 函数

export async function createRealtimeSessionWithRAG(
  videoId: string,
  videoContext: string,
  teacherVoiceId?: string,
) {
  const client = new RealtimeClient({ /* ... */ });

  // 监听用户输入完成事件
  client.on('conversation.item.completed', async (event) => {
    const { item } = event;

    if (item.type === 'message' && item.role === 'user') {
      const question = item.formatted.transcript || '';

      // 执行 RAG 检索
      const retrievalResult = await retrieveContext(videoId, question, videoContext);

      // 动态更新 system prompt
      const enhancedPrompt = buildAnswerPrompt(question, videoContext, retrievalResult);

      await client.updateSession({
        instructions: enhancedPrompt,
      });

      // 如果是降级模式，可以在 UI 上提示
      if (!retrievalResult.useRAG) {
        // 触发 UI 显示提示
        onFallbackMode?.(retrievalResult.fallbackReason);
      }
    }
  });

  return client;
}
```

---

## 13. 视频上传与处理模块

### 13.1 上传流程

```
教师选择视频 → 上传到 R2 → 触发处理 → 后台处理 → 通知完成
     │              │            │           │           │
     ▼              ▼            ▼           ▼           ▼
  前端组件      Presigned    Supabase    Edge Func   Realtime
               URL 直传    Database    /队列处理    通知
```

### 13.2 前端上传组件

```tsx
// components/teacher/VideoUploader.tsx
import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

interface VideoUploaderProps {
  onUploadComplete: (videoId: string) => void;
}

export function VideoUploader({ onUploadComplete }: VideoUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [processing, setProcessing] = useState(false);

  const handleUpload = useCallback(async (file: File) => {
    if (!file.type.startsWith('video/')) {
      alert('请选择视频文件');
      return;
    }

    setUploading(true);

    try {
      // 1. 创建视频记录，获取上传 URL
      const { data: video, error } = await supabase
        .from('videos')
        .insert({
          title: file.name.replace(/\.[^/.]+$/, ''),
          processing_status: 'uploading',
          file_size: file.size,
        })
        .select()
        .single();

      if (error) throw error;

      // 2. 获取 R2 presigned URL
      const { data: uploadUrl } = await supabase.functions.invoke('get-upload-url', {
        body: { videoId: video.id, contentType: file.type },
      });

      // 3. 直传到 R2
      await uploadWithProgress(uploadUrl.url, file, setProgress);

      // 4. 更新状态，触发后台处理
      await supabase
        .from('videos')
        .update({
          processing_status: 'processing',
          r2_key: uploadUrl.key,
        })
        .eq('id', video.id);

      setProcessing(true);

      // 5. 订阅处理完成通知
      const channel = supabase
        .channel(`video-${video.id}`)
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'videos',
          filter: `id=eq.${video.id}`,
        }, (payload) => {
          if (payload.new.processing_status === 'completed') {
            setProcessing(false);
            onUploadComplete(video.id);
            channel.unsubscribe();
          } else if (payload.new.processing_status === 'failed') {
            setProcessing(false);
            alert('视频处理失败，请重试');
            channel.unsubscribe();
          }
        })
        .subscribe();

    } catch (err) {
      console.error('Upload failed:', err);
      alert('上传失败，请重试');
    } finally {
      setUploading(false);
    }
  }, [onUploadComplete]);

  return (
    <div className="border-2 border-dashed rounded-lg p-8 text-center">
      {!uploading && !processing && (
        <label className="cursor-pointer">
          <input
            type="file"
            accept="video/*"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
          />
          <div className="space-y-2">
            <div className="text-4xl">📹</div>
            <p className="text-gray-600">点击或拖拽上传教学视频</p>
            <p className="text-sm text-gray-400">支持 MP4、MOV 等格式，建议不超过 500MB</p>
          </div>
        </label>
      )}

      {uploading && (
        <div className="space-y-3">
          <div className="text-2xl">⬆️</div>
          <p>正在上传... {progress}%</p>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {processing && (
        <div className="space-y-3">
          <div className="text-2xl animate-spin">⚙️</div>
          <p>正在处理视频...</p>
          <p className="text-sm text-gray-400">
            系统正在提取字幕、分析知识点，预计需要 2-5 分钟
          </p>
        </div>
      )}
    </div>
  );
}

async function uploadWithProgress(
  url: string,
  file: File,
  onProgress: (percent: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`Upload failed: ${xhr.status}`));
      }
    });

    xhr.addEventListener('error', () => reject(new Error('Upload failed')));

    xhr.open('PUT', url);
    xhr.setRequestHeader('Content-Type', file.type);
    xhr.send(file);
  });
}
```

### 13.3 后台处理（Supabase Edge Function）

```typescript
// supabase/functions/process-video/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  const { videoId } = await req.json();

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    // 1. 获取视频信息
    const { data: video } = await supabase
      .from('videos')
      .select('*')
      .eq('id', videoId)
      .single();

    // 2. 从 R2 获取视频 URL
    const videoUrl = `${Deno.env.get('R2_PUBLIC_URL')}/${video.r2_key}`;

    // 3. 调用处理 Pipeline（可以是另一个长时运行的服务）
    const result = await processVideo(videoId, videoUrl);

    // 4. 更新处理完成状态
    await supabase
      .from('videos')
      .update({
        processing_status: 'completed',
        cloudflare_video_id: result.streamVideoId,
        subtitle_url: result.subtitleUrl,
        duration: result.duration,
      })
      .eq('id', videoId);

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    // 更新失败状态
    await supabase
      .from('videos')
      .update({
        processing_status: 'failed',
        processing_error: error.message,
      })
      .eq('id', videoId);

    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
```

---

## 14. 节点标记系统

### 14.1 数据结构

```sql
-- 视频节点表
CREATE TABLE public.video_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID REFERENCES public.videos(id) ON DELETE CASCADE,
  timestamp FLOAT NOT NULL,              -- 时间点（秒）
  title VARCHAR(100) NOT NULL,           -- 节点标题
  description TEXT,                      -- 节点描述
  node_type VARCHAR(20) DEFAULT 'topic', -- topic/example/summary/exercise
  is_auto_generated BOOLEAN DEFAULT true,-- 是否自动生成
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_nodes_video ON public.video_nodes(video_id, timestamp);
```

### 14.2 自动节点检测

```typescript
// lib/nodes/auto-detector.ts

/**
 * 基于转写文本自动检测知识节点
 */
export async function detectNodes(
  videoId: string,
  transcript: { text: string; segments: any[] }
): Promise<VideoNode[]> {

  const prompt = `
分析以下数学教学视频的转写文本，识别关键节点。

关键节点类型：
- topic: 新知识点开始（如"接下来我们学习配方法"）
- example: 例题讲解开始（如"我们来看一道例题"）
- summary: 总结归纳（如"总结一下"）
- exercise: 练习环节（如"大家试着做一下"）

返回 JSON 数组，每个节点包含：
- timestamp: 时间点（秒）
- title: 简短标题（10字以内）
- description: 描述（30字以内）
- node_type: 节点类型

转写文本（含时间戳）：
${formatTranscriptWithTime(transcript.segments).slice(0, 6000)}
`;

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
  });

  const result = JSON.parse(completion.choices[0].message.content || '{"nodes":[]}');

  return result.nodes.map((node: any) => ({
    ...node,
    video_id: videoId,
    is_auto_generated: true,
  }));
}
```

### 14.3 节点编辑器（教师端）

```tsx
// components/teacher/NodeEditor.tsx
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface NodeEditorProps {
  videoId: string;
  currentTime: number;
  onSeek: (time: number) => void;
}

export function NodeEditor({ videoId, currentTime, onSeek }: NodeEditorProps) {
  const [nodes, setNodes] = useState<VideoNode[]>([]);
  const [editingNode, setEditingNode] = useState<VideoNode | null>(null);

  useEffect(() => {
    loadNodes();
  }, [videoId]);

  async function loadNodes() {
    const { data } = await supabase
      .from('video_nodes')
      .select('*')
      .eq('video_id', videoId)
      .order('timestamp');
    setNodes(data || []);
  }

  async function addNode() {
    const newNode = {
      video_id: videoId,
      timestamp: currentTime,
      title: '新节点',
      node_type: 'topic',
      is_auto_generated: false,
    };

    const { data } = await supabase
      .from('video_nodes')
      .insert(newNode)
      .select()
      .single();

    setNodes([...nodes, data].sort((a, b) => a.timestamp - b.timestamp));
    setEditingNode(data);
  }

  async function updateNode(node: VideoNode) {
    await supabase
      .from('video_nodes')
      .update({
        title: node.title,
        description: node.description,
        node_type: node.node_type,
        timestamp: node.timestamp,
      })
      .eq('id', node.id);

    await loadNodes();
    setEditingNode(null);
  }

  async function deleteNode(nodeId: string) {
    await supabase.from('video_nodes').delete().eq('id', nodeId);
    setNodes(nodes.filter(n => n.id !== nodeId));
  }

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold">知识节点</h3>
        <button
          onClick={addNode}
          className="px-3 py-1 bg-blue-500 text-white rounded text-sm"
        >
          + 在当前位置添加
        </button>
      </div>

      <div className="space-y-2 max-h-96 overflow-y-auto">
        {nodes.map((node) => (
          <div
            key={node.id}
            className={`p-3 rounded border cursor-pointer hover:bg-gray-50
              ${node.is_auto_generated ? 'border-dashed' : 'border-solid'}
              ${editingNode?.id === node.id ? 'ring-2 ring-blue-500' : ''}`}
            onClick={() => onSeek(node.timestamp)}
          >
            {editingNode?.id === node.id ? (
              <NodeEditForm
                node={editingNode}
                onSave={updateNode}
                onCancel={() => setEditingNode(null)}
              />
            ) : (
              <div className="flex justify-between">
                <div>
                  <span className="text-xs text-gray-400">
                    {formatTime(node.timestamp)}
                  </span>
                  <span className={`ml-2 text-xs px-1 rounded ${getTypeColor(node.node_type)}`}>
                    {getTypeLabel(node.node_type)}
                  </span>
                  <p className="font-medium">{node.title}</p>
                  {node.description && (
                    <p className="text-sm text-gray-500">{node.description}</p>
                  )}
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={(e) => { e.stopPropagation(); setEditingNode(node); }}
                    className="text-gray-400 hover:text-blue-500"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteNode(node.id); }}
                    className="text-gray-400 hover:text-red-500"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

## 15. 一键意图设计

### 15.1 意图配置

```typescript
// lib/intents/presets.ts

export interface QuickIntent {
  id: string;
  label: string;
  icon: string;
  promptTemplate: string;
  triggerCondition?: (context: IntentContext) => boolean;  // 动态显示条件
}

export const QUICK_INTENTS: QuickIntent[] = [
  {
    id: 'explain_again',
    label: '再讲一遍',
    icon: '🔄',
    promptTemplate: '请用更简单的语言，再解释一遍刚才讲的内容："{currentSubtitle}"',
  },
  {
    id: 'give_example',
    label: '举个例子',
    icon: '💡',
    promptTemplate: '能举一个生活中的例子来解释"{currentSubtitle}"吗？',
  },
  {
    id: 'slow_down',
    label: '慢点讲',
    icon: '🐢',
    promptTemplate: '请更慢、更详细地解释一下"{currentSubtitle}"，我有点跟不上。',
  },
  {
    id: 'summarize',
    label: '总结一下',
    icon: '📝',
    promptTemplate: '请帮我总结一下到目前为止讲的主要内容。',
    triggerCondition: (ctx) => ctx.videoProgress > 0.3,  // 播放超过30%才显示
  },
  {
    id: 'show_formula',
    label: '写出公式',
    icon: '📐',
    promptTemplate: '请把"{currentSubtitle}"中提到的公式写出来，用画板展示。',
    triggerCondition: (ctx) => ctx.hasFormulaKeyword,  // 检测到公式关键词才显示
  },
  {
    id: 'draw_graph',
    label: '画个图',
    icon: '📈',
    promptTemplate: '能画一个图来帮助理解"{currentSubtitle}"吗？',
    triggerCondition: (ctx) => ctx.hasFunctionKeyword,  // 检测到函数关键词才显示
  },
  {
    id: 'what_is_this',
    label: '这是什么',
    icon: '❓',
    promptTemplate: '"{currentSubtitle}"是什么意思？我不太理解。',
  },
  {
    id: 'why',
    label: '为什么',
    icon: '🤔',
    promptTemplate: '为什么是这样？请解释一下"{currentSubtitle}"背后的原因。',
  },
];

interface IntentContext {
  currentSubtitle: string;
  videoProgress: number;      // 0-1
  hasFormulaKeyword: boolean;
  hasFunctionKeyword: boolean;
}

/**
 * 根据当前上下文返回应显示的快捷意图
 */
export function getVisibleIntents(context: IntentContext): QuickIntent[] {
  // 基础意图始终显示
  const baseIntents = ['explain_again', 'give_example', 'what_is_this'];

  return QUICK_INTENTS.filter(intent => {
    if (baseIntents.includes(intent.id)) return true;
    if (intent.triggerCondition) {
      return intent.triggerCondition(context);
    }
    return false;
  });
}

/**
 * 检测关键词
 */
export function analyzeContext(subtitle: string): Partial<IntentContext> {
  const formulaKeywords = ['公式', '等于', '求解', '计算', '方程'];
  const functionKeywords = ['函数', '图像', '坐标', '曲线', '抛物线'];

  return {
    hasFormulaKeyword: formulaKeywords.some(k => subtitle.includes(k)),
    hasFunctionKeyword: functionKeywords.some(k => subtitle.includes(k)),
  };
}
```

### 15.2 一键意图组件

```tsx
// components/voice-interaction/QuickIntents.tsx
import { motion, AnimatePresence } from 'framer-motion';
import { QuickIntent, getVisibleIntents, analyzeContext } from '@/lib/intents/presets';

interface QuickIntentsProps {
  currentSubtitle: string;
  videoProgress: number;
  onSelect: (prompt: string) => void;
  isFirstTime?: boolean;  // 首次使用，显示更多引导
}

export function QuickIntents({
  currentSubtitle,
  videoProgress,
  onSelect,
  isFirstTime = false,
}: QuickIntentsProps) {
  const context = {
    currentSubtitle,
    videoProgress,
    ...analyzeContext(currentSubtitle),
  };

  const visibleIntents = getVisibleIntents(context);

  // 首次使用显示全部基础意图
  const intentsToShow = isFirstTime
    ? visibleIntents.slice(0, 6)
    : visibleIntents.slice(0, 4);

  const handleSelect = (intent: QuickIntent) => {
    const prompt = intent.promptTemplate.replace(
      '{currentSubtitle}',
      currentSubtitle.slice(0, 50)
    );
    onSelect(prompt);
  };

  return (
    <div className="space-y-2">
      {isFirstTime && (
        <p className="text-sm text-gray-500 text-center">
          不知道怎么问？试试这些：
        </p>
      )}

      <div className="flex flex-wrap gap-2 justify-center">
        <AnimatePresence mode="popLayout">
          {intentsToShow.map((intent, index) => (
            <motion.button
              key={intent.id}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ delay: index * 0.05 }}
              onClick={() => handleSelect(intent)}
              className="px-3 py-2 bg-gray-100 hover:bg-blue-100
                         rounded-full text-sm flex items-center gap-1
                         transition-colors"
            >
              <span>{intent.icon}</span>
              <span>{intent.label}</span>
            </motion.button>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
```

---

## 16. API 安全（后端代理）

### 16.1 问题说明

OpenAI Realtime API 需要 API Key，直接放在前端会导致密钥泄露。解决方案是通过后端代理建立 WebSocket 连接。

### 16.2 架构

```
┌──────────────┐     WebSocket      ┌──────────────┐     WebSocket      ┌──────────────┐
│   浏览器      │ ◄─────────────────► │  Next.js API │ ◄─────────────────► │   OpenAI     │
│  (客户端)     │    (无 API Key)     │   Route      │    (带 API Key)     │  Realtime    │
└──────────────┘                     └──────────────┘                     └──────────────┘
```

### 16.3 实现方案 A：Edge Runtime WebSocket 代理

```typescript
// app/api/realtime/route.ts
import { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function GET(req: NextRequest) {
  // 验证用户身份
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) {
    return new Response('Unauthorized', { status: 401 });
  }

  // 验证 token（从 Supabase 验证）
  const user = await verifySupabaseToken(token);
  if (!user) {
    return new Response('Invalid token', { status: 401 });
  }

  // 创建到 OpenAI 的 WebSocket 连接
  const openaiWs = new WebSocket('wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview', {
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'OpenAI-Beta': 'realtime=v1',
    },
  });

  // 返回 WebSocket 升级响应
  // 注意：Next.js Edge Runtime 对 WebSocket 支持有限，可能需要使用其他方案

  return new Response('WebSocket proxy not directly supported in Edge Runtime', {
    status: 501
  });
}
```

### 16.4 实现方案 B：使用临时 Token（推荐）

OpenAI 提供了临时 session token 机制，更安全。

```typescript
// app/api/realtime/session/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
  // 1. 验证用户身份
  const authHeader = req.headers.get('authorization');
  if (!authHeader) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  // 2. 获取请求参数
  const { videoId, teacherVoiceId } = await req.json();

  // 3. 创建 OpenAI Realtime Session
  const response = await fetch('https://api.openai.com/v1/realtime/sessions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-realtime-preview',
      voice: teacherVoiceId || 'alloy',
      modalities: ['text', 'audio'],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    return NextResponse.json({ error }, { status: response.status });
  }

  const session = await response.json();

  // 4. 返回临时 token（有效期通常 1 分钟）
  return NextResponse.json({
    clientSecret: session.client_secret,  // 客户端用这个连接
    expiresAt: session.expires_at,
  });
}
```

### 16.5 前端使用临时 Token

```typescript
// hooks/useRealtimeVoice.ts 修改

export function useRealtimeVoice(options: UseRealtimeVoiceOptions) {
  // ...

  const connect = useCallback(async (videoId: string, videoContext?: string) => {
    // 1. 从后端获取临时 token
    const tokenResponse = await fetch('/api/realtime/session', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseSession?.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        videoId,
        teacherVoiceId: options.teacherVoiceId,
      }),
    });

    if (!tokenResponse.ok) {
      throw new Error('Failed to get realtime session');
    }

    const { clientSecret } = await tokenResponse.json();

    // 2. 使用临时 token 连接（不暴露 API Key）
    const client = new RealtimeClient({
      // 不再需要 API Key
      // 使用 clientSecret 认证
    });

    // 注意：具体用法需参考 OpenAI SDK 最新文档
    await client.connect({ clientSecret });

    // ... 其余逻辑
  }, [options, supabaseSession]);

  return { /* ... */ };
}
```

---

## 17. 会话记忆实现

### 17.1 记忆层次

| 层次 | 作用域 | 存储位置 | 生命周期 |
|------|--------|----------|----------|
| 对话记忆 | 单次 WebSocket 连接 | OpenAI Realtime 内部 | 连接断开即失效 |
| 会话记忆 | 单次视频观看 | 前端 State + Supabase | 用户离开页面前 |
| 长期记忆 | 跨会话 | Supabase | 永久 |

### 17.2 会话记忆实现

```typescript
// lib/memory/session-memory.ts
import { supabase } from '../supabase';

interface QATurn {
  id: string;
  question: string;
  answer: string;
  timestamp: number;      // 视频时间点
  createdAt: Date;
}

interface SessionMemory {
  sessionId: string;
  videoId: string;
  turns: QATurn[];
}

/**
 * 会话记忆管理器
 */
export class SessionMemoryManager {
  private memory: SessionMemory;
  private syncTimer: NodeJS.Timer | null = null;

  constructor(videoId: string) {
    this.memory = {
      sessionId: crypto.randomUUID(),
      videoId,
      turns: [],
    };

    // 每 30 秒同步到数据库
    this.syncTimer = setInterval(() => this.syncToDatabase(), 30000);
  }

  /**
   * 添加一轮问答
   */
  addTurn(question: string, answer: string, videoTimestamp: number): QATurn {
    const turn: QATurn = {
      id: crypto.randomUUID(),
      question,
      answer,
      timestamp: videoTimestamp,
      createdAt: new Date(),
    };

    this.memory.turns.push(turn);
    return turn;
  }

  /**
   * 获取最近 N 轮对话（用于构建上下文）
   */
  getRecentTurns(n: number = 5): QATurn[] {
    return this.memory.turns.slice(-n);
  }

  /**
   * 构建对话历史文本（用于 Prompt）
   */
  buildHistoryContext(): string {
    const recentTurns = this.getRecentTurns(3);
    if (recentTurns.length === 0) return '';

    return `
## 之前的问答记录
${recentTurns.map((t, i) => `
问题${i + 1}：${t.question}
回答${i + 1}：${t.answer}
`).join('\n')}
`;
  }

  /**
   * 清除会话记忆
   */
  clear(): void {
    this.memory.turns = [];
  }

  /**
   * 同步到数据库
   */
  async syncToDatabase(): Promise<void> {
    if (this.memory.turns.length === 0) return;

    // 获取未同步的 turns
    const unsyncedTurns = this.memory.turns.filter(t => !t.synced);
    if (unsyncedTurns.length === 0) return;

    await supabase.from('qa_turns').insert(
      unsyncedTurns.map(t => ({
        session_id: this.memory.sessionId,
        video_timestamp: t.timestamp,
        question_text: t.question,
        answer_text: t.answer,
        created_at: t.createdAt,
      }))
    );

    // 标记为已同步
    unsyncedTurns.forEach(t => (t as any).synced = true);
  }

  /**
   * 销毁（离开页面时调用）
   */
  async destroy(): Promise<void> {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
    }
    await this.syncToDatabase();
  }
}
```

### 17.3 React Hook 封装

```typescript
// hooks/useSessionMemory.ts
import { useEffect, useRef, useState } from 'react';
import { SessionMemoryManager } from '@/lib/memory/session-memory';

export function useSessionMemory(videoId: string) {
  const managerRef = useRef<SessionMemoryManager | null>(null);
  const [turns, setTurns] = useState<QATurn[]>([]);

  useEffect(() => {
    managerRef.current = new SessionMemoryManager(videoId);

    return () => {
      managerRef.current?.destroy();
    };
  }, [videoId]);

  const addTurn = (question: string, answer: string, timestamp: number) => {
    const turn = managerRef.current?.addTurn(question, answer, timestamp);
    if (turn) {
      setTurns(prev => [...prev, turn]);
    }
    return turn;
  };

  const getHistoryContext = () => {
    return managerRef.current?.buildHistoryContext() || '';
  };

  const clearMemory = () => {
    managerRef.current?.clear();
    setTurns([]);
  };

  return {
    turns,
    addTurn,
    getHistoryContext,
    clearMemory,
  };
}
```

### 17.4 WebSocket 断线重连恢复

```typescript
// lib/memory/reconnect-handler.ts

/**
 * WebSocket 断线重连时恢复上下文
 */
export async function restoreSessionContext(
  client: RealtimeClient,
  memoryManager: SessionMemoryManager,
  videoContext: string,
): Promise<void> {
  // 获取历史对话
  const historyContext = memoryManager.buildHistoryContext();

  // 更新 system prompt，包含历史对话
  const restoredPrompt = `${SYSTEM_PROMPT}

${historyContext}

## 当前视频内容
${videoContext}

## 重要提示
刚才网络断开重连了，你需要记住上面的对话历史，继续帮助学生。`;

  await client.updateSession({
    instructions: restoredPrompt,
  });
}
```

---

## 18. 数据库 Schema 完整版

基于以上补充，更新完整的数据库 Schema：

```sql
-- ============================================
-- MathTalkTV 完整数据库 Schema
-- ============================================

-- 启用扩展
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;  -- 用于文本搜索

-- 用户表（Supabase Auth 自动创建 auth.users）
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users PRIMARY KEY,
  phone VARCHAR(20) UNIQUE,
  nickname VARCHAR(50),
  avatar_url VARCHAR(255),
  grade INT CHECK (grade BETWEEN 7 AND 9),
  is_first_time BOOLEAN DEFAULT true,  -- 是否首次使用（用于引导）
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 教师表
CREATE TABLE public.teachers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) NOT NULL,
  avatar_url VARCHAR(255),
  voice_id VARCHAR(100),
  voice_sample_url VARCHAR(500),
  ai_config JSONB DEFAULT '{
    "style": "friendly",
    "verbosity": "moderate",
    "use_whiteboard": true
  }',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 视频表
CREATE TABLE public.videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(200) NOT NULL,
  description TEXT,
  teacher_id UUID REFERENCES public.teachers(id),
  -- 存储相关
  r2_key VARCHAR(500),
  cloudflare_video_id VARCHAR(100),
  subtitle_url VARCHAR(500),
  thumbnail_url VARCHAR(500),
  -- 元数据
  duration INT,
  file_size BIGINT,
  -- 处理状态
  processing_status VARCHAR(20) DEFAULT 'pending',  -- pending/uploading/processing/completed/failed
  processing_error TEXT,
  processed_at TIMESTAMPTZ,
  -- 发布状态
  publish_status VARCHAR(20) DEFAULT 'draft',  -- draft/published/archived
  published_at TIMESTAMPTZ,
  -- 知识点
  knowledge_points JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 视频转写表
CREATE TABLE public.video_transcripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID REFERENCES public.videos(id) ON DELETE CASCADE,
  full_text TEXT,
  language VARCHAR(10) DEFAULT 'zh',
  word_count INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 知识片段表（RAG）
CREATE TABLE public.knowledge_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID REFERENCES public.videos(id) ON DELETE CASCADE,
  chunk_index INT,
  content TEXT NOT NULL,
  start_time FLOAT,
  end_time FLOAT,
  knowledge_point VARCHAR(200),
  embedding VECTOR(1536),
  token_count INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 视频节点表
CREATE TABLE public.video_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID REFERENCES public.videos(id) ON DELETE CASCADE,
  timestamp FLOAT NOT NULL,
  title VARCHAR(100) NOT NULL,
  description TEXT,
  node_type VARCHAR(20) DEFAULT 'topic',
  is_auto_generated BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 学习会话表
CREATE TABLE public.learning_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id),
  video_id UUID REFERENCES public.videos(id),
  start_time TIMESTAMPTZ DEFAULT NOW(),
  end_time TIMESTAMPTZ,
  last_progress INT DEFAULT 0,
  question_count INT DEFAULT 0,
  total_interaction_time INT DEFAULT 0  -- 总互动时长（秒）
);

-- 问答记录表
CREATE TABLE public.qa_turns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.learning_sessions(id),
  video_timestamp INT,
  subtitle_context TEXT,
  question_text TEXT,
  question_type VARCHAR(20),  -- voice/quick_intent
  answer_text TEXT,
  tool_used VARCHAR(50),
  tool_params JSONB,
  rag_used BOOLEAN DEFAULT false,
  rag_confidence FLOAT,
  latency_ms INT,
  feedback_rating INT CHECK (feedback_rating BETWEEN 1 AND 5),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 索引
-- ============================================
CREATE INDEX idx_chunks_embedding ON public.knowledge_chunks
  USING hnsw (embedding vector_cosine_ops);
CREATE INDEX idx_chunks_video ON public.knowledge_chunks(video_id, chunk_index);
CREATE INDEX idx_nodes_video ON public.video_nodes(video_id, timestamp);
CREATE INDEX idx_sessions_user ON public.learning_sessions(user_id);
CREATE INDEX idx_sessions_video ON public.learning_sessions(video_id);
CREATE INDEX idx_qa_session ON public.qa_turns(session_id);
CREATE INDEX idx_videos_status ON public.videos(processing_status, publish_status);

-- ============================================
-- RLS 策略
-- ============================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qa_turns ENABLE ROW LEVEL SECURITY;

-- 用户只能访问自己的数据
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR ALL USING (auth.uid() = id);

CREATE POLICY "Users can view own sessions" ON public.learning_sessions
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view own qa_turns" ON public.qa_turns
  FOR SELECT USING (
    session_id IN (
      SELECT id FROM public.learning_sessions WHERE user_id = auth.uid()
    )
  );

-- 视频、教师、知识片段对所有认证用户可读
CREATE POLICY "Authenticated users can view videos" ON public.videos
  FOR SELECT USING (auth.role() = 'authenticated' AND publish_status = 'published');

CREATE POLICY "Authenticated users can view teachers" ON public.teachers
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can view chunks" ON public.knowledge_chunks
  FOR SELECT USING (auth.role() = 'authenticated');

-- ============================================
-- 函数
-- ============================================

-- 向量相似度检索
CREATE OR REPLACE FUNCTION match_knowledge_chunks(
  query_embedding VECTOR(1536),
  match_video_id UUID,
  match_threshold FLOAT DEFAULT 0.5,
  match_count INT DEFAULT 3
)
RETURNS TABLE (
  id UUID,
  content TEXT,
  knowledge_point VARCHAR(200),
  start_time FLOAT,
  end_time FLOAT,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    kc.id,
    kc.content,
    kc.knowledge_point,
    kc.start_time,
    kc.end_time,
    1 - (kc.embedding <=> query_embedding) AS similarity
  FROM public.knowledge_chunks kc
  WHERE kc.video_id = match_video_id
    AND 1 - (kc.embedding <=> query_embedding) > match_threshold
  ORDER BY kc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
```

---

## 19. 更新后的成本估算

| 服务 | 月费用估算 | 说明 |
|------|------------|------|
| Vercel | $0 | Hobby 免费 |
| Supabase | $25 | Pro 套餐（含 pgvector） |
| Cloudflare Stream | ~$20 | 1000 分钟视频存储 |
| Cloudflare R2 | ~$5 | 100GB 存储 |
| **OpenAI Realtime API** | **~$150** | 约 500 分钟对话 |
| **OpenAI Whisper** | **~$15** | 约 250 分钟转写 |
| **OpenAI Embedding** | **~$5** | 约 500万 token |
| **OpenAI GPT-4o-mini** | **~$10** | 分段/节点检测 |
| PostHog | $0 | 免费套餐 |
| 阿里云 SMS | ~$20 | 约 500 次验证 |
| **合计** | **~$250/月** | MVP 验证阶段 |

---

*文档版本：v2.1 | 更新日期：2025-01-11 | 主要变更：补充 RAG 系统、视频处理、节点标记、一键意图、API 安全、会话记忆*
