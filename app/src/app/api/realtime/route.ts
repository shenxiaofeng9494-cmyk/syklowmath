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

## 核心教学理念：边讲边演示

你是一个会用"草稿纸"和"电脑"的老师，不是只会说话的老师。**永远不要只用嘴讲，要边说边展示！**

想象你坐在学生旁边，手边有草稿纸（画板）和电脑（IDE）：
- 讲公式？写出来让学生看到
- 讲几何？画出来指着讲
- 讲函数？画图像让学生直观理解
- 讲计算？用代码演示验证

**好的回答 = 语音讲解 + 视觉演示同步进行**

## 工具使用规则

### 必须使用工具的场景
1. **任何数学表达式** → use_whiteboard(formula)：哪怕只是 "x+1"，也要写出来
2. **几何问题** → use_whiteboard(drawing)：先画图，指着图讲
3. **函数问题** → use_whiteboard(graph)：画出图像，标注关键点
4. **需要验证/计算** → use_code_demo：用代码演示，眼见为实

### 鼓励使用工具的场景
- 学生说"不懂"、"再讲一遍" → 换个方式演示（比如之前用公式，这次画图）
- 抽象概念 → 用具体例子 + 代码演示
- 多步骤推导 → 用 steps 参数逐步展示

### 恢复视频
学生说"继续"、"好了"、"懂了"时 → resume_video

## 工具索引

| 工具 | 用途 | 详细用法 |
|------|------|----------|
| use_whiteboard | 公式(formula)、函数图(graph)、几何图(drawing) | load_tool_guide("whiteboard") |
| use_code_demo | Python 代码演示计算过程 | load_tool_guide("code-demo") |
| resume_video | 恢复视频播放 | - |
| load_tool_guide | 加载工具详细指南 | - |

**重要**：首次画几何图形前，先 load_tool_guide("drawing") 了解坐标系！

**关键：多图形布局规则**
当需要画多个图形时（例如"画一个三角形和一个圆"），**必须为每个图形设置不同的 canvas.centerX 避免重叠**：
- 第一个图形：{"canvas": {"centerX": 200}} （左侧）
- 第二个图形：{"canvas": {"centerX": 450}} （右侧，间隔250px）
- 第三个图形：{"canvas": {"centerX": 700}} （更右侧）

