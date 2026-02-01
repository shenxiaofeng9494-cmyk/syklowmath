import { NextRequest, NextResponse } from "next/server";

// 豆包 LLM API 配置
const DOUBAO_API_KEY = process.env.DOUBAO_API_KEY;
const DOUBAO_API_BASE = process.env.DOUBAO_API_BASE || "https://ark.cn-beijing.volces.com/api/v3";
const DOUBAO_MODEL_ENDPOINT = process.env.DOUBAO_MODEL_ENDPOINT;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (!DOUBAO_API_KEY) {
      return NextResponse.json(
        { error: "DOUBAO_API_KEY not configured" },
        { status: 500 }
      );
    }

    if (!DOUBAO_MODEL_ENDPOINT) {
      return NextResponse.json(
        { error: "DOUBAO_MODEL_ENDPOINT not configured" },
        { status: 500 }
      );
    }

    // Validate request
    if (!body.messages || !Array.isArray(body.messages)) {
      return NextResponse.json(
        { error: "Invalid request: messages required" },
        { status: 400 }
      );
    }

    // 构建豆包 API URL
    const doubaoApiUrl = `${DOUBAO_API_BASE}/chat/completions`;

    // Prepare request to Doubao LLM
    // 注意：如果模型不支持 function calling，不要发送 tools 参数
    const doubaoRequest: Record<string, unknown> = {
      model: DOUBAO_MODEL_ENDPOINT,
      messages: body.messages,
      stream: body.stream ?? true,
      max_tokens: body.max_tokens || 2048,
      temperature: body.temperature ?? 0.7,
      top_p: body.top_p ?? 0.9,
    };

    // 只有当 tools 存在且非空时才添加（暂时禁用以支持不支持 function calling 的模型）
    // if (body.tools && body.tools.length > 0) {
    //   doubaoRequest.tools = body.tools;
    //   doubaoRequest.tool_choice = body.tool_choice || "auto";
    // }

    // If not streaming, make a simple request
    if (!doubaoRequest.stream) {
      const response = await fetch(doubaoApiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${DOUBAO_API_KEY}`,
        },
        body: JSON.stringify(doubaoRequest),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Doubao LLM API error:", errorText);
        return NextResponse.json(
          { error: "Doubao LLM API error", details: errorText },
          { status: response.status }
        );
      }

      const data = await response.json();
      return NextResponse.json(data);
    }

    // Streaming response
    const response = await fetch(doubaoApiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${DOUBAO_API_KEY}`,
      },
      body: JSON.stringify(doubaoRequest),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Doubao LLM API error:", errorText);
      return NextResponse.json(
        { error: "Doubao LLM API error", details: errorText },
        { status: response.status }
      );
    }

    // Create a TransformStream to pass through the SSE response
    const transformStream = new TransformStream({
      async transform(chunk, controller) {
        // Pass through the SSE data as-is
        controller.enqueue(chunk);
      },
    });

    // Pipe the response through our transform stream
    const reader = response.body?.getReader();
    const writer = transformStream.writable.getWriter();

    // Process the stream in the background
    (async () => {
      try {
        if (!reader) {
          await writer.close();
          return;
        }

        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            await writer.close();
            break;
          }

          // Pass through the data
          await writer.write(value);
        }
      } catch (error) {
        console.error("Stream processing error:", error);
        try {
          await writer.abort(error instanceof Error ? error : new Error(String(error)));
        } catch {
          // Ignore abort errors
        }
      }
    })();

    return new Response(transformStream.readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  } catch (error) {
    console.error("Error in chat API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
