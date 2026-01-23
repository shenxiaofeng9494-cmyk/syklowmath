# MathTalkTV RAG 节点化设计方案

## 一、设计目标

基于视频内容的节点化结构，实现：
1. **智能问答**：学生提问时，AI 能基于课程内容精准回答
2. **快速检索**：节点级 RAG 检索，比分块检索更快更准
3. **回溯跳转**：学生说"之前的XX没听懂"，视频自动跳转到对应节点
4. **进度标记**：进度条显示知识点节点，支持点击跳转

---

## 二、核心数据结构

### 2.1 节点模型

```typescript
// 视频节点 - 一个语义完整的知识点单元
interface VideoNode {
  id: string;                       // 节点唯一ID: "node-{videoId}-{order}"
  videoId: string;                  // 所属视频ID
  order: number;                    // 节点顺序: 1, 2, 3...

  // === 时间定位 ===
  startTime: number;                // 开始时间（秒）
  endTime: number;                  // 结束时间（秒）

  // === 内容摘要（用于RAG检索）===
  title: string;                    // 节点标题: "配方法的基本步骤"
  summary: string;                  // 内容摘要（50-100字）
  keyConcepts: string[];            // 关键概念: ["配方法", "完全平方式"]

  // === 原始内容 ===
  transcript: string;               // 该节点的完整字幕文本

  // === 向量索引 ===
  embedding: number[];              // 摘要+关键词的向量表示 (1536维)
}

// 视频元数据
interface Video {
  id: string;
  title: string;
  description: string;
  duration: number;                 // 视频时长（秒）
  videoUrl: string;
  nodeCount: number;                // 节点数量
  createdAt: Date;
  processedAt: Date;                // 预处理完成时间
}
```

### 2.2 数据示例

```json
{
  "video": {
    "id": "quadratic-eq-01",
    "title": "一元二次方程的解法",
    "duration": 600,
    "nodeCount": 5
  },
  "nodes": [
    {
      "id": "node-quadratic-eq-01-1",
      "videoId": "quadratic-eq-01",
      "order": 1,
      "startTime": 0,
      "endTime": 95,
      "title": "一元二次方程的定义与标准形式",
      "summary": "介绍一元二次方程的定义，标准形式为ax²+bx+c=0（a≠0）。通过实例说明如何将方程化为标准形式，强调二次项系数不能为零。",
      "keyConcepts": ["一元二次方程", "标准形式", "二次项系数", "a≠0"],
      "transcript": "同学们好，今天我们来学习一元二次方程。什么是一元二次方程呢？..."
    },
    {
      "id": "node-quadratic-eq-01-2",
      "videoId": "quadratic-eq-01",
      "order": 2,
      "startTime": 95,
      "endTime": 210,
      "title": "直接开平方法",
      "summary": "讲解直接开平方法解方程，适用于(x+a)²=b形式。演示解题步骤：移项、开方、注意正负根。",
      "keyConcepts": ["直接开平方法", "完全平方", "正负根"],
      "transcript": "第一种解法叫直接开平方法，当方程可以化成..."
    },
    {
      "id": "node-quadratic-eq-01-3",
      "videoId": "quadratic-eq-01",
      "order": 3,
      "startTime": 210,
      "endTime": 380,
      "title": "配方法的原理与步骤",
      "summary": "详细讲解配方法，包括：1.移常数项 2.二次项系数化为1 3.加减一次项系数一半的平方 4.化为完全平方式。通过例题演示完整过程。",
      "keyConcepts": ["配方法", "完全平方式", "配方步骤", "一次项系数"],
      "transcript": "接下来我们学习配方法，这是一个非常重要的方法..."
    },
    {
      "id": "node-quadratic-eq-01-4",
      "videoId": "quadratic-eq-01",
      "order": 4,
      "startTime": 380,
      "endTime": 500,
      "title": "求根公式的推导",
      "summary": "通过配方法推导求根公式x=(-b±√(b²-4ac))/2a，引入判别式Δ=b²-4ac的概念，说明判别式与根的个数的关系。",
      "keyConcepts": ["求根公式", "判别式", "Δ", "b²-4ac", "根的个数"],
      "transcript": "现在我们用配方法来推导一个万能公式..."
    },
    {
      "id": "node-quadratic-eq-01-5",
      "videoId": "quadratic-eq-01",
      "order": 5,
      "startTime": 500,
      "endTime": 600,
      "title": "求根公式的应用与练习",
      "summary": "通过三道例题演示求根公式的使用方法，强调代入时注意符号，以及如何根据判别式判断解的情况。",
      "keyConcepts": ["求根公式应用", "代入求解", "判别式应用"],
      "transcript": "好，现在我们来做几道练习题..."
    }
  ]
}
```