如果忘记设置，所有图形会重叠在默认位置（centerX=300）！`;

// 工具定义
const TOOLS = [
  {
    type: "function",
    name: "use_whiteboard",
    description:
      "在画板上展示数学公式、函数图像或几何图形。讲解公式时用 formula 类型，讲解函数图像时用 graph 类型，讲解几何图形时用 drawing 类型。\n\n**重要**：画多个图形时必须为每个图形设置不同的 diagram_ir.canvas.centerX（如第一个用200，第二个用450），否则会重叠！",
    parameters: {
      type: "object",
      properties: {
        content_type: {
          type: "string",
          enum: ["formula", "graph", "drawing"],
          description:
            "内容类型：formula 表示公式，graph 表示函数图像，drawing 表示几何图形",
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
        title: {
          type: "string",
          description: "图形标题，仅用于 drawing 类型",
        },
        elements: {
          type: "array",
          description: "图形元素数组，仅用于 drawing 类型",
          items: {
            type: "object",
            properties: {
              type: {
                type: "string",
                enum: ["rectangle", "ellipse", "diamond", "line", "arrow", "text"],
              },
              x: { type: "number" },
              y: { type: "number" },
              width: { type: "number" },
              height: { type: "number" },
              text: { type: "string" },
              fontSize: { type: "number" },
              strokeColor: { type: "string" },
              backgroundColor: { type: "string" },
              points: {
                type: "array",
                items: { type: "array", items: { type: "number" } },
              },
            },
            required: ["type", "x", "y"],
          },
        },
        diagram_ir: {
          type: "object",
          description:
            "几何图形的结构化描述（推荐使用，替代 elements）。用于描述几何约束而非坐标，系统会自动计算精确位置。",
          properties: {
            canvas: {
              type: "object",
              description: "画布配置（可选）。用于设置图形中心位置，避免多个图形重叠",
              properties: {
                centerX: {
                  type: "number",
                  description: "图形中心 X 坐标，默认 300。画多个图形时必须设置不同的值避免重叠，如第一个用 200，第二个用 450",
                },
                centerY: {
                  type: "number",
                  description: "图形中心 Y 坐标，默认 200",
                },
                gridStep: {
                  type: "number",
                  description: "网格步长，默认 40",
                },
              },
            },
            nodes: {
              type: "array",
              description: "点的列表，每个点有 id、类型和标签",
              items: {
                type: "object",
                properties: {
                  id: { type: "string", description: "点的唯一 ID，如 'A', 'B', 'C'" },
                  type: { type: "string", enum: ["point"], description: "节点类型，目前只支持 point" },
                  label: { type: "string", description: "点的标签文字，如 'A', 'B'" },
                  labelAnchor: {
                    type: "string",
                    enum: ["top", "bottom", "left", "right", "topLeft", "topRight", "bottomLeft", "bottomRight"],
                    description: "标签相对于点的位置",
                  },
                },
                required: ["id", "type"],
              },
            },
            edges: {
              type: "array",
              description: "边的列表,用于连接点",
              items: {
                type: "object",
                properties: {
                  type: {
                    type: "string",
                    enum: ["segment", "ray", "line", "arc"],
                    description: "边的类型：segment=线段, ray=射线, line=直线, arc=弧",
                  },
                  from: { type: "string", description: "起点的节点 ID" },
                  to: { type: "string", description: "终点的节点 ID" },
                  style: {
                    type: "object",
                    properties: {
                      strokeColor: { type: "string" },
                      strokeWidth: { type: "number" },
                      dashed: { type: "boolean" },
                    },
                  },
                },
                required: ["type", "from", "to"],
              },
            },
            constraints: {
              type: "array",
              description:
                "几何约束列表，定义图形的几何关系。支持：triangle（普通三角形）, isosceles（等腰三角形）, equilateral（等边三角形）, right_angle（直角）, circle（圆）, circle_through（过某点的圆）, rectangle（矩形）, square（正方形）, parallelogram（平行四边形）等",
              items: {
                type: "object",
                description:
                  "约束对象，根据 type 不同有不同的参数。例如：{type:'isosceles', apex:'C', base:['A','B']} 表示以 C 为顶点、AB 为底边的等腰三角形",
              },
            },
            annotations: {
              type: "array",
              description: "额外的文字标注",
              items: {
                type: "object",
                properties: {
                  type: {
                    type: "string",
                    enum: ["text", "length", "angle"],
                    description: "标注类型",
                  },
                  text: { type: "string", description: "标注文字" },
                  attachTo: { type: "string", description: "附着到哪个节点" },
                  offset: {
                    type: "array",
                    items: { type: "number" },
                    description: "相对于附着点的偏移 [x, y]",
                  },
                  fontSize: { type: "number" },
                },
              },
            },
          },
          required: ["nodes"],
        },
      },
      required: ["content_type"],
    },
  },
  {
    type: "function",
    name: "use_code_demo",
    description:
      "在 IDE 中演示 Python 代码执行。用于验证计算、演示方程求解、统计计算、概率模拟等。",
    parameters: {
      type: "object",
      properties: {
        code: {
          type: "string",
          description: "Python 代码，支持 numpy、sympy 库。代码要简洁，每步加注释。",
        },
        title: {
          type: "string",
          description: "代码演示的标题",
        },
        explanation: {
          type: "string",
          description: "代码的解释说明",
        },
      },
      required: ["code"],
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
          enum: ["whiteboard", "drawing", "code-demo"],
          description:
            "指南名称：whiteboard(画板工具完整用法)、drawing(几何绘图坐标系和元素详解)、code-demo(Python代码演示用法)",
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

    // 使用前端传来的字幕上下文（精准到当前时间前 30 秒）
    if (videoContext) {
      instructions += `\n\n## 学生刚才听到的内容（当前时间前30秒）\n${videoContext}\n\n注意：这是学生实际听到的内容，回答"刚才"相关问题时只参考这部分。`;
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
