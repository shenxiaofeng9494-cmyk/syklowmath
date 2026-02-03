# MathTalkTV 项目分析报告

> 生成时间：2026-02-02
> 项目版本：0.1.0 (MVP)

---

## 一、项目概述

**MathTalkTV** 是一个交互式语音数学学习平台，面向中学生（12-15岁）的数学教育。核心特色是学生可以在观看教学视频时随时暂停，通过语音与 AI 老师实时对话，AI 可以在白板上展示公式、绘制图形来辅助讲解。

### 核心功能

| 功能 | 说明 |
|------|------|
| 视频播放 | HTML5 播放器，支持字幕同步、知识点进度条 |
| 语音对话 | 多种语音方案：OpenAI Realtime / 豆包实时 / 三阶段管道 |
| AI 白板 | KaTeX 公式渲染、Mafs 函数图像、Tldraw 几何绘图 |
| 智能介入 | 必停点检测，AI 在关键节点主动提问 |
| 游戏生成 | Claude Agent SDK 生成交互式数学练习游戏 |
| RAG 检索 | 基于 pgvector 的语义搜索，提供上下文增强 |

---

## 二、技术栈

### 2.1 前端框架

| 技术 | 版本 | 用途 |
|------|------|------|
| Next.js | 16.1.1 | App Router 全栈框架 |
| React | 19.2.3 | UI 组件库 |
| TypeScript | 5.x | 类型安全 |
| Tailwind CSS | 4.x | 原子化 CSS |

### 2.2 UI 组件

| 技术 | 用途 |
|------|------|
| Radix UI | 无障碍基础组件（Dialog、Select、Switch 等）|
| Framer Motion | 动画效果 |
| Lucide React | 图标库 |
| shadcn/ui | 组件设计系统 |

### 2.3 数学渲染

| 技术 | 用途 |
|------|------|
| KaTeX | LaTeX 公式渲染 |
| Mafs | 交互式函数图像 |
| mathjs | 数学表达式解析和计算 |
| Plotly.js | 高级图表绑定 |

### 2.4 绘图工具

| 技术 | 用途 |
|------|------|
| Tldraw | AI 绘图画布 |
| Excalidraw | 手绘风格图形（备用）|

### 2.5 AI/语音服务

| 服务 | 用途 |
|------|------|
| OpenAI Realtime API | 实时语音对话（方案一）|
| 豆包 Realtime S2S | 实时语音对话（方案二，推荐）|
| 豆包 ASR + DeepSeek LLM + 豆包 TTS | 三阶段精准模式（方案三）|
| Claude Agent SDK | AI 游戏代码生成 |
| DashScope | 文本向量化（text-embedding-v4）|
| Paraformer | 视频转写 |

### 2.6 后端服务

| 服务 | 用途 |
|------|------|
| Supabase | PostgreSQL 数据库 + pgvector 向量搜索 |
| Aliyun OSS | 视频文件存储 |
| Volcengine | 视觉场景分割（可选）|

### 2.7 代码执行

| 技术 | 用途 |
|------|------|
| react-live | AI 生成代码的沙箱执行 |
| Sucrase | TypeScript → JavaScript 转换 |
| CodeMirror | Python 代码编辑器 |

---

## 三、项目结构

