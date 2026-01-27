import { NextRequest, NextResponse } from "next/server";
import { generateGuidesIndex, getAllGuidesContent } from "@/tool-guides/loader";
import { getNodeByTime, getAllNodes } from "@/lib/rag";

// 数学术语提示词，用于提高语音识别准确率
const MATH_TERMS_PROMPT = `一元二次方程、二次函数、配方法、求根公式、判别式、delta、根与系数的关系、韦达定理、
因式分解、完全平方公式、平方差公式、十字相乘法、换元法、
ax²+bx+c=0、x的平方、x²、x³、根号、√、分之、分数、负数、正数、
系数、常数项、一次项、二次项、未知数、方程的根、方程的解、
大于、小于、等于、不等于、大于等于、小于等于、
加、减、乘、除、乘以、除以、等于零、解方程、化简、移项、合并同类项`;

// 系统提示词（精简版，详细工具用法按需加载）
const BASE_SYSTEM_PROMPT = `你是一个超会讲数学的温柔老师，正在帮初中生答疑。学生暂停了视频来问你问题。

## 角色设定
- 你像学长/学姐一样温柔贴心，说话要像朋友聊天一样自然
- 语气轻松活泼，可以用"哈哈"、"嘿"、"对吧"、"是不是"这样的口语
- 解释概念时用最简单直白的大白话
- 多用生活中的例子，比如游戏、零花钱、身高这些学生熟悉的东西

## 回答原则
1. 只回答学生问的问题，别扯远了
2. 说话别太长，30秒内说完（100-150字左右）
3. 回答完后随意问一句，比如"懂了不？要继续看视频吗？"

## 语音表达规范
说话时用自然语言，让学生容易听懂：
- 说"x的平方"而不是"x^2"
- 说"根号x"而不是"√x"
- 说"a不等于零"而不是"a≠0"

## 【核心】你有两个画板工具！

你不是只会说话的老师，你有两个强大的画板工具：

### 工具1: use_whiteboard - 用于公式和函数图
- 📝 **formula 类型** - 写数学公式（方程、定理、推导过程）
- 📈 **graph 类型** - 画函数图像（必须是 y = f(x) 形式的函数）

### 工具2: use_drawing_board - 用于几何图形
- 🔺 **几何图形** - 三角形、圆、矩形、角、线段等
- 📐 **示意图** - 任何需要手绘的图形

## 【关键】如何选择正确的工具

| 学生问的内容 | 使用的工具 | 示例 |
|-------------|-----------|------|
| 方程、公式、定理 | use_whiteboard(formula) | 求根公式、勾股定理 |
| 函数图像（y=f(x)） | use_whiteboard(graph) | 抛物线、直线、正弦函数 |
| **几何图形** | **use_drawing_board** | **三角形、圆、角、平行线** |
| **等腰三角形、直角三角形** | **use_drawing_board** | **画三角形示意图** |
| **几何证明的图** | **use_drawing_board** | **辅助线、角的标注** |

## 【重要】几何图形必须用 use_drawing_board

当学生问到以下内容时，**必须调用 use_drawing_board**，不要用 use_whiteboard(graph)：
- 三角形（等腰三角形、等边三角形、直角三角形）
- 圆、扇形、弧
- 四边形（正方形、矩形、平行四边形、梯形）
- 角（锐角、直角、钝角）
- 线段、射线、平行线、垂直线
- 任何几何图形的示意图

**错误示范**：学生问"等腰三角形是什么"，你用 use_whiteboard(graph) 画函数 ❌
**正确示范**：学生问"等腰三角形是什么"，你用 use_drawing_board 画三角形 ✅

## use_drawing_board 调用示例

画等腰三角形：
\`\`\`json
{
  "action": "open",
  "shapes": [
    {"type": "line", "x": 200, "y": 300, "points": [{"x": 0, "y": 0}, {"x": 100, "y": -150}, {"x": 200, "y": 0}, {"x": 0, "y": 0}], "color": "blue"},
    {"type": "text", "x": 90, "y": 320, "text": "底边"},
    {"type": "text", "x": 30, "y": 200, "text": "腰"},
    {"type": "text", "x": 170, "y": 200, "text": "腰"}
  ]
}
\`\`\`

## 恢复视频
学生说"继续"、"好了"、"懂了"时 → 调用 resume_video

## 工具索引

| 工具 | 用途 |
|------|------|
| use_whiteboard | 公式(formula)、函数图(graph) |
| use_drawing_board | 几何图形、示意图 |
| resume_video | 恢复视频播放 |
| jump_to_video_node | 跳转到知识点 |

记住：几何图形用 use_drawing_board，函数图像用 use_whiteboard(graph)！
`;

