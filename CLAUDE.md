# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MathTalkTV is an interactive voice-enabled video learning platform for mathematics education. Students can pause educational videos and ask AI questions in real-time using voice, with AI responding via speech and visual demonstrations on a whiteboard. Target audience is middle school students (12-15 years old) learning mathematics in Chinese.

**Key Features:**
- Real-time voice conversation with AI tutor (OpenAI Realtime, Doubao Realtime S2S, or Doubao+DeepSeek pipeline)
- Interactive whiteboard with LaTeX formulas and function graphs
- Video node segmentation with RAG-powered search
- AI-generated math games for practice

## Tech Stack

- **Framework:** Next.js 16 with App Router
- **Language:** TypeScript (strict mode)
- **UI:** React 19, Tailwind CSS 4, shadcn/ui (Radix UI)
- **Math Rendering:** KaTeX for LaTeX formulas, Mafs for interactive function graphs
- **Animation:** Framer Motion
- **AI Services:** OpenAI Realtime API, Doubao Realtime S2S, Doubao ASR/TTS + DeepSeek LLM (voice interaction), Whisper/Paraformer API (video transcription), Claude Agent SDK (game generation)
- **Database:** Supabase (PostgreSQL with pgvector for RAG)
- **Storage:** Aliyun OSS for video files
- **Icons:** Lucide React

## Commands

All commands run from the `/app` directory:

```bash
# Development
npm run dev              # Start dev server on http://localhost:3000
npm run build            # Production build
npm run start            # Start production server
npm run lint             # Run ESLint (runs `eslint` with no path args)

# Adding shadcn/ui components
npx shadcn@latest add [component-name]
```

**Note:** No test runner is configured. Testing infrastructure would need to be added if tests are required.

## Architecture

### High-Level System

```
┌─────────────────┐
│   Video Player  │  ← Student watches educational videos
└────────┬────────┘
         │
         │ pauses & clicks
         │ "加入对话" (join conversation)
         ▼
┌─────────────────────────────────────┐
│  /api/realtime                       │  ← Creates OpenAI Realtime session
│  - Injects RAG context               │
│  - System prompt as friendly tutor  │
└────────┬────────────────────────────┘
         │
         │ WebSocket connection
         ▼
┌─────────────────────────────────────┐
│  OpenAI Realtime API                │  ← Voice processing & AI reasoning
│  - 24kHz PCM audio                  │
│  - Tool calls: whiteboard, video    │
└────────┬────────────────────────────┘
         │
         │ Tool invocations
         ▼
┌──────────────┬──────────────┬──────────────┐
│  Whiteboard  │    Video     │  Math Games  │
│  - LaTeX     │  - Jump to   │  - AI-generated│
│  - Graphs    │    nodes     │    practice   │
│  - Drawings  │  - Resume     │  - Interactive │
└──────────────┴──────────────┴──────────────┘
```

### Core Components

**Frontend Components:**
- `src/components/video-player/` - HTML5 video with subtitle sync, view switching
- `src/components/voice-interaction/` - Chat UI with voice controls
- `src/components/whiteboard/` - Math rendering (KaTeX, Mafs)
- `src/components/game-player/` - Interactive math game interface
- `src/components/game-preview/` - Game selection and preview
- `src/components/node-editor/` - Timeline-based video node editor (drag-to-resize, validation)

**Core Logic:**
- `src/hooks/useRealtimeVoice.ts` - WebSocket, audio I/O, VAD, tool handling (OpenAI Realtime)
- `src/hooks/voice/` - Three-stage voice pipeline (Doubao ASR + DeepSeek LLM + Doubao TTS)
- `src/hooks/usePyodide.ts` - Python execution in browser (code demos)
- `src/lib/game-generator/` - AI game generation using Claude Agent SDK
- `src/lib/node-validation.ts` - Video node time validation (overlap, bounds checking)

**Backend APIs:**
- `/api/realtime` - OpenAI Realtime session creation (legacy)
- `/api/voice/*` - New voice endpoints (session, chat, asr, tts, doubao-realtime, tool-detect)
- `/api/video/*` - Video CRUD, processing, search, context, and segment-volcengine endpoints
- `/api/video/[id]/nodes` - Node CRUD with batch sync (create, update, delete in one request)
- `/api/game/*` - Game generation (generate, batch-generate, feedback, per-game feedback)
- `/api/transcribe` - Whisper transcription with caching
- `/api/upload` - File upload to Aliyun OSS

