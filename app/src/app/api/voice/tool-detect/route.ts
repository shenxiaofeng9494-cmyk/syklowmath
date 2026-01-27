/**
 * Tool Detection API - 支持 DeepSeek (推荐) 和 Doubao
 *
 * DeepSeek 在复杂绘图指令理解方面表现更好，推荐作为首选。
 * 如果 DEEPSEEK_API_KEY 存在则使用 DeepSeek，否则回退到 Doubao。
 */

import { NextRequest, NextResponse } from "next/server";

// API 端点
const DEEPSEEK_API_URL = "https://api.deepseek.com/chat/completions";
const ARK_API_URL = "https://ark.cn-beijing.volces.com/api/v3/chat/completions";

const TOOL_DETECTION_PROMPT = `你是数学教学助手的工具调用判断器。分析 AI 老师的回复，判断需要调用哪些工具。

## 【最重要】必须调用工具的情况

当 AI 老师说了以下任何一种话时，**必须**调用相应的工具：
- "我画个图"、"画好了"、"你看这个图"、"我来画一下" → 必须调用画图工具！
- "我写出来"、"公式是"、"方程是" → 必须调用 use_whiteboard(formula)
- "图像是这样的"、"抛物线"、"函数图" → 必须调用 use_whiteboard(graph)
- "流程图"、"步骤图"、"流程是这样" → 必须调用 use_drawing_board
- "思维导图"、"知识结构"、"关系图" → 必须调用 use_drawing_board

**绝对禁止**：AI 说要画图但不调用工具！

## 工具选择原则

### use_whiteboard - 用于公式和函数图
- **formula 类型**：老师在描述"方程/公式/表达式/一般形式/代入求解"等，提取表达式
- **graph 类型**：老师在讲"函数/图像/抛物线/直线/开口/顶点/截距/随x变化"等，必须给出 y=... 的具体数值表达式
  - 一元二次方程/函数 → y = ax^2 + bx + c 或 y = x^2
  - 一次函数 → y = kx + b

### use_drawing_board - 用于几何图形、流程图、思维导图（重要！）
当老师提到以下内容时，**必须调用 use_drawing_board**，不要用 use_whiteboard：
- 三角形（等腰三角形、等边三角形、直角三角形、锐角三角形、钝角三角形）
- 圆、扇形、弧、圆心、半径、直径
- 四边形（正方形、矩形、平行四边形、梯形、菱形）
- 角（锐角、直角、钝角、角度）
- 线段、射线、平行线、垂直线
- 任何几何图形的示意图
- **流程图**：步骤、流程、过程、先...再...然后...
- **思维导图**：知识点、分类、结构、关系、包含
- **标注文字**：重点、注意、提示
- 老师说"画个三角形"、"画个圆"、"画个图给你看"、"画个流程图"、"画个思维导图"等

### resume_video
- 老师明确说要恢复播放、继续看视频

### jump_to_video_node
- 老师明确说要跳转到某个知识点

## 判断规则
1) AI 说"画图/画好了/你看" + 一元二次方程/函数 → use_whiteboard(graph) + expression="y = x^2"
2) AI 说"画图/画好了/你看" + 几何图形 → use_drawing_board
3) AI 说"流程图/步骤" → use_drawing_board (用矩形+箭头+文字)
4) AI 说"思维导图/结构图" → use_drawing_board (用椭圆+线条+文字)
5) 公式/方程 → use_whiteboard(formula)
6) 没有数学内容才不调用工具

## 示例

用户：请画图来解释一下这个概念（当前讲的是一元二次方程）
AI：好呀，我画好啦！你看，这个就是一元二次方程的图像，它是一个抛物线。
→ 必须调用 use_whiteboard(graph)，expression="y = x^2"

用户：画图解释等腰三角形
AI：好的，我画个等腰三角形给你看
→ 必须调用 use_drawing_board

用户：解题步骤是什么
AI：我画个流程图给你看，先...然后...最后...
→ 必须调用 use_drawing_board (画流程图)

用户：这个知识点包含哪些内容
AI：我画个思维导图帮你理清，主要有三个方面...
→ 必须调用 use_drawing_board (画思维导图)`;

const TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "use_whiteboard",
      description: "在画板上展示数学公式或函数图像。用于公式(formula)和函数图(graph)，不要用于几何图形！",
      parameters: {
        type: "object",
        properties: {
          content_type: {
            type: "string",
            enum: ["formula", "graph"],
            description: "内容类型：formula(公式)、graph(函数图，必须是y=f(x)形式)",
          },
          latex: {
            type: "string",
            description: "纯 LaTeX 格式的公式（不要包含 $ 符号），用于 formula 类型。例如：x = \\\\frac{-b \\\\pm \\\\sqrt{b^2-4ac}}{2a}",
          },
          expression: {
            type: "string",
            description: "函数表达式，用于 graph 类型，如 y = x^2",
          },
          x_range: {
            type: "array",
            items: { type: "number" },
            description: "x 轴范围，如 [-5, 5]",
          },
          y_range: {
            type: "array",
            items: { type: "number" },
            description: "y 轴范围，如 [-5, 5]",
          },
          params: {
            type: "array",
            description: "图像参数列表（可选）",
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
      name: "use_drawing_board",
      description: "打开全屏画板画几何图形、流程图、思维导图。支持三角形、圆、矩形、菱形、五角星、云朵、爱心等20+种形状，不要用于函数图！",
      parameters: {
        type: "object",
        properties: {
          action: {
            type: "string",
            enum: ["open", "draw", "clear", "close"],
            description: "操作类型：open 打开画板并绘制，draw 继续绘制，clear 清空，close 关闭",
          },
          shapes: {
            type: "array",
            description: "要绘制的图形列表",
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
                  description: "图形类型：rectangle矩形、ellipse椭圆/圆、triangle三角形、diamond菱形、pentagon五边形、hexagon六边形、octagon八边形、star五角星、cloud云朵、heart爱心、line线条、arrow箭头、text文字、freehand自由绘制",
                },
                x: { type: "number", description: "x 坐标" },
                y: { type: "number", description: "y 坐标" },
                width: { type: "number", description: "宽度" },
                height: { type: "number", description: "高度" },
                points: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: { x: { type: "number" }, y: { type: "number" } },
                  },
                  description: "点列表，用于 line 和 freehand",
                },
                text: { type: "string", description: "文字内容" },
                color: { type: "string", description: "颜色：red, blue, green, black 等" },
              },
              required: ["type", "x", "y"],
            },
          },
        },
        required: ["action"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "resume_video",
      description: "恢复视频播放。当学生说懂了、继续、好了、明白了等表示理解的话时调用",
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
      name: "jump_to_video_node",
      description: "跳转到视频的指定知识点。当学生说想回顾之前的内容、某部分没听懂、想再看一遍时使用",
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
  },
  {
    type: "function" as const,
    function: {
      name: "use_whiteboard_dsl",
      description: "使用高层 DSL 命令画图。比 use_drawing_board 更简洁，适合坐标系、函数图、几何图形、流程图、思维导图",
      parameters: {
        type: "object",
        properties: {
          commands: {
            type: "array",
            description: "DSL 命令列表",
            items: {
              type: "object",
              properties: {
                command: {
                  type: "string",
                  enum: [
                    "DrawCoordinatePlane",
                    "PlotFunction",
                    "ConstructTriangle",
                    "ConstructCircle",
                    "DrawAngle",
                    "DrawLineSegment",
                    "CreateFlowchart",
                    "CreateMindmap",
                    "ShowCorrectWrong",
                    "AddLabel",
                    "AddArrow",
                  ],
                  description: "命令名称",
                },
                params: {
                  type: "object",
                  description: "命令参数",
                },
              },
              required: ["command", "params"],
            },
          },
        },
        required: ["commands"],
      },
    },
  },
];