```
MathTalkTV/
├── app/                          # Next.js 主应用
│   ├── src/
│   │   ├── app/                  # App Router 路由
│   │   │   ├── page.tsx          # 首页（视频列表）
│   │   │   ├── admin/            # 管理后台
│   │   │   ├── teacher/          # 教师界面
│   │   │   ├── watch/[id]/       # 视频观看页（核心）
│   │   │   └── api/              # API 路由
│   │   │       ├── game/         # 游戏生成 API
│   │   │       ├── realtime/     # OpenAI Realtime（旧）
│   │   │       ├── transcribe/   # 视频转写
│   │   │       ├── upload/       # 文件上传
│   │   │       ├── video/        # 视频 CRUD
│   │   │       └── voice/        # 语音服务（核心）
│   │   │
│   │   ├── components/           # React 组件
│   │   │   ├── chat-panel/       # 聊天面板
│   │   │   ├── drawing-canvas/   # Tldraw 绘图
│   │   │   ├── game-player/      # 游戏播放器
│   │   │   ├── game-preview/     # 游戏预览
│   │   │   ├── node-editor/      # 节点编辑器
│   │   │   ├── ui/               # shadcn/ui 基础组件
│   │   │   ├── video-player/     # 视频播放器
│   │   │   ├── video-upload/     # 视频上传
│   │   │   ├── voice-interaction/# 语音交互（核心）
│   │   │   └── whiteboard/       # 白板组件
│   │   │
│   │   ├── hooks/                # 自定义 Hooks
│   │   │   ├── useCheckpointIntervention.ts  # 必停点介入
│   │   │   ├── useRealtimeVoice.ts           # OpenAI Realtime
│   │   │   └── voice/            # 语音相关 Hooks
│   │   │       ├── useAudioCapture.ts        # 音频采集
│   │   │       ├── useAudioPlayback.ts       # 音频播放
│   │   │       ├── useDoubaoASR.ts           # 豆包 ASR
│   │   │       ├── useDoubaoTTS.ts           # 豆包 TTS
│   │   │       ├── useDoubaoRealtimeVoice.ts # 豆包实时
│   │   │       ├── useDeepSeekLLM.ts         # DeepSeek LLM
│   │   │       └── useVoiceInteraction.ts    # 三阶段协调
│   │   │
│   │   ├── lib/                  # 工具库
│   │   │   ├── supabase.ts       # Supabase 客户端
│   │   │   ├── embedding.ts      # 向量生成
│   │   │   ├── rag.ts            # RAG 检索
│   │   │   ├── oss.ts            # OSS 上传
│   │   │   ├── video-processor.ts# 视频处理管道
│   │   │   ├── node-segmentation-v2.ts # GPT 节点分割
│   │   │   ├── volcengine-*.ts   # 火山引擎相关
│   │   │   ├── drawing-*.ts      # 绘图相关
│   │   │   ├── game-generator/   # 游戏生成 Agent
│   │   │   └── whiteboard-dsl/   # 白板 DSL
│   │   │
│   │   ├── types/                # TypeScript 类型
│   │   │   └── database.ts       # Supabase 表结构
│   │   │
│   │   └── data/                 # 静态数据（Fallback）
│   │
│   ├── public/                   # 静态资源
│   ├── supabase/                 # Supabase 配置
│   └── package.json
│
├── docs/                         # 文档目录
├── CLAUDE.md                     # Claude Code 指南
├── README.md                     # 项目说明
└── PROJECT_STATUS.md             # 项目状态
```

---

## 四、核心模块详解

### 4.1 语音交互系统

语音交互是本项目的核心，支持三种方案：

#### 方案一：OpenAI Realtime API（旧版）
- **文件**：`useRealtimeVoice.ts`、`/api/realtime`
- **特点**：端到端实时语音，延迟低
- **缺点**：成本高，国内网络不稳定

#### 方案二：豆包 Realtime S2S（推荐）
- **文件**：`useDoubaoRealtimeVoice.ts`、`/api/voice/doubao-realtime`
- **特点**：国内服务，稳定性好，支持工具调用
- **音频规格**：24kHz PCM 16-bit

#### 方案三：三阶段精准模式
- **文件**：`useVoiceInteraction.ts`、`useDoubaoASR.ts`、`useDeepSeekLLM.ts`、`useDoubaoTTS.ts`
- **流程**：
  1. **ASR**：豆包流式语音识别
  2. **LLM**：DeepSeek 推理（支持函数调用）
  3. **TTS**：豆包双向流语音合成
- **用途**：介入模式下的精准问答

#### 工具调用能力
所有语音方案都支持以下工具：
- `use_whiteboard` - 在白板上渲染公式/图像
- `resume_video` - 继续播放视频
- `jump_to_video_node` - 跳转到知识点
- `load_tool_guide` - 加载工具使用指南

### 4.2 必停点介入系统

- **文件**：`useCheckpointIntervention.ts`
- **功能**：在视频关键节点自动暂停，AI 主动提问
- **触发条件**：
  - 节点标记为 `is_critical_checkpoint`
  - 播放到节点结束前 1 秒
- **状态管理**：使用 sessionStorage 防止重复触发

### 4.3 白板渲染系统

- **文件**：`Whiteboard.tsx`、`whiteboard-dsl/`
- **支持类型**：
  - **公式**：KaTeX 渲染 LaTeX
  - **图像**：Mafs 交互式函数图
  - **绘图**：Tldraw 几何图形
