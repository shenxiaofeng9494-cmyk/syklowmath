/**
 * Tool Detection API using Doubao Chat (火山引擎)
 *
 * Analyzes AI response text and determines if any tools should be called.
 * Used as a fallback when the primary voice model doesn't support Function Calling.
 */

import { NextRequest, NextResponse } from "next/server";

// 火山引擎 ARK API
const ARK_API_URL = "https://ark.cn-beijing.volces.com/api/v3/chat/completions";

const TOOL_DETECTION_PROMPT = `你是数学教学助手的工具调用判断器。分析 AI 老师的回复，判断需要调用哪些工具。

## 工具调用原则（不要只靠关键词）
- 只要老师在描述“方程/公式/表达式/一般形式/代入求解”等，提取表达式，调用 use_whiteboard(formula)
- 只要老师在讲“函数/图像/抛物线/直线/开口/顶点/截距/随x变化”等，调用 use_whiteboard(graph)，**必须给出 y=... 的具体数值表达式**；给不出就不要调用 graph
- 只要老师口头说“画/画个/画一下/画出来”之类的动词，必须给出具体数值表达式，并调用 use_whiteboard(graph)；给不出具体表达式就不要调用
- 如果老师明确说要恢复播放，才调用 resume_video；明确说跳转才调用 jump_to_video_node

## 判断规则
1) formula：抓住任何“等于”“一般形式”“方程是”“表达式”这类表述，即使没出现“写出来”字样，也要提取成 LaTeX，优先用具体数值例子而非符号参数
2) graph：只要提到函数或图像相关的词（函数、图像、抛物线、直线、开口、顶点、截距、单调、增减、y 等于…），就输出带数值系数的 expression（如 "y = 2x^2 - 3x + 1"），并调用 use_whiteboard(graph)。**缺少数值 expression 或 expression 含除 x 以外的未声明符号时，不要调用 graph。多个函数用逗号/换行分隔。**
3) 如果同时有公式描述和图像描述，优先 graph（因为图像更直观）
4) 讲知识点时要给真实的公式/函数，不要说“我给你画一下”这种空泛话；如果说举例或画图，必须给出具体内容和数值例子（即便学生没主动要求画图，也要主动给出例子）
5) 没有数学内容才不调用工具`;

const TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "use_whiteboard",
      description: "在画板上展示数学公式或函数图像",
      parameters: {
        type: "object",
        properties: {
          content_type: {
            type: "string",
            enum: ["formula", "graph"],
            description: "内容类型：formula(公式)、graph(函数图)",
          },
          latex: {
            type: "string",
            description: "LaTeX 格式的公式，用于 formula 类型",
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
];

export async function POST(req: NextRequest) {
  try {
    const { aiResponse, userMessage } = await req.json();

    console.log("=== Tool Detection (Doubao) ===");
    console.log("User:", userMessage);
    console.log("AI:", aiResponse);

    // 火山引擎 ARK API Key
    const apiKey = process.env.ARK_API_KEY || process.env.DOUBAO_CHAT_API_KEY;

    if (!apiKey) {
      console.error("ARK_API_KEY or DOUBAO_CHAT_API_KEY not configured");
      return NextResponse.json({ toolCalls: [] });
    }

    // 使用 Endpoint ID 或默认模型名称
    const model = process.env.DOUBAO_CHAT_ENDPOINT_ID || "doubao-1-5-pro-32k";

    const response = await fetch(ARK_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: TOOL_DETECTION_PROMPT },
          {
            role: "user",
            content: `用户问题：${userMessage}\n\nAI老师回复：${aiResponse}\n\n请判断是否需要调用工具。`,
          },
        ],
        tools: TOOLS,
        tool_choice: "auto",
        max_tokens: 500,
        temperature: 0,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Doubao API error:", error);
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
