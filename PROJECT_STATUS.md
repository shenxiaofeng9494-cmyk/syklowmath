# MathTalkTV 项目状态总结

> 生成时间：2026-01-21
> 项目状态：MVP 阶段，核心功能已完成

## 一、项目概述

MathTalkTV 是一个面向中学生（12-15岁）的**交互式语音数学学习平台**。学生可以在观看教学视频时暂停，通过语音与 AI 助教实时对话，AI 会通过语音回复并在白板上展示公式、函数图像和几何图形。

---

## 二、已完成功能

### 2.1 核心功能（生产就绪）

#### A. 视频管理系统 ✅

| 功能 | 状态 | 说明 |
|------|------|------|
| 视频上传 | ✅ 完成 | 拖拽上传至阿里云 OSS |
| 视频转写 | ✅ 完成 | Paraformer API，支持字级时间戳 |
| 知识点分割 | ✅ 完成 | GPT-4o 智能分割（V2算法） |
| 向量化存储 | ✅ 完成 | DashScope text-embedding-v3 |
| 视频列表 | ✅ 完成 | 首页展示所有视频 |
| 视频详情 | ✅ 完成 | 获取视频元数据和知识点 |
| 处理状态追踪 | ✅ 完成 | pending → processing → ready/error |

**相关 API：**
- `POST /api/upload` - 上传视频到 OSS
- `POST /api/transcribe` - 视频转写（带缓存）
- `POST /api/video/full-process` - 完整处理流程（SSE 进度推送）
- `GET /api/video` - 视频列表
- `GET /api/video/[id]` - 视频详情
- `GET /api/video/[id]/nodes` - 知识点列表
- `GET /api/video/[id]/context` - RAG 上下文

#### B. 语音交互系统 ✅

**方案一：OpenAI Realtime API（旧版）**
| 功能 | 状态 | 说明 |
|------|------|------|
| WebSocket 连接 | ✅ 完成 | 实时双向通信 |
| 音频输入输出 | ✅ 完成 | 24kHz PCM 格式 |
| 语音活动检测 | ✅ 完成 | VAD 自动检测 |
| 按键说话模式 | ✅ 完成 | Push-to-talk 支持 |
| 工具调用 | ✅ 完成 | 白板、视频控制等 |

**方案二：Doubao ASR + DeepSeek LLM + Doubao TTS（推荐）**
| 功能 | 状态 | 说明 |
|------|------|------|
| 流式语音识别 | ✅ 完成 | Doubao ASR |
| LLM 推理 | ✅ 完成 | DeepSeek 函数调用 |
| 流式语音合成 | ✅ 完成 | Doubao TTS 双向流 |
| 音频采集 | ✅ 完成 | 麦克风采集+重采样 |
| 音频播放队列 | ✅ 完成 | 支持打断 |

**AI 工具能力：**
- `use_whiteboard` - 渲染公式/图像/几何图形
- `resume_video` - 继续播放视频
- `jump_to_video_node` - 跳转到知识点
- `load_tool_guide` - 按需加载工具指南

#### C. 交互式白板 ✅

| 功能 | 状态 | 说明 |
|------|------|------|
| LaTeX 公式渲染 | ✅ 完成 | KaTeX 引擎 |
| 函数图像绘制 | ✅ 完成 | Mafs 库，支持交互 |
| 几何图形绘制 | ✅ 完成 | Excalidraw 画布 |
| 表达式解析 | ✅ 完成 | `x^2` → `Math.pow(x,2)` |
| 三角函数支持 | ✅ 完成 | sin/cos/tan 等 |
| 隐式乘法处理 | ✅ 完成 | `2x` → `2*x` |
| 视图切换 | ✅ 完成 | 视频/白板切换 |

#### D. RAG 检索增强 ✅

| 功能 | 状态 | 说明 |
|------|------|------|
| 向量相似度搜索 | ✅ 完成 | Supabase pgvector |
| 关键词搜索 | ✅ 完成 | 精确匹配 |
| 混合搜索 | ✅ 完成 | 语义+关键词 |
| 上下文组装 | ✅ 完成 | 当前节点+节点列表+字幕窗口 |
| 跨视频搜索 | ✅ 完成 | 全库知识点检索 |

#### E. 视频播放器 ✅