### 2.3 节点 vs 固定分块对比

| 维度 | 固定分块（30秒） | 节点化设计 |
|-----|-----------------|-----------|
| 10分钟视频 | ~20 个块 | ~5-8 个节点 |
| 语义完整性 | ❌ 可能切断知识点 | ✅ 完整知识点 |
| 检索目标 | 原始字幕片段 | 摘要 + 关键词 |
| 检索精度 | 中等 | 高 |
| 检索速度 | O(n) n=块数 | O(n) n=节点数，更快 |
| 返回内容 | 30秒字幕 | 完整知识点讲解 |
| 支持跳转 | ❌ 随机位置 | ✅ 知识点开头 |
| 进度条标记 | ❌ | ✅ 天然支持 |

---

## 三、视频预处理 Pipeline

### 3.1 处理流程

```
┌─────────────────────────────────────────────────────────────────────┐
│                    视频预处理 Pipeline                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ Step 1: 语音转写                                             │   │
│  │ 输入: 视频文件                                                │   │
│  │ 处理: Whisper API                                            │   │
│  │ 输出: 带时间戳的字幕 [{text, start, end}, ...]               │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              ↓                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ Step 2: 节点切分                                             │   │
│  │ 输入: 完整字幕文本                                            │   │
│  │ 处理: GPT-4 识别知识点边界                                    │   │
│  │ 输出: 节点边界 [{order, startTime, endTime}, ...]            │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              ↓                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ Step 3: 节点内容增强                                          │   │
│  │ 输入: 每个节点的字幕文本                                       │   │
│  │ 处理: GPT-4 生成 title + summary + keyConcepts               │   │
│  │ 输出: 增强后的节点数据                                        │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              ↓                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ Step 4: 向量化                                               │   │
│  │ 输入: summary + keyConcepts.join(' ')                        │   │
│  │ 处理: OpenAI text-embedding-3-small                          │   │
│  │ 输出: 1536维向量                                              │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              ↓                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ Step 5: 存储                                                 │   │
│  │ 目标: Supabase PostgreSQL + pgvector                         │   │
│  │ 数据: videos 表 + video_nodes 表                             │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 3.2 节点切分 Prompt

```
你是一个教学视频分析专家。请分析以下数学教学视频的字幕内容，将其切分为若干个知识点节点。

切分原则：
1. 每个节点应该是一个完整的知识点或教学环节
2. 节点边界通常出现在：话题转换、新概念引入、从讲解转到例题等位置
3. 每个节点时长建议在 1-3 分钟之间
4. 注意识别老师的过渡语，如"接下来""下面我们来看""好，现在"等

字幕内容（带时间戳）：
{transcript_with_timestamps}

请输出 JSON 格式的节点边界：
{
  "nodes": [
    {"order": 1, "startTime": 0, "endTime": 95, "boundary_reason": "引入一元二次方程定义"},
    {"order": 2, "startTime": 95, "endTime": 210, "boundary_reason": "开始讲解直接开平方法"},
    ...
  ]
}
```

### 3.3 节点增强 Prompt

```
你是一个数学教学内容分析专家。请分析以下知识点节点的字幕内容，生成结构化的摘要信息。

节点字幕：
{node_transcript}

请输出 JSON 格式：
{
  "title": "简洁的节点标题（10字以内）",
  "summary": "节点内容摘要（50-100字），包含讲了什么、重点是什么",
  "keyConcepts": ["关键概念1", "关键概念2", ...] // 3-6个关键词
}

