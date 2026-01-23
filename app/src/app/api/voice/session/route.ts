import { NextRequest, NextResponse } from "next/server";
import { generateGuidesIndex, getAllGuidesContent } from "@/tool-guides/loader";
import { getNodeByTime, getAllNodes } from "@/lib/rag";

// System prompt for Doubao Realtime (optimized for tool detection by DeepSeek)
const BASE_SYSTEM_PROMPT = `你是一个超会讲数学的温柔老师，正在帮初中生答疑。学生暂停了视频来问你问题。

## 角色设定
- 你像学长/学姐一样温柔贴心，说话要像朋友聊天一样自然
- 语气轻松活泼，可以用"哈哈"、"嘿"、"对吧"、"是不是"这样的口语
- 解释概念时用最简单直白的大白话

## 回答原则
1. 只回答学生问的问题，别扯远了
2. 说话别太长，30秒内说完（100-150字左右）
3. 回答完后问一句"懂了不？还有问题吗？"（不要说"继续看视频"，等学生说懂了再恢复）

## 语音表达规范
说话时用自然语言：
- 说"x的平方"而不是"x^2"
- 说"根号x"而不是"√x"
- 说"a不等于零"而不是"a≠0"

## 【核心】你有一个智能画板！

你不是只会说话的老师，你有一个强大的画板工具，可以：
- 📝 **写公式** - 把数学公式清晰地展示出来
- 📈 **画函数图** - 画出函数的图像，标注关键点

**你必须边讲边画！** 就像在黑板前讲课一样，不要只用嘴说。

## 如何触发画板

画板会自动识别你说的话，当你说出以下关键词时，画板就会自动展示：

### 写公式 - 说"写出来"或"公式是"
例如：
- "我来把这个公式写出来，一元二次方程的一般形式是 a x的平方 加 b x 加 c 等于零"
- "求根公式是 x 等于 负b 加减 根号下 b的平方减4ac，再除以2a"

### 画函数图 - 说"画个函数图"或"画个图像"
例如：
- "我来画个函数图像，y 等于 x的平方，你看这是一条开口向上的抛物线"
- "我画个图你就明白了，这个函数 y 等于 2x 加 1 是一条直线"

### 恢复视频 - 说"继续看视频"
例如：
- "好嘞，那我们继续看视频吧"
- "明白了是吧，那继续看视频"

### 跳转知识点 - 说"跳转到"
例如：
- "我帮你跳转到求根公式那部分，我们再看一遍"

## 【重要】讲解策略 - 选对工具类型

- 讲方程、公式、定理：把完整表达式写在画板上，必要时分步推导
- 讲函数或提到图像/开口/顶点/截距：同时画出函数图像，并标注关键点；**必须写出具体的 y = ... 表达式，才能调用 graph**
- 同一段讲解既有公式又有图像时：先写公式，再画图像，边讲边指图
- 当你说“举个例子/画出来”时，要给出真实的公式或函数描述，不要空泛地说“我给你画一下”而不给内容
- **开始画图前要明确说出要画什么函数**：例如“我来画 y 等于 x 的平方的图像”，先把要画的对象讲清楚，后续模型才能调用工具
- 讲数学概念时，不要只给通用公式（如 ax²+bx+c=0），要用具体数值例子来解释，并把例子写/画出来，确保画板能直接展示
- 讲图像/函数时，必须给出带数值系数的具体表达式（如 y = x^2 - 2x + 1），并立即调用 use_whiteboard(graph) 画出来；不要只说“我给你画一下”或只说通用公式
- 即便学生没主动要求画图，只要讲解需要（函数、图像），你都要主动边讲边画；在需要画图时，一定要给出具体的数值例子，否则后续画板无法渲染

记住：你是有画板的老师，要充分利用它！`;

// Tool definitions (same as OpenAI Realtime version, but in DeepSeek format)
const TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "use_whiteboard",
      description:
        "在画板上展示数学公式或函数图像。讲解公式时用 formula 类型，讲解函数图像时用 graph 类型（必须提供 expression，如 y = x^2，多个函数可用逗号/换行分隔）。",
      parameters: {
        type: "object",
        properties: {
          content_type: {
            type: "string",
            enum: ["formula", "graph"],
            description:
              "内容类型：formula 表示公式，graph 表示函数图像",
          },
          latex: {
            type: "string",
            description: "LaTeX 格式的公式，仅用于 formula 类型",
          },
          expression: {
            type: "string",
            description:
              "函数表达式，仅用于 graph 类型。格式如：y = x^2, y = 2*x + 1",
          },
          steps: {
            type: "array",
            items: { type: "string" },
            description:
              "分步骤的 LaTeX 公式数组，用于展示推导过程，仅用于 formula 类型",
          },
          x_range: {
            type: "array",
            items: { type: "number" },
            description:
              "x 轴范围，如 [-5, 5]，仅用于 graph 类型",
          },
          y_range: {
            type: "array",
            items: { type: "number" },
            description:
              "y 轴范围，如 [-5, 5]，仅用于 graph 类型",
          },
          points: {
            type: "array",
            items: {
              type: "object",
              properties: {
                x: { type: "number" },
                y: { type: "number" },
                label: { type: "string" },
              },
              required: ["x", "y"],
            },
            description: "要标记的特殊点，如顶点、交点等，仅用于 graph 类型",
          },
          params: {
            type: "array",
            description: "图像参数列表（可选）。用于带参数的函数图像，提供默认值和范围，前端会渲染滑条。",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                value: { type: "number" },
                min: { type: "number" },
                max: { type: "number" },
                step: { type: "number" },
                label: { type: "string" },
              },
              required: ["name"],
            },
          },
        },
        required: ["content_type"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "resume_video",
      description:
        "恢复视频播放。当学生表示理解了、听懂了、想继续看视频时调用此工具。",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "load_tool_guide",
      description:
        "加载工具的详细使用指南。在首次使用某个工具或不确定参数格式时调用。",
      parameters: {
        type: "object",
        properties: {
          guide_name: {
            type: "string",
            enum: ["whiteboard"],
            description:
              "指南名称：whiteboard(画板工具完整用法)",
          },
        },
        required: ["guide_name"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "jump_to_video_node",
      description:
        "跳转到视频的指定知识点重新播放。当学生说想回顾之前的内容、某部分没听懂、想再看一遍时使用。",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description:
              "学生想回顾的内容描述，如'求根公式'、'刚才的例题'、'前面讲的定义'",
          },
        },
        required: ["query"],
      },
    },
  },
];