| 功能 | 状态 | 说明 |
|------|------|------|
| HTML5 播放 | ✅ 完成 | 自定义控件 |
| 实时字幕同步 | ✅ 完成 | 根据播放时间 |
| 知识点进度条 | ✅ 完成 | 可视化节点位置 |
| 节点完成暂停 | ✅ 完成 | 用于游戏提示 |
| 时间戳跳转 | ✅ 完成 | AI 可控制跳转 |

### 2.2 实验性功能

#### A. AI 游戏生成 ⚠️ 实验中

| 功能 | 状态 | 说明 |
|------|------|------|
| 游戏生成 | ⚠️ 实验 | Claude Agent SDK |
| 批量生成 | ⚠️ 实验 | 一次生成多个游戏 |
| 游戏渲染 | ⚠️ 实验 | React Live 动态渲染 |
| 教师界面 | ⚠️ 实验 | `/teacher` 路由 |
| 反馈收集 | ⚠️ 实验 | 游戏质量反馈 |

**支持的游戏类型：**
- `parameter-slider` - 参数滑块探索
- `drag-match` - 拖拽匹配
- `number-line` - 数轴可视化
- `coordinate-plot` - 坐标绑定
- `equation-balance` - 方程平衡
- `geometry-construct` - 几何构造
- `sequence-puzzle` - 数列谜题
- `fraction-visual` - 分数可视化
- `graph-transform` - 图像变换
- `custom` - 自定义类型

### 2.3 已废弃功能

| 功能 | 状态 | 说明 |
|------|------|------|
| 代码演示工具 | ❌ 已移除 | Pyodide Python 执行，commit `c3af934` |
| 节点分割 V1 | ❌ 已废弃 | 多信号边界检测，已被 V2 替代 |

---

## 三、技术栈

### 3.1 前端技术

| 类别 | 技术 | 版本/说明 |
|------|------|----------|
| 框架 | Next.js | 16 (App Router) |
| UI 库 | React | 19 |
| 样式 | Tailwind CSS | 4 |
| 组件库 | shadcn/ui | Radix UI 基础 |
| 数学渲染 | KaTeX | LaTeX 公式 |
| 函数图像 | Mafs | 交互式 2D 图表 |
| 几何绘图 | Excalidraw | 画布组件 |
| 动画 | Framer Motion | - |
| 图标 | Lucide React | - |
| 代码渲染 | react-live | 动态组件渲染 |
| 转译 | Sucrase | TS → JS |

### 3.2 后端技术

| 类别 | 技术 | 说明 |
|------|------|------|
| 运行时 | Next.js API Routes | Serverless |
| 数据库 | Supabase | PostgreSQL + pgvector |
| 存储 | 阿里云 OSS | 视频文件存储 |
| 向量搜索 | pgvector | 余弦相似度 |

### 3.3 AI 服务

| 服务 | 提供商 | 用途 |
|------|--------|------|
| 语音交互（方案一） | OpenAI | Realtime API |
| 语音识别（方案二） | 字节跳动 | Doubao ASR |
| 语音合成（方案二） | 字节跳动 | Doubao TTS |
| LLM 推理（方案二） | DeepSeek | 函数调用 |
| 视频转写 | 阿里云 | Paraformer-v2 |
| 文本向量化 | 阿里云 | text-embedding-v3 |
| 知识点分割 | OpenAI | GPT-4o |
| 游戏生成 | Anthropic | Claude Agent SDK |

### 3.4 开发工具

| 工具 | 说明 |
|------|------|
| TypeScript | 严格模式 |
| ESLint | 9 + Next.js 配置 |
| Turbopack | 开发构建 |

---

## 四、数据库结构

### 4.1 数据表

#### `videos` - 视频表
```sql
id              TEXT PRIMARY KEY
title           TEXT
description     TEXT
duration        INTEGER (秒)
video_url       TEXT
teacher         TEXT
node_count      INTEGER
status          ENUM('pending', 'processing', 'ready', 'error')
created_at      TIMESTAMPTZ
processed_at    TIMESTAMPTZ
```

