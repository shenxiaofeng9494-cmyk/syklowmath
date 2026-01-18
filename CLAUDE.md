# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MathTalkTV is an interactive voice-enabled video learning platform for mathematics education. Students can pause educational videos and ask AI questions in real-time using voice, with AI responding via speech and visual demonstrations on a whiteboard. Target audience is middle school students (12-15 years old) learning mathematics in Chinese.

## Tech Stack

- **Framework:** Next.js 16 with App Router
- **Language:** TypeScript (strict mode)
- **UI:** React 19, Tailwind CSS 4, shadcn/ui (Radix UI)
- **Math Rendering:** KaTeX for LaTeX formulas, Mafs for interactive function graphs, Excalidraw for geometry drawings
- **Animation:** Framer Motion
- **AI Services:** OpenAI Realtime API (voice interaction), Whisper/Paraformer API (video transcription)
- **Database:** Supabase (PostgreSQL with pgvector for RAG)
- **Storage:** Aliyun OSS for video files
- **Icons:** Lucide React

## Commands

```bash
# All commands run from /app directory
cd app

npm run dev      # Start development server on http://localhost:3000
npm run build    # Production build
npm run lint     # ESLint
npm start        # Start production server
```

Adding shadcn/ui components:
```bash
npx shadcn@latest add [component-name]
```

## Architecture

### Directory Structure

```
app/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── page.tsx           # Home - video list
│   │   ├── watch/[id]/page.tsx # Video player + voice interaction
│   │   ├── admin/page.tsx     # Admin dashboard
│   │   └── api/
│   │       ├── realtime/route.ts      # Creates OpenAI Realtime session
│   │       ├── transcribe/route.ts    # Whisper transcription with caching
│   │       ├── upload/route.ts        # Video upload handling
│   │       └── video/
│   │           ├── [id]/route.ts      # Get video by ID
│   │           ├── process/route.ts   # Video processing
│   │           ├── full-process/route.ts
│   │           └── search/route.ts    # Video search (RAG)
│   ├── components/
│   │   ├── video-player/      # HTML5 video with subtitle sync, ViewSwitcher
│   │   ├── voice-interaction/ # Chat UI + voice handling
│   │   └── whiteboard/        # LaTeX formulas, function graphs, geometry drawings
│   ├── hooks/
│   │   └── useRealtimeVoice.ts # WebSocket + audio processing (core voice logic)
│   ├── tool-guides/            # Tool usage guides (loaded on-demand)
│   │   ├── loader.ts          # YAML frontmatter parsing, guide loading
│   │   ├── whiteboard/GUIDE.md # formula/graph/drawing usage
│   │   └── drawing/GUIDE.md   # Geometry coordinate system details
│   ├── types/
│   │   └── excalidraw.ts      # TypeScript interfaces for drawing & code data
│   ├── lib/
│   │   ├── utils.ts           # Utility functions (cn helper)
│   │   ├── supabase.ts        # Supabase client initialization
│   │   ├── oss.ts             # Aliyun OSS client for video storage
│   │   ├── rag.ts             # RAG queries (getNodeByTime, searchNodes, getAllNodes)
│   │   ├── embedding.ts       # Vector embedding utilities (DashScope)
│   │   ├── aliyun-asr.ts      # Aliyun Paraformer speech recognition
│   │   ├── video-processor.ts # Video processing orchestration
│   │   └── node-segmentation/ # V1 node segmentation pipeline
│   │       ├── index.ts           # Main entry: segmentVideoNodesV1()
│   │       ├── candidate-boundaries.ts  # Multi-signal boundary detection
│   │       ├── llm-adjudicator.ts      # LLM-based boundary confirmation
│   │       ├── merge-split.ts          # Duration constraint enforcement
│   │       └── quality-validator.ts    # Boundary quality checks
│   └── data/
│       └── videos.ts          # Video metadata + subtitle utilities
├── public/
│   ├── videos/                # Video files (place demo.mp4 here)
│   └── subtitles/             # Cached subtitle JSONs
```

### Key Data Flow

1. Student pauses video → clicks "加入对话" (join conversation)
2. Frontend calls `/api/realtime` for session token
3. WebSocket connects to OpenAI Realtime API
4. Voice captured (PCM 16-bit @ 24kHz) → AI processes → TTS audio returned
5. AI tool calls: `use_whiteboard` renders LaTeX formulas, `resume_video` continues playback

### Critical Files