// 工具定义
const TOOLS = [
  {
    type: "function",
    name: "use_whiteboard",
    description:
      "在画板上展示数学公式或函数图像。讲解公式时用 formula 类型，讲解函数图像时用 graph 类型（必须提供 expression，多个函数可用逗号/换行分隔）。",
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
          description: "可调参数列表，仅用于 graph 类型",
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
  {
    type: "function",
    name: "use_drawing_board",
    description:
      "打开全屏画板进行自由绘图。用于画几何图形、示意图、流程图、思维导图等需要手绘的内容。支持20+种形状：基础形状(矩形、椭圆、三角形、菱形)、多边形(五边形、六边形、八边形)、特殊形状(五角星、云朵、爱心)、方向箭头、复选框等。",
    parameters: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["open", "draw", "clear", "close"],
          description:
            "操作类型：open 打开画板，draw 绘制图形，clear 清空画板，close 关闭画板",
        },
        shapes: {
          type: "array",
          description: "要绘制的图形列表，仅用于 open 和 draw 操作",
          items: {
            type: "object",
            properties: {
              type: {
                type: "string",
                enum: [
                  "rectangle", "ellipse", "triangle", "diamond",
                  "pentagon", "hexagon", "octagon", "star",
                  "rhombus", "rhombus-2", "oval", "trapezoid",
                  "cloud", "heart",
                  "arrow-right", "arrow-left", "arrow-up", "arrow-down",
                  "check-box", "x-box",
                  "line", "arrow", "text", "freehand"
                ],
                description: "图形类型",
              },
              x: {
                type: "number",
                description: "图形左上角 x 坐标",
              },
              y: {
                type: "number",
                description: "图形左上角 y 坐标",
              },
              width: {
                type: "number",
                description: "图形宽度（矩形、椭圆、箭头使用）",
              },
              height: {
                type: "number",
                description: "图形高度（矩形、椭圆使用）",
              },
              points: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    x: { type: "number" },
                    y: { type: "number" },
                  },
                  required: ["x", "y"],
                },
                description: "点列表（线条、自由绘制使用）",
              },
              text: {
                type: "string",
                description: "文字内容（文字类型使用）",
              },
              color: {
                type: "string",
                description: "颜色，如 red, blue, green, black 等",
              },
            },
            required: ["type", "x", "y"],
          },
        },
      },
      required: ["action"],
    },
  },
  {
    type: "function",
    name: "resume_video",
    description:
      "恢复视频播放。当学生表示理解了、听懂了、想继续看视频时调用此工具。",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    type: "function",
    name: "load_tool_guide",
    description:
      "加载工具的详细使用指南。在首次使用某个工具或不确定参数格式时调用。",
    parameters: {
      type: "object",
      properties: {
        guide_name: {
          type: "string",
          enum: ["whiteboard", "drawing-board"],
          description:
            "指南名称：whiteboard(公式和函数图)、drawing-board(几何图形、流程图、思维导图)",
        },
      },
      required: ["guide_name"],
    },
  },
  {
    type: "function",
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
];

export async function POST(req: NextRequest) {
  try {
    const { videoContext, videoId, currentTime } = await req.json();

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "OpenAI API Key not configured" },
        { status: 500 }
      );
    }

    // 生成工具指南索引
    const guidesIndex = generateGuidesIndex();

    // 构建完整的系统提示
    let instructions = BASE_SYSTEM_PROMPT;

    if (guidesIndex) {
      instructions += `\n\n${guidesIndex}`;
    }

    // RAG 上下文：节点列表 + 精准字幕上下文
    let nodeList: Array<{ order: number; title: string; startTime: number; endTime: number }> = [];

    if (videoId) {
      try {
        // 获取当前播放位置的节点（用于知道学生在看哪个知识点）
        const currentNode = typeof currentTime === "number"
          ? await getNodeByTime(videoId, currentTime)
          : null;

        // 获取所有节点列表（用于跳转）
        const allNodes = await getAllNodes(videoId);
        nodeList = allNodes.map((n) => ({
          order: n.order,
          title: n.title,
          startTime: n.start_time,
          endTime: n.end_time,
        }));

        // 添加当前知识点标题（但不包含完整 transcript，避免剧透后面内容）
        if (currentNode) {
          instructions += `\n\n## 当前知识点\n【${currentNode.title}】(${Math.floor(currentNode.start_time / 60)}:${(currentNode.start_time % 60).toString().padStart(2, "0")} - ${Math.floor(currentNode.end_time / 60)}:${(currentNode.end_time % 60).toString().padStart(2, "0")})\n${currentNode.summary}`;
        }

        // 添加节点列表供跳转使用
        if (nodeList.length > 0) {
          instructions += `\n\n## 本节课知识点列表（可跳转）\n`;
          for (const node of nodeList) {
            const startMin = Math.floor(node.startTime / 60);
            const startSec = Math.floor(node.startTime % 60);
            instructions += `- ${node.order}. ${node.title} (${startMin}:${startSec.toString().padStart(2, "0")})\n`;
          }
          instructions += `\n当学生说想回顾某个知识点时，使用 jump_to_video_node 工具。`;
        }
      } catch (ragError) {
        console.error("RAG context error:", ragError);
        // RAG 失败不影响主流程
      }
    }

    // 使用前端传来的字幕上下文（分层：最近5秒精准 + 前30秒背景）
    if (videoContext) {
      instructions += `\n\n## 学生刚才听到的内容\n\n${videoContext}\n\n**重要提示**：当学生说"这个"、"这里"、"刚才那个"等指代词时，优先理解为【刚才说的】部分的内容。`;
    }

    // 创建 Realtime Session
    const response = await fetch(
      "https://api.openai.com/v1/realtime/sessions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-realtime-2025-08-28",
          modalities: ["text", "audio"],
          voice: "alloy",
          instructions,
          tools: TOOLS,
          input_audio_transcription: {
            model: "whisper-1",
            language: "zh",
            prompt: MATH_TERMS_PROMPT,
          },
          turn_detection: {
            type: "server_vad",
            threshold: 0.7,
            prefix_padding_ms: 300,
            silence_duration_ms: 600,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenAI API error:", errorText);
      return NextResponse.json(
        { error: "Failed to create realtime session", details: errorText },
        { status: response.status }
      );
    }

    const session = await response.json();
    console.log("OpenAI session response:", JSON.stringify(session, null, 2));

    const clientSecret =
      typeof session.client_secret === "object"
        ? session.client_secret.value
        : session.client_secret;

    // 预加载所有工具指南内容
    const guides = getAllGuidesContent();

    return NextResponse.json({
      client_secret: clientSecret,
      expires_at: session.expires_at,
      guides,
      nodeList, // 节点列表供前端跳转使用
    });
  } catch (error) {
    console.error("Error creating realtime session:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