#### `video_nodes` - 知识点表
```sql
id                    TEXT PRIMARY KEY
video_id              TEXT REFERENCES videos(id)
order                 INTEGER
start_time            INTEGER (秒)
end_time              INTEGER (秒)
title                 TEXT
summary               TEXT
key_concepts          TEXT[]
transcript            TEXT
embedding             VECTOR(1536)
node_type             ENUM('intro', 'concept', 'method', 'example', 'pitfall', 'summary', 'transition', 'other')
boundary_confidence   FLOAT
boundary_signals      TEXT[]
boundary_reason       TEXT
version               INTEGER
created_by            ENUM('auto', 'human')
created_at            TIMESTAMPTZ
```

#### `video_games` - 游戏表
```sql
id                    TEXT PRIMARY KEY
video_id              TEXT REFERENCES videos(id) ON DELETE CASCADE
node_id               TEXT REFERENCES video_nodes(id) ON DELETE CASCADE
title                 TEXT
description           TEXT
game_type             ENUM (10种类型 + 'custom')
difficulty            ENUM('easy', 'medium', 'hard')
math_concepts         TEXT[]
learning_objectives   TEXT[]
component_code        TEXT (React 组件源码)
instructions          TEXT
hints                 TEXT[]
estimated_play_time   INTEGER (秒)
agent_model           TEXT
generation_time_ms    INTEGER
created_at            TIMESTAMPTZ
updated_at            TIMESTAMPTZ
```

### 4.2 数据库函数

- `search_video_nodes(query_embedding, target_video_id, match_threshold, match_count)` - 向量相似度搜索

---

## 五、项目结构

```
app/src/
├── app/                          # Next.js 页面和 API
│   ├── page.tsx                  # 首页 - 视频列表
│   ├── admin/                    # 视频上传管理
│   ├── teacher/                  # 教师游戏管理界面
│   ├── watch/[id]/               # 学生观看页面
│   └── api/                      # 后端 API
│       ├── game/                 # 游戏生成
│       ├── realtime/             # OpenAI Realtime（旧版）
│       ├── transcribe/           # 视频转写
│       ├── upload/               # 文件上传
│       ├── video/                # 视频 CRUD
│       ├── voice/                # 新语音管道
│       └── whiteboard/           # 白板渲染
├── components/
│   ├── game-player/              # 游戏渲染器
│   ├── game-preview/             # 游戏选择 UI
│   ├── ui/                       # shadcn/ui 组件
│   ├── video-player/             # 视频播放器
│   ├── video-upload/             # 上传组件
│   ├── voice-interaction/        # 语音交互 UI
│   └── whiteboard/               # 白板组件
├── hooks/
│   ├── useRealtimeVoice.ts       # OpenAI Realtime（旧版）
│   ├── usePyodide.ts             # Python 执行（已废弃）
│   └── voice/                    # 新语音管道 (7个文件)
├── lib/
│   ├── game-generator/           # 游戏生成器
│   ├── geometry-renderer/        # 几何渲染
│   ├── node-segmentation/        # V1 分割（已废弃）
│   ├── node-segmentation-v2.ts   # V2 分割
│   ├── aliyun-asr.ts             # 阿里云 ASR
│   ├── embedding.ts              # 向量化
│   ├── oss.ts                    # OSS 存储
│   ├── rag.ts                    # RAG 检索
│   ├── supabase.ts               # 数据库客户端
│   └── video-processor.ts        # 视频处理
└── types/                        # TypeScript 类型定义
```

---

## 六、待完成工作

### 6.1 必要功能（高优先级）

| 功能 | 优先级 | 说明 |
|------|--------|------|
| 用户认证系统 | 🔴 高 | 目前无登录，Supabase RLS 允许公开访问 |
| 学习进度追踪 | 🔴 高 | 记录学生观看进度和互动历史 |
| 视频缩略图 | 🟡 中 | 目前使用 emoji 占位符 |
| 移动端适配 | 🟡 中 | 当前为桌面优先设计 |
| 测试基础设施 | 🟡 中 | 无 Jest/Vitest/Playwright |

### 6.2 功能增强（中优先级）

| 功能 | 优先级 | 说明 |
|------|--------|------|
| 游戏功能稳定化 | 🟡 中 | 当前为实验状态，需要更多测试 |
| 错误处理优化 | 🟡 中 | 增强用户友好的错误提示 |
| 离线支持 | 🟢 低 | PWA 或本地缓存 |
| 多语言支持 | 🟢 低 | 目前仅支持中文 |

### 6.3 运维相关