### Video Processing Pipeline

1. **Upload** → Aliyun OSS storage
2. **Transcription** → Paraformer API with timestamps
3. **Node Segmentation** → Two methods available:
   - **GPT-4o (default)**: Semantic analysis of transcript, understands teaching structure
   - **Volcengine**: Visual scene detection, fast, good for PPT/whiteboard transitions
4. **Embedding** → DashScope vectorization for RAG
5. **Storage** → Supabase with pgvector for similarity search

## Environment Setup

Create `app/.env.local` from `.env.local.example`:

```bash
# Voice Backend Option 1: OpenAI Realtime API (legacy)
OPENAI_API_KEY=sk-...

# Voice Backend Option 2: Doubao ASR + DeepSeek LLM + Doubao TTS (recommended)
# DeepSeek LLM
DEEPSEEK_API_KEY=sk-...

# Doubao Voice (Bearer Token for ASR and TTS)
DOUBAO_API_TOKEN=your-api-token

# Optional: Doubao resource IDs (defaults shown)
# DOUBAO_ASR_RESOURCE_ID=volc.bigasr.sauc.duration
# DOUBAO_TTS_RESOURCE_ID=volc.megatts.default
# DOUBAO_TTS_VOICE=zh_female_tianmeixiaoyuan_moon_bigtts

# Game Generation (Claude Agent SDK)
ANTHROPIC_API_KEY=sk-ant-...          # For Claude models
# Optional: Custom Anthropic-compatible API provider
# ANTHROPIC_BASE_URL=your-custom-api-endpoint
# GAME_AGENT_MODEL=claude-opus-4-5-20251101

# Optional: Supabase (RAG + storage)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key

# Optional: Aliyun (embedding + ASR + OSS)
DASHSCOPE_API_KEY=sk-...
OSS_REGION=oss-cn-hangzhou
OSS_BUCKET=your-bucket
OSS_ACCESS_KEY_ID=...
OSS_ACCESS_KEY_SECRET=...

# Optional: Volcengine (visual scene segmentation)
VOLCENGINE_ACCESS_KEY_ID=...
VOLCENGINE_ACCESS_KEY_SECRET=...
```

**Minimum requirement:** One of the following for voice interaction:
- OpenAI API key (for OpenAI Realtime)
- Doubao API token (for Doubao Realtime S2S)
- Doubao API token + DeepSeek API key (for three-stage pipeline)

## Critical Files

### Voice Interaction
**Option 1: OpenAI Realtime (Legacy):**
- **`useRealtimeVoice.ts`** - Core WebSocket + audio management
- **`/api/realtime/route.ts`** - System prompt engineering, RAG context injection

**Option 2: Doubao Realtime S2S:**
- **`src/hooks/voice/useDoubaoRealtimeVoice.ts`** - Doubao realtime voice integration
- **`/api/voice/doubao-realtime/route.ts`** - Doubao realtime WebSocket proxy

**Option 3: Three-Stage Pipeline (Doubao ASR + DeepSeek LLM + Doubao TTS):**
- **`src/hooks/voice/useVoiceInteraction.ts`** - Main coordinator hook
- **`src/hooks/voice/useDoubaoASR.ts`** - Doubao streaming ASR client
- **`src/hooks/voice/useDeepSeekLLM.ts`** - DeepSeek LLM with function calling
- **`src/hooks/voice/useDoubaoTTS.ts`** - Doubao bidirectional TTS client
- **`/api/voice/session/route.ts`** - Session initialization with RAG context
- **`/api/voice/chat/route.ts`** - DeepSeek streaming proxy
- **`/api/voice/asr/route.ts`** - ASR endpoint
- **`/api/voice/tts/route.ts`** - TTS endpoint

**Shared Voice Infrastructure:**
- **`src/hooks/voice/useAudioCapture.ts`** - Microphone capture with resampling
- **`src/hooks/voice/useAudioPlayback.ts`** - Audio playback queue
- **`src/hooks/voice/doubao-protocol.ts`** - Doubao WebSocket protocol definitions
- **`src/hooks/voice/types.ts`** - Voice system type definitions
- **`/api/voice/tool-detect/route.ts`** - Tool detection endpoint

