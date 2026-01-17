# MathTalkTV

交互式语音数学视频学习平台 - 让学生可以随时暂停视频，用语音向 AI 提问，获得语音回答和可视化讲解。

## 功能特点

- **语音交互** - 基于 OpenAI Realtime API，支持实时语音对话
- **智能白板** - LaTeX 公式渲染、函数图像绘制、几何图形演示
- **代码演示** - 浏览器端 Python 执行，支持 NumPy/SymPy
- **知识点跳转** - RAG 检索支持，可跳转到视频任意知识点
- **视频处理** - 自动转写字幕、智能切分知识点节点

## 技术栈

- **框架:** Next.js 16 (App Router) + TypeScript
- **UI:** React 19, Tailwind CSS 4, shadcn/ui
- **数学渲染:** KaTeX + Mafs + Excalidraw
- **代码执行:** CodeMirror 6 + Pyodide (WASM)
- **AI 服务:** OpenAI Realtime API, Whisper
- **数据库:** Supabase (PostgreSQL + pgvector)
- **存储:** 阿里云 OSS

## 快速开始

### 环境要求

- Node.js 18+
- npm 或 yarn

### 安装

```bash
# 克隆项目
git clone https://github.com/hunterr198/MathTalkTV.git
cd MathTalkTV/app

# 安装依赖
npm install

# 配置环境变量
cp .env.local.example .env.local
# 编辑 .env.local，填入你的 API Key
```

### 环境变量

在 `app/.env.local` 中配置：

```env
# 必需：OpenAI API Key（需要 Realtime API 权限）
OPENAI_API_KEY=sk-...

# 可选：Supabase（用于 RAG 向量检索）
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key

# 可选：阿里云 DashScope（语音识别和向量嵌入）
DASHSCOPE_API_KEY=sk-...

# 可选：阿里云 OSS（视频存储）
OSS_REGION=oss-cn-hangzhou
OSS_BUCKET=your-bucket
OSS_ACCESS_KEY_ID=your-key-id
OSS_ACCESS_KEY_SECRET=your-key-secret
```

### 运行

```bash
cd app
npm run dev
```

访问 http://localhost:3000

## 使用方式

1. 在首页选择一个数学视频
2. 观看视频，有疑问时点击暂停
3. 点击「加入对话」按钮
4. 用语音向 AI 提问
5. AI 会通过语音回答，并在白板上展示公式、图形等

## 项目结构

```
app/
├── src/
│   ├── app/                    # Next.js 路由
│   │   ├── page.tsx           # 首页 - 视频列表
│   │   ├── watch/[id]/        # 视频播放页
│   │   ├── admin/             # 管理后台
│   │   └── api/               # API 路由
│   ├── components/
│   │   ├── video-player/      # 视频播放器
│   │   ├── voice-interaction/ # 语音交互
│   │   ├── whiteboard/        # 智能白板
│   │   └── code-demo/         # 代码演示
│   ├── hooks/
│   │   ├── useRealtimeVoice.ts # 语音交互核心逻辑
│   │   └── usePyodide.ts      # Python 执行
│   └── lib/                   # 工具函数
```

## AI 工具能力

AI 助手具备以下工具：

| 工具 | 功能 |
|------|------|
| `use_whiteboard` | 显示公式、函数图像、几何图形 |
| `use_code_demo` | 展示 Python 代码并执行 |
| `resume_video` | 恢复视频播放 |
| `jump_to_video_node` | 跳转到指定知识点 |

## 开发命令

```bash
npm run dev      # 启动开发服务器
npm run build    # 生产构建
npm run lint     # 代码检查
```

## License

MIT