- **表达式解析**：
  - `x^2` → `Math.pow(x, 2)`
  - `2x` → `2*x`（隐式乘法）
  - 自动提取参数生成滑块

### 4.4 游戏生成系统

- **文件**：`lib/game-generator/`
- **技术**：Claude Agent SDK
- **支持游戏类型**：
  - 参数滑块、拖拽匹配、数轴估算
  - 坐标绑定、方程天平、几何构造
  - 数列谜题、分数可视化、图像变换
- **执行**：react-live 沙箱运行 AI 生成代码

### 4.5 视频处理管道

- **文件**：`video-processor.ts`、`node-segmentation-v2.ts`
- **流程**：
  1. 上传视频到 OSS
  2. Paraformer 转写生成字幕
  3. GPT-4o 分析教学结构，分割知识点
  4. DashScope 生成向量嵌入
  5. 存储到 Supabase

### 4.6 RAG 检索系统

- **文件**：`rag.ts`、`embedding.ts`
- **实现**：
  - pgvector 相似度搜索
  - 混合搜索：语义检索(0.7) + 关键词(0.3)
- **上下文组装**：
  - 当前节点信息
  - 前 30 秒字幕窗口
  - 相关知识点

---

## 五、数据库设计

### 5.1 核心表结构

#### videos 表
```sql
id: string (PK)
title: string
description: string?
duration: number
video_url: string
teacher: string?
node_count: number
status: 'pending' | 'processing' | 'ready' | 'error'
created_at: timestamp
```

#### video_nodes 表
```sql
id: string (PK)
video_id: string (FK)
order: number
start_time: number (秒)
end_time: number (秒)
title: string
summary: string
key_concepts: string[]
transcript: string?
embedding: vector(1024)  -- pgvector
is_critical_checkpoint: boolean
checkpoint_type: 'motivation' | 'definition' | 'pitfall' | 'summary' | 'verification'?
checkpoint_question: string?
silence_threshold_seconds: number
```

#### video_games 表
```sql
id: string (PK)
video_id: string (FK)
node_id: string (FK)
title: string
game_type: string
difficulty: 'easy' | 'medium' | 'hard'
component_code: string  -- React 组件代码
instructions: string
hints: string[]
```

### 5.2 RPC 函数
```sql
search_video_nodes(
  query_embedding: vector,
  target_video_id: string,
  match_threshold: float = 0.5,
  match_count: int = 3
) -> VideoNodeSearchResult[]
```

---

## 六、API 路由清单

### 6.1 视频 API
| 路由 | 方法 | 功能 |
|------|------|------|
| `/api/video` | GET/POST | 视频列表/创建 |
| `/api/video/[id]` | GET/PUT/DELETE | 视频详情/更新/删除 |
| `/api/video/[id]/nodes` | GET/POST | 节点列表/批量更新 |
| `/api/video/[id]/context` | GET | RAG 上下文 |
| `/api/video/[id]/checkpoint` | POST | 检查点管理 |
| `/api/video/search` | GET | 跨视频搜索 |
| `/api/video/process` | POST | 视频处理 |
| `/api/video/full-process` | POST | 完整处理(SSE) |

### 6.2 语音 API
| 路由 | 方法 | 功能 |
|------|------|------|
| `/api/voice/session` | POST | 会话初始化 |
| `/api/voice/asr` | POST | ASR 代理 |
| `/api/voice/tts` | POST | TTS 代理 |
| `/api/voice/chat` | POST | LLM 代理 |
| `/api/voice/doubao-realtime` | POST | 豆包实时代理 |
| `/api/voice/tool-detect` | POST | 工具检测 |

### 6.3 游戏 API
| 路由 | 方法 | 功能 |
|------|------|------|
| `/api/game/generate` | POST | 生成游戏 |
| `/api/game/batch-generate` | POST | 批量生成 |
| `/api/game/feedback` | POST | 反馈重生成 |

### 6.4 其他 API
| 路由 | 方法 | 功能 |
|------|------|------|
| `/api/transcribe` | POST | 视频转写 |
| `/api/upload` | POST | OSS 上传 |
| `/api/realtime` | POST | OpenAI Realtime(旧) |

---

## 七、潜在问题与改进建议

### 7.1 架构层面