要求：
1. title 要简洁明了，能让学生快速理解这部分讲什么
2. summary 要概括核心内容，便于后续检索匹配
3. keyConcepts 提取数学术语和关键词，用于精确匹配
```

---

## 四、RAG 检索策略

### 4.1 检索架构

```
┌─────────────────────────────────────────────────────────────────────┐
│                         RAG 检索流程                                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   学生提问: "配方法是怎么做的？"                                      │
│                              ↓                                      │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │                    混合检索策略                               │   │
│   │                                                             │   │
│   │   ┌─────────────────┐      ┌─────────────────┐             │   │
│   │   │   语义检索       │      │   关键词检索     │             │   │
│   │   │                 │      │                 │             │   │
│   │   │ query→embedding │      │ query→keywords  │             │   │
│   │   │       ↓         │      │       ↓         │             │   │
│   │   │ 向量相似度搜索   │      │ keyConcepts匹配 │             │   │
│   │   │       ↓         │      │       ↓         │             │   │
│   │   │   Top 3 节点    │      │   匹配节点       │             │   │
│   │   └────────┬────────┘      └────────┬────────┘             │   │
│   │            │                        │                       │   │
│   │            └───────────┬────────────┘                       │   │
│   │                        ↓                                    │   │
│   │                   结果融合 + 去重                            │   │
│   │                        ↓                                    │   │
│   │                 排序（相关性 + 时间邻近性）                   │   │
│   │                        ↓                                    │   │
│   │                   返回 Top 3 节点                           │   │
│   └─────────────────────────────────────────────────────────────┘   │
│                              ↓                                      │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │                    上下文组装                                │   │
│   │                                                             │   │
│   │   当前节点上下文（播放位置对应的节点）                         │   │
│   │         +                                                   │   │
│   │   检索到的相关节点内容                                        │   │
│   │         ↓                                                   │   │
│   │   组装成 System Prompt 注入 AI                               │   │
│   └─────────────────────────────────────────────────────────────┘   │
│                              ↓                                      │
│   AI 基于上下文生成回答                                             │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 4.2 检索 SQL 示例

```sql
-- 混合检索：语义 + 关键词
WITH semantic_search AS (
  -- 语义检索：向量相似度
  SELECT
    id,
    video_id,
    title,
    summary,
    transcript,
    start_time,
    end_time,
    1 - (embedding <=> $1::vector) AS semantic_score
  FROM video_nodes
  WHERE video_id = $2
  ORDER BY embedding <=> $1::vector
  LIMIT 5
),
keyword_search AS (
  -- 关键词检索：keyConcepts 匹配
  SELECT
    id,
    video_id,
    title,
    summary,
    transcript,
    start_time,
    end_time,
    -- 计算关键词匹配得分
    (
      SELECT COUNT(*)
      FROM unnest(key_concepts) AS concept
      WHERE concept ILIKE ANY($3::text[])
    )::float / GREATEST(array_length(key_concepts, 1), 1) AS keyword_score
  FROM video_nodes
  WHERE video_id = $2
    AND key_concepts && $3::text[]  -- 数组重叠检查
)
-- 融合结果
SELECT DISTINCT ON (id)
  COALESCE(s.id, k.id) AS id,
  COALESCE(s.video_id, k.video_id) AS video_id,
  COALESCE(s.title, k.title) AS title,
  COALESCE(s.summary, k.summary) AS summary,
  COALESCE(s.transcript, k.transcript) AS transcript,
  COALESCE(s.start_time, k.start_time) AS start_time,
  COALESCE(s.end_time, k.end_time) AS end_time,
  COALESCE(s.semantic_score, 0) AS semantic_score,
  COALESCE(k.keyword_score, 0) AS keyword_score,
  -- 综合得分：语义 70% + 关键词 30%
  COALESCE(s.semantic_score, 0) * 0.7 + COALESCE(k.keyword_score, 0) * 0.3 AS final_score
FROM semantic_search s
FULL OUTER JOIN keyword_search k ON s.id = k.id
ORDER BY final_score DESC
LIMIT 3;
```

### 4.3 上下文组装策略

```typescript
interface RAGContext {
  // 当前播放位置的节点（主要上下文）
  currentNode: VideoNode | null;

  // 检索到的相关节点（补充上下文）
  relevantNodes: VideoNode[];

  // 组装后的提示文本
  contextPrompt: string;
}

function assembleContext(
  currentTime: number,
  nodes: VideoNode[],
  retrievedNodes: VideoNode[]
): RAGContext {
  // 找到当前播放位置对应的节点
  const currentNode = nodes.find(
    n => currentTime >= n.startTime && currentTime < n.endTime
  );

  // 去重：排除当前节点
  const relevantNodes = retrievedNodes.filter(
    n => n.id !== currentNode?.id
  );

  // 组装上下文提示
  let contextPrompt = `
## 当前课程内容

视频正在播放的部分：
`;

  if (currentNode) {
    contextPrompt += `
【${currentNode.title}】(${formatTime(currentNode.startTime)} - ${formatTime(currentNode.endTime)})
${currentNode.summary}

