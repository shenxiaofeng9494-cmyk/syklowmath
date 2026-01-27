/**
 * RTC Callback API
 *
 * Receives subtitle and Function Calling callbacks from Volcengine RTC
 * Reference: https://www.volcengine.com/docs/6348/1337284
 */

import { NextRequest, NextResponse } from "next/server";

// In-memory store for callbacks (in production, use Redis or similar)
const callbackStore = new Map<
  string,
  {
    subtitles: SubtitleMessage[];
    functionCalls: FunctionCallMessage[];
    lastUpdate: number;
  }
>();

// Cleanup old entries every 5 minutes
const CLEANUP_INTERVAL = 5 * 60 * 1000;
const MAX_AGE = 30 * 60 * 1000; // 30 minutes

setInterval(() => {
  const now = Date.now();
  for (const [key, value] of callbackStore.entries()) {
    if (now - value.lastUpdate > MAX_AGE) {
      callbackStore.delete(key);
    }
  }
}, CLEANUP_INTERVAL);

interface SubtitleMessage {
  type: "subtitle";
  taskId: string;
  role: "user" | "assistant";
  text: string;
  isFinal: boolean;
  timestamp: number;
}

interface FunctionCallMessage {
  type: "function_call";
  taskId: string;
  callId: string;
  functionName: string;
  arguments: string;
  timestamp: number;
}

// Parse binary subtitle message from Volcengine
function parseSubtitleMessage(
  data: Buffer,
  taskId: string
): SubtitleMessage | null {
  try {
    // Volcengine sends binary messages, try to parse as JSON
    const jsonStr = data.toString("utf-8");
    const parsed = JSON.parse(jsonStr);

    // Extract subtitle info based on Volcengine format
    if (parsed.type === "subtitle" || parsed.subtitle) {
      const subtitle = parsed.subtitle || parsed;
      return {
        type: "subtitle",
        taskId,
        role: subtitle.role === "user" ? "user" : "assistant",
        text: subtitle.text || subtitle.content || "",
        isFinal: subtitle.is_final ?? subtitle.isFinal ?? true,
        timestamp: Date.now(),
      };
    }

    return null;
  } catch {
    console.error("[RTC Callback] Failed to parse subtitle message");
    return null;
  }
}

// Parse function call message from Volcengine
function parseFunctionCallMessage(
  data: Buffer,
  taskId: string
): FunctionCallMessage | null {
  try {
    const jsonStr = data.toString("utf-8");
    const parsed = JSON.parse(jsonStr);

    // Extract function call info based on Volcengine format
    if (parsed.type === "function_call" || parsed.function_call) {
      const fc = parsed.function_call || parsed;
      return {
        type: "function_call",
        taskId,
        callId: fc.call_id || fc.id || `fc-${Date.now()}`,
        functionName: fc.name || fc.function_name || "",
        arguments: fc.arguments || "{}",
        timestamp: Date.now(),
      };
    }

    return null;
  } catch {
    console.error("[RTC Callback] Failed to parse function call message");
    return null;
  }
}

// POST: Receive callbacks from Volcengine
export async function POST(request: NextRequest) {
  try {
    // Get signature from request body for verification
    const contentType = request.headers.get("content-type") || "";
    let body: Buffer;
    let signature: string | null = null;
    let taskId: string | null = null;

    if (contentType.includes("application/json")) {
      const json = await request.json();
      signature = json.signature;
      taskId = json.task_id || json.taskId;
      body = Buffer.from(JSON.stringify(json));
    } else {
      // Binary data
      body = Buffer.from(await request.arrayBuffer());
    }

    // Verify signature
    const expectedSignature =
      process.env.VOLCENGINE_RTC_CALLBACK_SIGNATURE || "mathtalk-signature";
    if (signature && signature !== expectedSignature) {
      console.warn("[RTC Callback] Invalid signature");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    // Try to extract taskId from body if not in JSON
    if (!taskId) {
      try {
        const parsed = JSON.parse(body.toString("utf-8"));
        taskId = parsed.task_id || parsed.taskId || "unknown";
      } catch {
        taskId = "unknown";
      }
    }

    console.log(`[RTC Callback] Received callback for task: ${taskId}`);
    console.log(`[RTC Callback] Body:`, body.toString("utf-8").slice(0, 500));

    // Initialize store for this task if needed
    if (!callbackStore.has(taskId)) {
      callbackStore.set(taskId, {
        subtitles: [],
        functionCalls: [],
        lastUpdate: Date.now(),
      });
    }

    const store = callbackStore.get(taskId)!;
    store.lastUpdate = Date.now();

    // Try to parse as subtitle
    const subtitle = parseSubtitleMessage(body, taskId);
    if (subtitle) {
      store.subtitles.push(subtitle);
      // Keep only last 100 subtitles
      if (store.subtitles.length > 100) {
        store.subtitles = store.subtitles.slice(-100);
      }
      console.log(`[RTC Callback] Subtitle: ${subtitle.role}: ${subtitle.text}`);
    }

    // Try to parse as function call
    const functionCall = parseFunctionCallMessage(body, taskId);
    if (functionCall) {
      store.functionCalls.push(functionCall);
      // Keep only last 50 function calls
      if (store.functionCalls.length > 50) {
        store.functionCalls = store.functionCalls.slice(-50);
      }
      console.log(
        `[RTC Callback] Function call: ${functionCall.functionName}(${functionCall.arguments})`
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[RTC Callback] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// GET: Poll for callbacks (used by frontend)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const taskId = searchParams.get("taskId");
  const since = parseInt(searchParams.get("since") || "0", 10);

  if (!taskId) {
    return NextResponse.json({ error: "taskId is required" }, { status: 400 });
  }

  const store = callbackStore.get(taskId);
  if (!store) {
    return NextResponse.json({
      subtitles: [],
      functionCalls: [],
    });
  }

  // Filter by timestamp
  const subtitles = store.subtitles.filter((s) => s.timestamp > since);
  const functionCalls = store.functionCalls.filter((f) => f.timestamp > since);

  return NextResponse.json({
    subtitles,
    functionCalls,
    lastUpdate: store.lastUpdate,
  });
}