| 问题 | 严重程度 | 建议 |
|------|----------|------|
| 无测试覆盖 | 高 | 添加 Jest/Vitest 单元测试和 Playwright E2E 测试 |
| 状态管理分散 | 中 | 考虑引入 Zustand 或 Jotai 统一管理全局状态 |
| 错误处理不完善 | 中 | 添加全局错误边界和 API 错误处理中间件 |
| 缺少监控 | 中 | 集成 Sentry 错误追踪和性能监控 |

### 7.2 性能优化

| 问题 | 建议 |
|------|------|
| 控制台日志过多 | 生产环境应移除或使用 debug 库按级别控制 |
| 大量 Fast Refresh | 开发时正常，但提示组件可能有不必要的重渲染 |
| 音频处理 | 考虑使用 Web Worker 处理音频，避免阻塞主线程 |
| 向量搜索 | 数据量大时考虑添加 HNSW 索引 |

### 7.3 代码质量

| 问题 | 位置 | 建议 |
|------|------|------|
| 魔法数字 | 多处 | 提取为常量，如 `CHECKPOINT_TRIGGER_THRESHOLD = 1.0` |
| 重复代码 | voice hooks | 提取公共的音频处理逻辑 |
| 类型定义分散 | types/ | 考虑使用 Zod 进行运行时验证 |
| 注释不足 | lib/ | 核心算法添加详细注释 |

### 7.4 安全性

| 问题 | 严重程度 | 建议 |
|------|----------|------|
| API Key 暴露风险 | 高 | 确保所有 API Key 只在服务端使用 |
| 代码执行沙箱 | 中 | react-live 虽有隔离，但需审计生成代码 |
| 输入验证 | 中 | 添加 Zod schema 验证所有 API 输入 |

### 7.5 用户体验

| 问题 | 建议 |
|------|------|
| 加载状态不明确 | 添加骨架屏和进度指示器 |
| 错误提示不友好 | 设计用户友好的错误提示 UI |
| 移动端适配 | 当前主要针对桌面端，需优化移动端体验 |
| 离线支持 | 考虑 PWA 支持和视频缓存 |

### 7.6 已知 Bug（已修复）

| Bug | 状态 | 修复方案 |
|-----|------|----------|
| 精准模式下按播放键无法切换回实时模式 | ✅ 已修复 | `endIntervention(true)` 保留触发记录 |

---

## 八、部署建议

### 8.1 环境变量

```bash
# 必需
DOUBAO_API_TOKEN=...           # 豆包语音
DEEPSEEK_API_KEY=...           # DeepSeek LLM
ANTHROPIC_API_KEY=...          # Claude 游戏生成

# 数据库
SUPABASE_URL=...
SUPABASE_ANON_KEY=...

# 存储
OSS_REGION=...
OSS_BUCKET=...
OSS_ACCESS_KEY_ID=...
OSS_ACCESS_KEY_SECRET=...

# 可选
OPENAI_API_KEY=...             # OpenAI Realtime
DASHSCOPE_API_KEY=...          # 向量化
VOLCENGINE_ACCESS_KEY_ID=...   # 视觉分割
```

### 8.2 推荐部署平台

| 平台 | 适用场景 |
|------|----------|
| Vercel | 最简单，与 Next.js 深度集成 |
| 阿里云 FC | 国内用户，低延迟 |
| Docker + K8s | 大规模部署，需要更多控制 |

### 8.3 性能基准

| 指标 | 目标值 |
|------|--------|
| 首屏加载 | < 3s |
| 语音响应延迟 | < 500ms |
| 视频加载 | < 2s |
| API 响应 | < 200ms |

---

## 九、总结

MathTalkTV 是一个技术栈现代、功能完整的教育科技平台 MVP。项目采用 Next.js 16 + React 19 的最新技术栈，集成了多种 AI 语音服务，实现了复杂的实时语音交互功能。

### 优势
- 多语音方案支持，灵活切换
- RAG 增强的上下文理解
- AI 生成代码的安全执行
- 完整的视频处理管道

### 待改进
- 测试覆盖率
- 错误处理和监控
- 移动端适配
- 文档完善

### 下一步建议
1. 添加自动化测试
2. 集成错误监控（Sentry）
3. 优化移动端体验
4. 完善 API 文档（OpenAPI/Swagger）
5. 考虑国际化支持

---

*报告由 Claude Code 自动生成*