// Few-shot 示例 - 让模型学习如何生成正确的绘图参数
const FEW_SHOT_EXAMPLES = `
## Few-shot 示例

### 示例1：流程图
用户：画一个解题流程图
AI：好的，我来画一个解题流程图给你看

正确的工具调用：
\`\`\`json
{"name": "use_drawing_board", "arguments": {
  "action": "open",
  "shapes": [
    {"type": "ellipse", "x": 330, "y": 30, "width": 140, "height": 50, "color": "green"},
    {"type": "text", "x": 375, "y": 45, "text": "读题"},
    {"type": "arrow", "x": 400, "y": 80, "width": 0, "height": 40, "color": "black"},
    {"type": "rectangle", "x": 330, "y": 120, "width": 140, "height": 50, "color": "blue"},
    {"type": "text", "x": 360, "y": 135, "text": "分析条件"},
    {"type": "arrow", "x": 400, "y": 170, "width": 0, "height": 40, "color": "black"},
    {"type": "rectangle", "x": 330, "y": 210, "width": 140, "height": 50, "color": "blue"},
    {"type": "text", "x": 375, "y": 225, "text": "计算"},
    {"type": "arrow", "x": 400, "y": 260, "width": 0, "height": 40, "color": "black"},
    {"type": "ellipse", "x": 330, "y": 300, "width": 140, "height": 50, "color": "red"},
    {"type": "text", "x": 375, "y": 315, "text": "检验"}
  ]
}}
\`\`\`

### 示例2：思维导图
用户：画一个思维导图，中心是数学
AI：好的，我画一个数学的思维导图

正确的工具调用：
\`\`\`json
{"name": "use_drawing_board", "arguments": {
  "action": "open",
  "shapes": [
    {"type": "ellipse", "x": 300, "y": 230, "width": 140, "height": 80, "color": "blue"},
    {"type": "text", "x": 345, "y": 260, "text": "数学"},
    {"type": "line", "x": 370, "y": 230, "points": [{"x": 0, "y": 0}, {"x": 0, "y": -100}], "color": "grey"},
    {"type": "rectangle", "x": 310, "y": 90, "width": 120, "height": 40, "color": "green"},
    {"type": "text", "x": 345, "y": 102, "text": "代数"},
    {"type": "line", "x": 440, "y": 270, "points": [{"x": 0, "y": 0}, {"x": 120, "y": 0}], "color": "grey"},
    {"type": "rectangle", "x": 560, "y": 250, "width": 120, "height": 40, "color": "orange"},
    {"type": "text", "x": 595, "y": 262, "text": "几何"},
    {"type": "line", "x": 370, "y": 310, "points": [{"x": 0, "y": 0}, {"x": 0, "y": 100}], "color": "grey"},
    {"type": "rectangle", "x": 310, "y": 410, "width": 120, "height": 40, "color": "violet"},
    {"type": "text", "x": 345, "y": 422, "text": "统计"},
    {"type": "line", "x": 300, "y": 270, "points": [{"x": 0, "y": 0}, {"x": -120, "y": 0}], "color": "grey"},
    {"type": "rectangle", "x": 60, "y": 250, "width": 120, "height": 40, "color": "red"},
    {"type": "text", "x": 95, "y": 262, "text": "函数"}
  ]
}}
\`\`\`

### 示例3：几何图形
用户：画一个等腰三角形
AI：好的，我画一个等腰三角形

正确的工具调用：
\`\`\`json
{"name": "use_drawing_board", "arguments": {
  "action": "open",
  "shapes": [
    {"type": "triangle", "x": 250, "y": 150, "width": 200, "height": 180, "color": "blue"},
    {"type": "text", "x": 330, "y": 120, "text": "A"},
    {"type": "text", "x": 230, "y": 340, "text": "B"},
    {"type": "text", "x": 430, "y": 340, "text": "C"},
    {"type": "text", "x": 260, "y": 230, "text": "腰"},
    {"type": "text", "x": 400, "y": 230, "text": "腰"},
    {"type": "text", "x": 320, "y": 360, "text": "底边"}
  ]
}}
\`\`\`

### 示例4：对比图
用户：画一个正确和错误的对比
AI：好的，我画一个对比图

正确的工具调用：
\`\`\`json
{"name": "use_drawing_board", "arguments": {
  "action": "open",
  "shapes": [
    {"type": "check-box", "x": 50, "y": 80, "width": 50, "height": 50, "color": "green"},
    {"type": "text", "x": 120, "y": 95, "text": "正确做法"},
    {"type": "rectangle", "x": 120, "y": 130, "width": 300, "height": 80, "color": "light-green"},
    {"type": "text", "x": 140, "y": 160, "text": "先分析条件，再选择方法"},
    {"type": "x-box", "x": 50, "y": 250, "width": 50, "height": 50, "color": "red"},
    {"type": "text", "x": 120, "y": 265, "text": "错误做法"},
    {"type": "rectangle", "x": 120, "y": 300, "width": 300, "height": 80, "color": "light-red"},
    {"type": "text", "x": 140, "y": 330, "text": "直接套公式，不理解原理"}
  ]
}}
\`\`\`
`;