| 功能 | 优先级 | 说明 |
|------|--------|------|
| 使用分析 | 🟡 中 | 学生行为追踪和分析 |
| 性能监控 | 🟡 中 | API 响应时间、错误率 |
| 日志系统 | 🟡 中 | 结构化日志收集 |
| CI/CD 流程 | 🟡 中 | 自动化构建和部署 |

### 6.4 代码清理

| 任务 | 说明 |
|------|------|
| 删除测试目录 | 9个实验性目录需要清理或归档 |
| 移除废弃代码 | Pyodide 相关代码、V1 分割代码 |
| 提交未跟踪文件 | 多个新功能文件未提交到 Git |

---

## 七、环境变量配置

### 最小配置（二选一）

**方案一：OpenAI Realtime**
```env
OPENAI_API_KEY=sk-...
```

**方案二：Doubao + DeepSeek（推荐）**
```env
DEEPSEEK_API_KEY=sk-...
DOUBAO_API_TOKEN=your-bearer-token
```

### 完整配置
```env
# 语音方案一
OPENAI_API_KEY=sk-...

# 语音方案二
DEEPSEEK_API_KEY=sk-...
DOUBAO_API_TOKEN=your-bearer-token
DOUBAO_ASR_RESOURCE_ID=volc.seedasr.sauc.duration
DOUBAO_TTS_RESOURCE_ID=seed-tts-2.0
DOUBAO_TTS_VOICE=zh_female_tianmeixiaoyuan_moon_bigtts

# 游戏生成
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_BASE_URL=https://custom-api.com  # 可选
GAME_AGENT_MODEL=claude-sonnet-4-20250514

# 数据库
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key

# 阿里云服务
DASHSCOPE_API_KEY=sk-...
OSS_REGION=oss-cn-hangzhou
OSS_BUCKET=your-bucket
OSS_ACCESS_KEY_ID=...
OSS_ACCESS_KEY_SECRET=...
```

---

## 八、Git 状态

### 已修改文件（13个）
- `CLAUDE.md`
- `app/package.json`, `app/package-lock.json`
- `app/src/app/admin/page.tsx`
- `app/src/app/api/video/[id]/route.ts`
- `app/src/app/api/video/full-process/route.ts`
- `app/src/app/watch/[id]/page.tsx`
- `app/src/components/video-player/VideoPlayer.tsx`
- `app/src/components/video-upload/VideoUploader.tsx`
- `app/src/components/voice-interaction/VoiceInteraction.tsx`
- `app/src/hooks/useRealtimeVoice.ts`
- `app/src/types/database.ts`

### 未跟踪文件/目录
- `app/public/audio-worklets/`
- `app/public/subtitles/*.json` (7个文件)
- `app/src/app/api/game/`
- `app/src/app/api/video/[id]/nodes/`
- `app/src/app/api/video/route.ts`
- `app/src/app/api/voice/`
- `app/src/app/teacher/`
- `app/src/app/test-voice/`
- `app/src/components/game-player/`
- `app/src/components/game-preview/`
- `app/src/components/ui/badge.tsx`
- `app/src/components/ui/switch.tsx`
- `app/src/components/ui/textarea.tsx`
- `app/src/hooks/voice/`
- `app/src/lib/game-generator/`
- `app/supabase/`

---

## 九、统计数据

| 指标 | 数量 |
|------|------|
| TypeScript 文件 | 79 |
| React 组件 | 21 |
| API 路由 | 19 |
| Hooks | 9 |
| 库文件 | 19 |
| 测试目录 | 9 |
| 依赖包 | 37 |
| 开发依赖 | 9 |

---

## 十、总结

MathTalkTV 是一个**功能丰富的 MVP**，核心功能已经完成：

**优势：**
- 双语音后端方案（OpenAI Realtime 或 Doubao+DeepSeek）
- 完整的视频处理流水线
- 先进的 RAG 向量搜索
- 交互式数学渲染（公式、图像、几何）
- 实验性 AI 游戏生成

**待改进：**
- 缺少用户认证系统
- 缺少测试基础设施
- 游戏生成功能仍为实验状态
- 存在多个废弃/测试目录需要清理
- 移动端适配不足

**下一步建议：**
1. 实现用户认证和学习进度追踪
2. 稳定化游戏生成功能
3. 添加测试基础设施
4. 清理废弃代码和测试目录
5. 提交所有未跟踪的新功能代码