- `useRealtimeVoice.ts`: Core voice interaction hook managing WebSocket, audio capture/playback, VAD, and tool handling
- `/api/realtime/route.ts`: System prompt engineering - AI configured as friendly peer tutor ("学长/学姐"), requires whiteboard for all formulas
- `Whiteboard.tsx`: KaTeX formula rendering and Mafs function graphing with step-by-step animation support
- `ViewSwitcher.tsx`: Switches between video and drawing (Excalidraw) views

### AI Tool Calls

The OpenAI Realtime API is configured with four tools that the AI can invoke:
- `use_whiteboard`: Displays math content on the whiteboard. Supports three types:
  - `formula`: LaTeX formulas rendered with KaTeX
  - `graph`: Function plots rendered with Mafs
  - `drawing`: Geometry drawings rendered with Excalidraw (auto-switches to drawing view)
- `resume_video`: Resumes video playback when student indicates understanding (auto-switches back to video view)
- `jump_to_video_node`: Jumps to a specific knowledge point in the video. Searches subtitles first (precise timestamps), falls back to node list
- `load_tool_guide`: Loads detailed tool usage guides on-demand from `src/tool-guides/*/GUIDE.md`. Available guides: whiteboard, drawing. System prompt is kept slim; detailed instructions loaded when needed

### RAG Context Injection

The `/api/realtime` route injects context into the AI system prompt:
- **Node list**: All video nodes with timestamps for jump navigation
- **Current 30-second window**: Subtitle text from the last 30 seconds before pause (prevents AI from referencing content user hasn't seen)
- Context is assembled in `route.ts` and passed to OpenAI session creation

## Environment Setup

Create `app/.env.local` from `.env.local.example`:
```
# Required: OpenAI API key for Realtime API voice interaction
OPENAI_API_KEY=sk-...

# Optional: Supabase for RAG vector retrieval and video storage
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key

# Optional: Aliyun DashScope for embedding and ASR
DASHSCOPE_API_KEY=sk-...

# Optional: Aliyun OSS for video file storage
OSS_REGION=oss-cn-hangzhou
OSS_BUCKET=your-bucket-name
OSS_ACCESS_KEY_ID=your-access-key-id
OSS_ACCESS_KEY_SECRET=your-access-key-secret
```

Minimum requirement: OpenAI API key with access to Realtime API and Whisper.

## Path Aliases

TypeScript configured with `@/*` → `./src/*` (defined in tsconfig.json)

## Audio Processing

- Sample rate: 24kHz for both input capture and playback
- Format: PCM 16-bit, base64 encoded for WebSocket transmission
- Audio queue management in `useRealtimeVoice.ts` for sequential playback
- Supports speech interruption (clears playback queue on new user input)

## Expression Parsing (Whiteboard)

The `Whiteboard.tsx` component parses math expressions to JavaScript for Mafs graphing:
- Converts power notation: `x^2` → `Math.pow(x, 2)`
- Handles trig functions: `sin`, `cos`, `tan`, etc.
- Supports implicit multiplication: `2x` → `2*x`
- Safe evaluation using `new Function()` with isFinite validation

## Video Processing Pipeline

When a video is uploaded via `/admin`:
1. **Upload**: Video stored to Aliyun OSS
2. **Transcription**: Paraformer API generates subtitles with timestamps
3. **Node Segmentation (V1)**: Multi-signal boundary detection → LLM adjudication → duration constraints → quality validation
4. **Embedding**: Node summaries embedded via DashScope for RAG search
5. **Storage**: Video metadata and nodes saved to Supabase

### Node Segmentation V1 Architecture

Located in `src/lib/node-segmentation/`:
- **Candidate generation**: Combines pause detection, discourse markers ("接下来", "例如"), semantic drift (embedding similarity), and structure patterns
- **LLM adjudication**: GPT-4o confirms/rejects candidates in chunks
- **Constraints**: Merge nodes < 45s, split nodes > 240s, add 2s overlap for smooth jumps
- **Validation**: Detects half-sentence starts ("所以", "因此") and dangling ends

## Database Schema

Key Supabase tables (see `src/types/database.ts`):
- `videos`: Video metadata (id, title, video_url, status, node_count)
- `video_nodes`: Knowledge point segments with embeddings for RAG
  - `start_time`/`end_time`: Integer seconds
  - `embedding`: pgvector for similarity search
  - `boundary_confidence`, `boundary_signals`: V1 segmentation metadata

RPC function `search_video_nodes` performs vector similarity search.