export async function POST(req: NextRequest) {
  try {
    const { videoContext, videoId, currentTime } = await req.json();

    // Check required environment variables
    const deepseekApiKey = process.env.DEEPSEEK_API_KEY;
    const doubaoAppId = process.env.DOUBAO_APP_ID;
    const doubaoAccessKey = process.env.DOUBAO_ACCESS_KEY;

    if (!deepseekApiKey) {
      return NextResponse.json(
        { error: "DEEPSEEK_API_KEY not configured" },
        { status: 500 }
      );
    }

    if (!doubaoAppId || !doubaoAccessKey) {
      return NextResponse.json(
        { error: "DOUBAO_APP_ID or DOUBAO_ACCESS_KEY not configured" },
        { status: 500 }
      );
    }

    // Generate tool guides index
    const guidesIndex = generateGuidesIndex();

    // Build complete system prompt
    let systemPrompt = BASE_SYSTEM_PROMPT;

    if (guidesIndex) {
      systemPrompt += `\n\n${guidesIndex}`;
    }

    // RAG context: node list + subtitle context
    let nodeList: Array<{ order: number; title: string; startTime: number; endTime: number }> = [];

    if (videoId) {
      try {
        // Get current node (to know which topic student is watching)
        const currentNode = typeof currentTime === "number"
          ? await getNodeByTime(videoId, currentTime)
          : null;

        // Get all nodes for navigation
        const allNodes = await getAllNodes(videoId);
        nodeList = allNodes.map((n) => ({
          order: n.order,
          title: n.title,
          startTime: n.start_time,
          endTime: n.end_time,
        }));

        // Add current node info to system prompt
        if (currentNode) {
          systemPrompt += `\n\n## 当前知识点\n【${currentNode.title}】(${Math.floor(currentNode.start_time / 60)}:${(currentNode.start_time % 60).toString().padStart(2, "0")} - ${Math.floor(currentNode.end_time / 60)}:${(currentNode.end_time % 60).toString().padStart(2, "0")})\n${currentNode.summary}`;
        }

        // Add node list for navigation
        if (nodeList.length > 0) {
          systemPrompt += `\n\n## 本节课知识点列表（可跳转）\n`;
          for (const node of nodeList) {
            const startMin = Math.floor(node.startTime / 60);
            const startSec = Math.floor(node.startTime % 60);
            systemPrompt += `- ${node.order}. ${node.title} (${startMin}:${startSec.toString().padStart(2, "0")})\n`;
          }
          systemPrompt += `\n当学生说想回顾某个知识点时，使用 jump_to_video_node 工具。`;
        }
      } catch (ragError) {
        console.error("RAG context error:", ragError);
        // RAG failure doesn't affect main flow
      }
    }

    // Add video context (last 30 seconds of subtitles)
    if (videoContext) {
      systemPrompt += `\n\n## 学生刚才听到的内容（当前时间前30秒）\n${videoContext}\n\n注意：这是学生实际听到的内容，回答"刚才"相关问题时只参考这部分。`;
    }

    // Load all guides content
    const guides = getAllGuidesContent();

    // Return session configuration
    return NextResponse.json({
      // Doubao credentials (App ID + Access Key)
      doubaoAppId,
      doubaoAccessKey,
      asrResourceId: process.env.DOUBAO_ASR_RESOURCE_ID || "volc.seedasr.sauc.duration",
      ttsResourceId: process.env.DOUBAO_TTS_RESOURCE_ID || "seed-tts-2.0",
      ttsVoice: process.env.DOUBAO_TTS_VOICE || "zh_female_tianmeixiaoyuan_moon_bigtts",

      // LLM configuration
      systemPrompt,
      tools: TOOLS,
      guides,
      nodeList,
    });
  } catch (error) {
    console.error("Error creating voice session:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
