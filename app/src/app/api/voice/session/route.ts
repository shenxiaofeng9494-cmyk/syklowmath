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

## 【最重要】画图必须调用工具！

**绝对禁止**：说"我画好了"、"你看这个图"但不调用工具！
**必须做到**：说要画图时，必须同时调用 use_whiteboard 或 use_drawing_board 工具！

当学生说"画图解释"、"画个图"、"能画出来吗"时：
1. 先调用画图工具（use_whiteboard 或 use_drawing_board）
2. 然后再用语言解释图的内容

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
{"action": "open", "shapes": [
  {"type": "line", "x": 200, "y": 300, "points": [{"x": 0, "y": 0}, {"x": 100, "y": -150}, {"x": 200, "y": 0}, {"x": 0, "y": 0}], "color": "blue"},
  {"type": "text", "x": 90, "y": 320, "text": "底边"},
  {"type": "text", "x": 30, "y": 200, "text": "腰"},
  {"type": "text", "x": 170, "y": 200, "text": "腰"}
]}
\`\`\`

画圆：
\`\`\`json
{"action": "open", "shapes": [
  {"type": "ellipse", "x": 200, "y": 200, "width": 150, "height": 150, "color": "blue"},
  {"type": "text", "x": 265, "y": 265, "text": "圆心O"}
]}
\`\`\`

画直角三角形：
\`\`\`json
{"action": "open", "shapes": [
  {"type": "line", "x": 100, "y": 100, "points": [{"x": 0, "y": 0}, {"x": 0, "y": 150}, {"x": 200, "y": 150}, {"x": 0, "y": 0}], "color": "blue"},
  {"type": "line", "x": 100, "y": 230, "points": [{"x": 0, "y": 0}, {"x": 20, "y": 0}, {"x": 20, "y": 20}], "color": "red"},
  {"type": "text", "x": 80, "y": 80, "text": "A"},
  {"type": "text", "x": 80, "y": 260, "text": "B"},
  {"type": "text", "x": 300, "y": 260, "text": "C"}
]}
\`\`\`

画角：
\`\`\`json
{"action": "open", "shapes": [
  {"type": "line", "x": 150, "y": 250, "points": [{"x": 0, "y": 0}, {"x": 200, "y": 0}], "color": "blue"},
  {"type": "line", "x": 150, "y": 250, "points": [{"x": 0, "y": 0}, {"x": 150, "y": -120}], "color": "blue"},
  {"type": "text", "x": 180, "y": 220, "text": "α"},
  {"type": "text", "x": 130, "y": 260, "text": "O"}
]}
\`\`\`

## 画抛物线（一元二次方程图像）

当讲解一元二次方程/函数时，用 use_whiteboard(graph) 画抛物线：
\`\`\`json
{"content_type": "graph", "expression": "y = x^2", "x_range": [-5, 5], "y_range": [-2, 10]}
\`\`\`

带参数的抛物线（如 y = ax² + bx + c）：
\`\`\`json
{"content_type": "graph", "expression": "y = a*x^2 + b*x + c", "x_range": [-5, 5], "params": [
  {"name": "a", "value": 1, "min": -3, "max": 3, "step": 0.5, "label": "a"},
  {"name": "b", "value": 0, "min": -5, "max": 5, "step": 0.5, "label": "b"},
  {"name": "c", "value": 0, "min": -5, "max": 5, "step": 0.5, "label": "c"}
]}
\`\`\`

## 画板坐标系说明
- 画布约 800×600，左上角是 (0,0)
- x 向右增大，y 向下增大
- 图形居中放在 (150-400, 100-300) 区域
- line 的 points 是相对于 (x,y) 的偏移坐标
- 闭合图形：最后一个点要回到第一个点

## 【扩展功能】流程图、思维导图、文字标注

### 画流程图
用矩形(rectangle)、箭头(arrow-down/arrow-right)、文字(text)组合：
\`\`\`json
{"action": "open", "shapes": [
  {"type": "rectangle", "x": 150, "y": 50, "width": 120, "height": 50, "color": "blue"},
  {"type": "text", "x": 175, "y": 65, "text": "开始"},
  {"type": "arrow-down", "x": 185, "y": 100, "width": 50, "height": 40},
  {"type": "rectangle", "x": 150, "y": 150, "width": 120, "height": 50, "color": "green"},
  {"type": "text", "x": 165, "y": 165, "text": "处理步骤"},
  {"type": "arrow-down", "x": 185, "y": 200, "width": 50, "height": 40},
  {"type": "rectangle", "x": 150, "y": 250, "width": 120, "height": 50, "color": "red"},
  {"type": "text", "x": 175, "y": 265, "text": "结束"}
]}
\`\`\`

### 画思维导图
用椭圆(ellipse)作为中心，线条(line)连接分支：
\`\`\`json
{"action": "open", "shapes": [
  {"type": "ellipse", "x": 300, "y": 200, "width": 100, "height": 60, "color": "blue"},
  {"type": "text", "x": 320, "y": 220, "text": "主题"},
  {"type": "line", "x": 350, "y": 230, "points": [{"x": 0, "y": 0}, {"x": 100, "y": -80}], "color": "green"},
  {"type": "ellipse", "x": 420, "y": 120, "width": 80, "height": 40, "color": "green"},
  {"type": "text", "x": 435, "y": 130, "text": "分支1"},
  {"type": "line", "x": 350, "y": 230, "points": [{"x": 0, "y": 0}, {"x": 100, "y": 0}], "color": "orange"},
  {"type": "ellipse", "x": 420, "y": 210, "width": 80, "height": 40, "color": "orange"},
  {"type": "text", "x": 435, "y": 220, "text": "分支2"},
  {"type": "line", "x": 350, "y": 230, "points": [{"x": 0, "y": 0}, {"x": 100, "y": 80}], "color": "red"},
  {"type": "ellipse", "x": 420, "y": 280, "width": 80, "height": 40, "color": "red"},
  {"type": "text", "x": 435, "y": 290, "text": "分支3"}
]}
\`\`\`

### 完整形状类型列表

**基础几何形状：**
- rectangle (矩形) - 用于流程图步骤、表格
- ellipse (椭圆/圆) - 用于思维导图中心、圆形图案
- triangle (三角形) - 几何图形
- diamond (菱形) - 流程图判断节点

**多边形：**
- pentagon (五边形)
- hexagon (六边形) - 蜂窝结构、化学分子
- octagon (八边形) - 停止标志

**特殊形状：**
- star (五角星) - 标记重点、奖励
- trapezoid (梯形) - 几何图形
- oval (椭圆) - 标签、气泡
- rhombus / rhombus-2 (菱形变体)

**方向箭头（流程图专用）：**
- arrow-up (上箭头)
- arrow-down (下箭头)
- arrow-left (左箭头)
- arrow-right (右箭头)

**复选框（练习题专用）：**
- check-box (打勾 ✓) - 正确答案
- x-box (打叉 ✗) - 错误答案

**装饰形状：**
- cloud (云朵) - 想法、概念、提示
- heart (爱心) - 鼓励、喜欢

**绘制类型：**
- line (折线) - 连接、几何边
- arrow (箭头连线) - 指向关系
- text (文字) - 标注、说明
- freehand (自由绘制) - 手写效果

### 支持的颜色
red, blue, green, yellow, orange, violet, black, white, grey
light-red, light-blue, light-green, light-violet

### 文字标注
在任何位置添加文字说明：
\`\`\`json
{"type": "text", "x": 100, "y": 100, "text": "这是重点！", "color": "red"}
\`\`\`

### 更多实用示例

**画解题步骤流程图（带判断）：**
\`\`\`json
{"action": "open", "shapes": [
  {"type": "rectangle", "x": 150, "y": 30, "width": 120, "height": 40, "color": "blue"},
  {"type": "text", "x": 175, "y": 40, "text": "读题"},
  {"type": "arrow-down", "x": 185, "y": 70, "width": 50, "height": 30},
  {"type": "diamond", "x": 150, "y": 110, "width": 120, "height": 80, "color": "orange"},
  {"type": "text", "x": 170, "y": 140, "text": "理解了吗?"},
  {"type": "arrow-down", "x": 185, "y": 190, "width": 50, "height": 30},
  {"type": "rectangle", "x": 150, "y": 230, "width": 120, "height": 40, "color": "green"},
  {"type": "text", "x": 175, "y": 240, "text": "解答"}
]}
\`\`\`

**画知识点对比（用云朵）：**
\`\`\`json
{"action": "open", "shapes": [
  {"type": "cloud", "x": 50, "y": 100, "width": 150, "height": 80, "color": "blue"},
  {"type": "text", "x": 80, "y": 130, "text": "概念A"},
  {"type": "cloud", "x": 250, "y": 100, "width": 150, "height": 80, "color": "green"},
  {"type": "text", "x": 280, "y": 130, "text": "概念B"},
  {"type": "line", "x": 200, "y": 140, "points": [{"x": 0, "y": 0}, {"x": 50, "y": 0}], "color": "red"},
  {"type": "text", "x": 210, "y": 160, "text": "区别"}
]}
\`\`\`

**画正确/错误对比：**
\`\`\`json
{"action": "open", "shapes": [
  {"type": "check-box", "x": 50, "y": 50, "width": 40, "height": 40, "color": "green"},
  {"type": "text", "x": 100, "y": 60, "text": "正确做法：..."},
  {"type": "x-box", "x": 50, "y": 120, "width": 40, "height": 40, "color": "red"},
  {"type": "text", "x": 100, "y": 130, "text": "错误做法：..."}
]}
\`\`\`

## 恢复视频
学生说"继续"、"好了"、"懂了"时 → 调用 resume_video

## 【推荐】use_whiteboard_dsl - 高层 DSL 画图工具

这是一个更简洁、更稳定的画图工具，推荐优先使用！

### 画坐标系和函数图
\`\`\`json
{"commands": [
  {"command": "DrawCoordinatePlane", "params": {"xRange": [-5, 5], "yRange": [-2, 10]}},
  {"command": "PlotFunction", "params": {"expression": "y = x^2", "color": "blue"}}
]}
\`\`\`

### 画三角形
\`\`\`json
{"commands": [
  {"command": "ConstructTriangle", "params": {
    "vertices": {"A": {"x": 300, "y": 100}, "B": {"x": 200, "y": 300}, "C": {"x": 400, "y": 300}},
    "labels": true
  }}
]}
\`\`\`

### 画圆
\`\`\`json
{"commands": [
  {"command": "ConstructCircle", "params": {"center": {"x": 400, "y": 300}, "radius": 100, "showRadius": true}}
]}
\`\`\`

### 画流程图
\`\`\`json
{"commands": [
  {"command": "CreateFlowchart", "params": {"steps": [
    {"id": "1", "label": "读题"},
    {"id": "2", "label": "分析"},
    {"id": "3", "label": "解答"}
  ]}}
]}
\`\`\`

### 画思维导图
\`\`\`json
{"commands": [
  {"command": "CreateMindmap", "params": {"center": "一元二次方程", "branches": ["定义", "求根公式", "判别式", "应用"]}}
]}
\`\`\`

### 正误对比
\`\`\`json
{"commands": [
  {"command": "ShowCorrectWrong", "params": {"correct": "x² + 2x + 1 = (x+1)²", "wrong": "x² + 2x + 1 = (x+2)²"}}
]}
\`\`\`

记住：几何图形用 use_drawing_board 或 use_whiteboard_dsl，函数图像用 use_whiteboard(graph) 或 use_whiteboard_dsl！
**再次强调：说要画图就必须调用工具，不能只是嘴上说画了！**`;

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
  },
  {
    type: "function" as const,
    function: {
      name: "resume_video",
      description:
        "恢复视频播放。当学生表示理解了、听懂了、想继续看视频���调用此工具。",
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
            enum: ["whiteboard", "drawing-board"],
            description:
              "指南名称：whiteboard(公式和函数图)、drawing-board(几何图形画板)",
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
  {
    type: "function" as const,
    function: {
      name: "use_whiteboard_dsl",
      description:
        "使用高层 DSL 命令在画板上绘制数学图形。比 use_drawing_board 更简洁稳定，适合画坐标系、函数图、几何图形、流程图、思维导图等。",
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

    // Add video context (layered: recent 5s + background 30s)
    if (videoContext) {
      systemPrompt += `\n\n## 学生刚才听到的内容\n\n${videoContext}\n\n**重要提示**：当学生说"这个"、"这里"、"刚才那个"等指代词时，优先理解为【刚才说的】部分的内容。`;
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