详细内容：
${currentNode.transcript}
`;
  }

  if (relevantNodes.length > 0) {
    contextPrompt += `
## 相关知识点

以下是本节课中与学生问题可能相关的其他部分：
`;
    for (const node of relevantNodes) {
      contextPrompt += `
【${node.title}】(${formatTime(node.startTime)} - ${formatTime(node.endTime)})
${node.summary}
`;
    }
  }

  return { currentNode, relevantNodes, contextPrompt };
}
```

---

## 五、实时对话集成

### 5.1 System Prompt 模板

```typescript
const SYSTEM_PROMPT_TEMPLATE = `
你是一个数学AI助教，正在帮助一位初中生学习数学视频课程。

## 你的角色
- 像一个耐心的学长/学姐，用通俗易懂的语言解释问题
- 回答要简洁（2-3句话），除非学生要求详细解释
- 必须基于课程内容回答，不要超出课程范围

## 当前课程信息
课程名称：{videoTitle}
总时长：{duration}
知识点节点：{nodeCount} 个

{contextPrompt}

## 可用工具
1. use_whiteboard - 在画板上展示公式、图形
2. use_code_demo - 用代码演示计算过程
3. jump_to_video_node - 跳转到指定知识点重新播放
4. resume_video - 继续播放视频

## 回答原则
1. 优先使用【当前课程内容】中的信息回答
2. 如果问题涉及其他部分，参考【相关知识点】
3. 涉及公式时，必须调用 use_whiteboard 展示
4. 如果学生说"没听懂""想回去看"，调用 jump_to_video_node
5. 学生表示理解后，调用 resume_video 继续播放
`;
```

### 5.2 工具定义

```typescript
const AI_TOOLS = [
  // 已有工具
  {
    type: "function",
    name: "use_whiteboard",
    description: "在画板上展示数学内容：公式、函数图像、几何图形",
    parameters: {
      type: "object",
      properties: {
        type: {
          type: "string",
          enum: ["formula", "graph", "drawing"],
        },
        content: { type: "object" },
      },
      required: ["type", "content"],
    },
  },
  {
    type: "function",
    name: "use_code_demo",
    description: "用 Python 代码演示数学计算",
    parameters: {
      type: "object",
      properties: {
        code: { type: "string" },
        title: { type: "string" },
        explanation: { type: "string" },
      },
      required: ["code"],
    },
  },
  {
    type: "function",
    name: "resume_video",
    description: "学生理解后继续播放视频",
    parameters: { type: "object", properties: {} },
  },

  // 新增：节点跳转工具
  {
    type: "function",
    name: "jump_to_video_node",
    description: "跳转到视频的指定知识点节点重新播放。当学生说想回顾之前的内容、某部分没听懂时使用。",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "学生想回顾的内容描述，如'求根公式'、'刚才的例题'",
        },
      },
      required: ["query"],
    },
  },
];
```

### 5.3 上下文更新策略

```
┌─────────────────────────────────────────────────────────────────────┐
│                      上下文生命周期管理                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  T+0s    用户点击「加入对话」                                        │
│          ├─→ 获取当前播放时间                                        │
│          ├─→ 加载当前节点 + 相邻节点内容                              │
│          └─→ 创建 Realtime Session，注入初始上下文                   │
│                                                                     │
│  T+30s   后台定时检查（每30秒）                                       │
│  T+60s   ├─→ 检测视频播放位置是否跨越节点边界                         │
│  T+90s   ├─→ 如果进入新节点，更新上下文                              │
│  ...     └─→ 调用 session.update 刷新 System Prompt                 │
│                                                                     │
│  T+任意  用户提问                                                    │
│          ├─→ 检索相关节点（实时）                                    │
│          ├─→ 增强当前上下文                                         │
│          └─→ AI 基于完整上下文回答                                  │
│                                                                     │
│  T+退出  用户点击「退出对话」                                        │
│          └─→ 关闭 Session，清理资源                                 │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 六、回溯跳转功能

### 6.1 交互流程

```
┌─────────────────────────────────────────────────────────────────────┐
│                        回溯跳转流程                                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  学生: "老师，刚才讲的配方法那里我没太听懂，能回去再看一遍吗？"         │
│                              ↓                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ AI 识别意图：回溯请求                                         │   │
│  │ 调用工具：jump_to_video_node({ query: "配方法" })            │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              ↓                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ 后端处理：                                                    │   │
│  │ 1. 提取关键词: "配方法"                                       │   │
│  │ 2. 检索节点: 向量搜索 + 关键词匹配                            │   │
│  │ 3. 找到最佳匹配: node-3 "配方法的原理与步骤"                  │   │
│  │ 4. 返回节点信息                                               │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              ↓                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ 前端执行：                                                    │   │
│  │ 1. 视频跳转到 startTime (210秒 = 3:30)                       │   │
│  │ 2. 切换到视频视图                                             │   │
│  │ 3. 自动开始播放                                               │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              ↓                                      │
│  AI 语音提示: "好的，我帮你跳转到配方法那部分，从 3:30 开始。         │
│               这部分老师会讲配方的四个步骤，你注意听是怎么把            │
│               常数项移到右边，然后凑成完全平方式的。"                  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 6.2 工具处理逻辑