export async function POST(req: NextRequest) {
  try {
    const { aiResponse, userMessage } = await req.json();

    // 优先使用 DeepSeek（更强的理解能力），否则回退到 Doubao
    const deepseekKey = process.env.DEEPSEEK_API_KEY;
    const doubaoKey = process.env.ARK_API_KEY || process.env.DOUBAO_CHAT_API_KEY;

    const useDeepSeek = !!deepseekKey;
    const apiKey = deepseekKey || doubaoKey;

    if (!apiKey) {
      console.error("No API key configured (DEEPSEEK_API_KEY or ARK_API_KEY)");
      return NextResponse.json({ toolCalls: [] });
    }

    const apiUrl = useDeepSeek ? DEEPSEEK_API_URL : ARK_API_URL;
    const model = useDeepSeek
      ? "deepseek-chat"
      : (process.env.DOUBAO_CHAT_ENDPOINT_ID || "doubao-1-5-pro-32k");

    console.log(`=== Tool Detection (${useDeepSeek ? "DeepSeek" : "Doubao"}) ===`);
    console.log("User:", userMessage);
    console.log("AI:", aiResponse);

    // 组合系统提示词 + Few-shot 示例
    const fullPrompt = TOOL_DETECTION_PROMPT + "\n" + FEW_SHOT_EXAMPLES;

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: fullPrompt },
          {
            role: "user",
            content: `用户问题：${userMessage}\n\nAI老师回复：${aiResponse}\n\n请判断是否需要调用工具，如果需要画图，请生成完整的 shapes 数组。`,
          },
        ],
        tools: TOOLS,
        tool_choice: "auto",
        max_tokens: 2000, // 增加 token 限制以支持复杂图形
        temperature: 0,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`${useDeepSeek ? "DeepSeek" : "Doubao"} API error:`, error);
      return NextResponse.json({ toolCalls: [] });
    }

    const data = await response.json();
    const message = data.choices?.[0]?.message;

    if (message?.tool_calls && message.tool_calls.length > 0) {
      const toolCalls = message.tool_calls.map((tc: {
        id: string;
        function: { name: string; arguments: string };
      }) => ({
        id: tc.id,
        name: tc.function.name,
        arguments: JSON.parse(tc.function.arguments || "{}"),
      }));

      const validatedToolCalls = toolCalls.filter((call: { name: string; arguments?: Record<string, unknown> }) => {
        if (call.name === "use_whiteboard") {
          const ct = call.arguments?.content_type as string | undefined;
          if (ct === "graph") {
            const expr = call.arguments?.expression as string | undefined;
            if (!expr) {
              console.warn("Dropping graph tool call without expression:", call);
              return false;
            }
            const params = (call.arguments?.params as Array<{ name: string }> | undefined) || [];
            const paramNames = params.map((p) => p.name);
            const stripped = expr.replace(/[xytr\s\+\-\*\/\^\(\)\.\d,，；;=]/g, "");
            const leftoverSymbols = stripped.match(/[a-zA-Z]+/g) || [];
            const invalidSymbols = leftoverSymbols.filter((s) => !paramNames.includes(s));
            if (invalidSymbols.length > 0) {
              console.warn("Dropping graph tool call with unsupported symbols:", call);
              return false;
            }
          }
        }
        return true;
      });

      console.log("Tool detection result:", validatedToolCalls);
      return NextResponse.json({ toolCalls: validatedToolCalls });
    }

    console.log("No tool calls detected");
    return NextResponse.json({ toolCalls: [] });
  } catch (error) {
    console.error("Tool detection error:", error);
    return NextResponse.json({ toolCalls: [] });
  }
}