**AI Tools configured:**
  - `use_whiteboard` - formula/graph/drawing rendering
  - `resume_video` - continues playback
  - `jump_to_video_node` - navigates to knowledge points
  - `load_tool_guide` - on-demand help loading

### Math Rendering
- **`Whiteboard.tsx`** - KaTeX + Mafs + expression parsing
  - Converts `x^2` → `Math.pow(x, 2)`
  - Handles trig functions, implicit multiplication
  - Safe evaluation with `new Function()` + validation

### Game Generation (Experimental)
- **`/lib/game-generator/index.ts`** - Claude Agent SDK integration
- **`/lib/game-generator/prompts.ts`** - Game generation prompts
- **`/lib/game-generator/types.ts`** - Game data structures
- **`/app/teacher/page.tsx`** - Teacher interface for game creation

### Node Segmentation
- **`/lib/node-segmentation/`** - V1 pipeline (deprecated)
- **`/lib/node-segmentation-v2.ts`** - GPT-4o semantic analysis (default)
- **`/lib/volcengine-scene-segmentation.ts`** - Volcengine visual scene detection API
- **`/lib/volcengine-auth.ts`** - Volcengine AWS Signature V4 authentication
- **`/lib/volcengine-node-converter.ts`** - Convert Volcengine scenes to VideoNode format
- **`/lib/volcengine-upload.ts`** - Upload video to Volcengine for processing
- **`/lib/video-processor.ts`** - Main processing pipeline, supports both methods

## Data Flow

### Voice Interaction Flow
1. Student pauses video → clicks "加入对话"
2. Frontend calls `/api/realtime` → session token returned
3. WebSocket connects to OpenAI Realtime API
4. Audio capture: PCM 16-bit @ 24kHz → base64 → WebSocket
5. AI processes → tool calls → TTS audio returned
6. Whiteboard/video updates based on AI tool invocations

### RAG Context Injection
`/api/realtime/route.ts` assembles context:
- **Video nodes** - All knowledge points with timestamps
- **Current window** - Last 30s of subtitles before pause
- Passed to OpenAI session creation for contextual responses

### Video Search
1. Vector similarity search in Supabase (`search_video_nodes` RPC)
2. Finds relevant knowledge points across all videos
3. Returns nodes with timestamps for jump navigation

## Database Schema

Key Supabase tables (`src/types/database.ts`):
- **`videos`** - Metadata (title, url, status, node_count)
- **`video_nodes`** - Knowledge segments with embeddings
  - `start_time`/`end_time` - Integer seconds
  - `embedding` - pgvector for similarity search
  - `boundary_confidence` - V1 segmentation quality score
- **`video_games`** - AI-generated math games linked to video nodes

## Audio Specifications

- **Sample Rate:** 24kHz (input & output)
- **Format:** PCM 16-bit
- **Encoding:** base64 for WebSocket
- **Queue:** Sequential playback with interruption support
- **VAD:** Voice Activity Detection for input handling

## Path Aliases

`@/*` → `./src/*` (configured in `tsconfig.json`)

## App Routes

- `/` - Video list homepage
- `/watch/[id]` - Student video player with voice interaction
- `/admin` - Video upload and management
- `/teacher` - Teacher interface for game creation
- `/teacher/video/[id]` - Per-video game management

## Important Implementation Details

### Expression Parsing (Whiteboard)
The `Whiteboard.tsx` component safely parses math expressions:
- Power notation conversion
- Trigonometric function mapping
- Implicit multiplication insertion
- Validation with `isFinite()` checks

## Development Notes

### Adding New Features

**Math rendering:**
1. KaTeX for formulas (add to Whiteboard.tsx)
2. Mafs for interactive graphs

**API endpoints:**
1. Add route in `/src/app/api/`
2. Use Supabase client from `@/lib/supabase.ts`
3. Follow existing RAG patterns in `@/lib/rag.ts`

**Game generation:**
1. Define types in `/lib/game-generator/types.ts`
2. Create prompts in `/lib/game-generator/prompts.ts`
3. Implement in `/lib/game-generator/index.ts`
4. Add UI in components