```typescript
// 处理 jump_to_video_node 工具调用
async function handleJumpToNode(
  videoId: string,
  query: string
): Promise<{
  success: boolean;
  node?: VideoNode;
  message: string;
}> {
  // 1. 生成查询向量
  const queryEmbedding = await generateEmbedding(query);

  // 2. 提取关键词
  const keywords = extractKeywords(query); // ["配方法"]

  // 3. 混合检索
  const nodes = await searchNodes({
    videoId,
    embedding: queryEmbedding,
    keywords,
    limit: 1,
  });

  if (nodes.length === 0) {
    return {
      success: false,
      message: "没有找到相关的知识点，请描述得更具体一些",
    };
  }

  const targetNode = nodes[0];

  return {
    success: true,
    node: targetNode,
    message: `跳转到「${targetNode.title}」，从 ${formatTime(targetNode.startTime)} 开始`,
  };
}
```

### 6.3 前端跳转实现

```typescript
// VoiceInteraction 中处理跳转
const handleToolCall = async (tool: string, params: any) => {
  if (tool === "jump_to_video_node") {
    const { query } = params;

    // 调用 API 检索节点
    const response = await fetch("/api/search-node", {
      method: "POST",
      body: JSON.stringify({ videoId, query }),
    });
    const { node } = await response.json();

    if (node) {
      // 触发视频跳转
      onJumpToTime?.(node.startTime);

      // 切换到视频视图
      onSwitchView?.("video");

      // 返回结果给 AI
      return {
        success: true,
        jumped_to: node.title,
        start_time: node.startTime,
      };
    }
  }
};
```

---

## 七、数据库设计

### 7.1 Supabase 表结构

```sql
-- 启用 pgvector 扩展
CREATE EXTENSION IF NOT EXISTS vector;

-- 视频表
CREATE TABLE videos (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  duration INTEGER NOT NULL,           -- 时长（秒）
  video_url TEXT NOT NULL,
  node_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending',       -- pending, processing, ready, error
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

-- 视频节点表
CREATE TABLE video_nodes (
  id TEXT PRIMARY KEY,                 -- node-{videoId}-{order}
  video_id TEXT REFERENCES videos(id) ON DELETE CASCADE,
  "order" INTEGER NOT NULL,
  start_time INTEGER NOT NULL,         -- 开始时间（秒）
  end_time INTEGER NOT NULL,           -- 结束时间（秒）
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  key_concepts TEXT[] DEFAULT '{}',
  transcript TEXT,
  embedding VECTOR(1536),              -- OpenAI embedding
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(video_id, "order")
);

-- 创建向量索引（IVFFlat，适合中等规模数据）
CREATE INDEX video_nodes_embedding_idx
ON video_nodes
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- 创建关键词搜索索引（GIN）
CREATE INDEX video_nodes_key_concepts_idx
ON video_nodes
USING GIN (key_concepts);

-- 创建视频ID索引
CREATE INDEX video_nodes_video_id_idx
ON video_nodes (video_id);
```

### 7.2 索引策略

| 索引类型 | 用途 | 查询示例 |
|---------|------|---------|
| IVFFlat (vector) | 向量相似度搜索 | `ORDER BY embedding <=> query_vector` |
| GIN (text[]) | 关键词数组匹配 | `WHERE key_concepts && ARRAY['配方法']` |
| B-tree (video_id) | 按视频筛选 | `WHERE video_id = 'xxx'` |

---

## 八、API 设计

### 8.1 节点检索 API

```typescript
// POST /api/search-node
interface SearchNodeRequest {
  videoId: string;
  query: string;
  currentTime?: number;  // 可选：当前播放时间，用于加权
  limit?: number;        // 默认 3
}

interface SearchNodeResponse {
  nodes: Array<{
    id: string;
    title: string;
    summary: string;
    startTime: number;
    endTime: number;
    score: number;
  }>;
}
```

### 8.2 获取视频节点列表 API

```typescript
// GET /api/video/[id]/nodes
interface GetVideoNodesResponse {
  video: {
    id: string;
    title: string;
    duration: number;
    nodeCount: number;
  };
  nodes: Array<{
    id: string;
    order: number;
    title: string;
    startTime: number;
    endTime: number;
  }>;
}
```

### 8.3 上下文获取 API

```typescript
// POST /api/video/[id]/context
interface GetContextRequest {
  currentTime: number;
  query?: string;  // 可选：如果有用户问题，进行检索增强
}

interface GetContextResponse {
  currentNode: VideoNode | null;
  relevantNodes: VideoNode[];
  contextPrompt: string;  // 组装好的上下文文本
}
```

---

## 九、性能优化

### 9.1 延迟预算

| 环节 | 目标延迟 | 优化手段 |
|-----|---------|---------|
| 向量检索 | < 50ms | pgvector IVFFlat 索引 |
| 关键词检索 | < 20ms | GIN 索引 |
| Embedding 生成 | < 100ms | 使用 text-embedding-3-small |
| 上下文组装 | < 10ms | 内存计算 |
| **总计** | < 200ms | - |

### 9.2 缓存策略

```typescript
// 节点数据缓存（前端）
const nodeCache = new Map<string, VideoNode[]>();

// 加入对话时预加载
async function preloadNodes(videoId: string) {
  if (!nodeCache.has(videoId)) {
    const nodes = await fetchVideoNodes(videoId);
    nodeCache.set(videoId, nodes);
  }
  return nodeCache.get(videoId);
}

// Embedding 缓存（后端）
// 使用 Redis 或内存缓存常用查询的 embedding
const embeddingCache = new LRUCache<string, number[]>({
  max: 1000,
  ttl: 1000 * 60 * 60, // 1 hour
});
```

### 9.3 预加载策略

```
用户点击「加入对话」
       ↓
┌──────────────────────────────────────┐
│           并行执行                    │
├──────────────────────────────────────┤
│ 1. 创建 Realtime Session             │
│ 2. 加载视频节点列表                   │
│ 3. 获取当前节点上下文                 │
│ 4. 预生成常见问题的检索结果           │
└──────────────────────────────────────┘
       ↓
   上下文就绪，开始对话
```

---

## 十、实现计划

### Phase 1: 基础设施（1-2天）
- [ ] 创建 Supabase 项目，配置 pgvector
- [ ] 设计并创建数据库表结构
- [ ] 实现 OpenAI Embedding API 封装

### Phase 2: 预处理 Pipeline（2-3天）
- [ ] 实现节点切分逻辑（基于 GPT-4）
- [ ] 实现节点内容增强（title/summary/keyConcepts）
- [ ] 实现向量化并存储
- [ ] 创建预处理 API: `/api/video/process`

### Phase 3: 检索 API（1-2天）
- [ ] 实现混合检索（向量 + 关键词）
- [ ] 创建节点检索 API: `/api/search-node`
- [ ] 创建上下文获取 API: `/api/video/[id]/context`

### Phase 4: 前端集成（2-3天）
- [ ] 修改 `useRealtimeVoice`，集成动态上下文
- [ ] 实现 `jump_to_video_node` 工具处理
- [ ] 添加进度条节点标记
- [ ] 添加节点导航侧边栏（可选）

### Phase 5: 测试与优化（1-2天）
- [ ] 端到端测试
- [ ] 性能优化
- [ ] 错误处理完善

---

## 十一、风险与应对

| 风险 | 影响 | 应对措施 |
|-----|------|---------|
| GPT-4 节点切分不准确 | 节点边界不合理 | 支持人工调整节点边界 |
| 向量检索召回率低 | 找不到相关内容 | 混合检索 + 关键词兜底 |
| 预处理耗时长 | 用户等待 | 后台异步处理 + 进度提示 |
| Supabase 冷启动延迟 | 首次检索慢 | 使用连接池 + 预热 |

---

## 十二、后续扩展

1. **多视频关联检索**：跨视频搜索相关知识点
2. **学习路径推荐**：基于学生困惑点推荐相关节点
3. **节点热度统计**：记录哪些节点被频繁回溯
4. **教师编辑界面**：支持教师手动调整节点
