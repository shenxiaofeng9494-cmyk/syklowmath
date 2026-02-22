import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { memory } from "@/lib/agents/memory";

interface RecentQA {
  q: string;
  a: string;
  mode: "realtime" | "precise" | "doubao_realtime";
  ts: number;
}

// 摘要生成用的 LLM 配置（复用豆包/DeepSeek）
const DOUBAO_API_KEY = process.env.DOUBAO_API_KEY;
const DOUBAO_API_BASE = process.env.DOUBAO_API_BASE || "https://ark.cn-beijing.volces.com/api/v3";
const DOUBAO_MODEL_ENDPOINT = process.env.DOUBAO_MODEL_ENDPOINT;

/**
 * POST /api/session/update
 *
 * 每轮对话后写入 Q&A。两种模式都调用此接口。
 * 每 3 轮异步更新摘要。
 */
export async function POST(req: NextRequest) {
  try {
    const { sessionId, question, answer, mode, conceptsUpdate, checkpointResult } = await req.json();

    if (!sessionId || !question) {
      return NextResponse.json(
        { error: "sessionId and question are required" },
        { status: 400 }
      );
    }

    // local session 或 Supabase 未配置：直接返回成功
    if (!supabase || sessionId.startsWith("local-")) {
      return NextResponse.json({ ok: true, is_local: true });
    }

    // 1. 读取当前 session（包裹 try/catch，Supabase 不可用时静默降级）
    let session: Record<string, unknown> | null = null;
    try {
      const { data, error: fetchError } = await supabase
        .from("learning_sessions")
        .select("*")
        .eq("session_id", sessionId)
        .single();

      if (fetchError || !data) {
        console.warn("[Session Update] Session not found:", sessionId, fetchError?.message);
        return NextResponse.json({ ok: true, is_local: true });
      }
      session = data;
    } catch (dbError) {
      console.warn("[Session Update] Supabase 不可用，静默降级:", dbError);
      return NextResponse.json({ ok: true, is_local: true });
    }

    // session 为 null 时上面已经 return，这里做 TS guard
    if (!session) {
      return NextResponse.json({ ok: true, is_local: true });
    }

    // 2. 更新 recent_qa（FIFO，保留最近 5 轮）
    const existingQa: RecentQA[] = Array.isArray(session.recent_qa) ? session.recent_qa as RecentQA[] : [];
    const newQa: RecentQA = {
      q: truncate(question, 150),
      a: truncate(answer || "", 150),
      mode: mode || "precise",
      ts: Date.now(),
    };
    const recentQa = [...existingQa, newQa].slice(-5);

    // 3. 合并概念状态更新
    const existingConcepts = (session.concepts_touched || {}) as Record<string, string>;
    const mergedConcepts = conceptsUpdate
      ? { ...existingConcepts, ...conceptsUpdate }
      : existingConcepts;

    const newTurnCount = ((session.turn_count as number) || 0) + 1;

    // 4. 立即写回（Supabase 失败时静默降级）
    try {
      const { error: updateError } = await supabase!
        .from("learning_sessions")
        .update({
          turn_count: newTurnCount,
          recent_qa: recentQa,
          concepts_touched: mergedConcepts,
          updated_at: new Date().toISOString(),
        })
        .eq("session_id", sessionId);

      if (updateError) {
        console.warn("[Session Update] 写入失败:", updateError.message);
        return NextResponse.json({ ok: true, is_local: true });
      }
    } catch (dbError) {
      console.warn("[Session Update] Supabase 写入异常，静默降级:", dbError);
      return NextResponse.json({ ok: true, is_local: true });
    }

    console.log(`[Session Update] session=${sessionId} turn=${newTurnCount} mode=${mode}`);

    // 5. 节点 checkpoint 画像更新（异步，不阻塞返回）
    if (checkpointResult && checkpointResult.studentId) {
      memory.updateProfileFromCheckpoint(
        checkpointResult.studentId,
        {
          nodeId: checkpointResult.nodeId || "",
          keyConcepts: checkpointResult.keyConcepts || [],
          isCorrect: checkpointResult.isCorrect,
          interventionType: checkpointResult.interventionType,
        }
      ).catch((err: unknown) =>
        console.error("[Session Update] 画像更新失败:", err)
      );
    }

    // 6. 每 3 轮异步更新摘要（不阻塞返回）
    if (newTurnCount % 3 === 0) {
      updateSummaryAsync(sessionId, recentQa, (session.context_summary as string) || "").catch((err) =>
        console.error("[Session Update] 异步摘要更新失败:", err)
      );
    }

    return NextResponse.json({ ok: true, turn_count: newTurnCount });
  } catch (error) {
    console.error("[Session Update] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * 异步生成增量摘要 + 提取概念状态
 * 使用豆包 LLM，非常轻量（约 500 token）
 */
async function updateSummaryAsync(
  sessionId: string,
  recentQa: RecentQA[],
  previousSummary: string
) {
  if (!DOUBAO_API_KEY || !DOUBAO_MODEL_ENDPOINT || !supabase) {
    return;
  }

  const qaText = recentQa
    .map((qa) => `学生问(${qa.mode})：${qa.q}\nAI答：${qa.a}`)
    .join("\n\n");

  // 同时生成摘要 + 提取概念（一次 LLM 调用完成两件事）
  const prompt = `你是学习对话分析器。请基于旧摘要和最近的对话，输出 JSON。

旧摘要：${previousSummary || "（首次对话）"}

最近对话：
${qaText}

请输出严格的 JSON（不要 markdown）：
{
  "summary": "更新后的对话摘要，包括学生问了什么、理解了什么、困惑什么，200字以内",
  "concepts": {
    "概念名1": "touched 或 confused 或 understood",
    "概念名2": "touched 或 confused 或 understood"
  }
}

注意：
1. summary 是增量更新，保留旧摘要中仍然相关的信息
2. concepts 只提取数学概念，值反映学生当前理解状态
3. 直接输出 JSON，不要用 \`\`\` 包裹`;

  try {
    const response = await fetch(`${DOUBAO_API_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${DOUBAO_API_KEY}`,
      },
      body: JSON.stringify({
        model: DOUBAO_MODEL_ENDPOINT,
        messages: [
          { role: "system", content: "你是一个精准的 JSON 输出器。只输出有效的 JSON，不要输出任何其他内容。" },
          { role: "user", content: prompt },
        ],
        max_tokens: 800,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      console.error("[Summary] LLM API error:", response.status);
      return;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim();

    if (!content) {
      console.error("[Summary] Empty LLM response");
      return;
    }

    // 解析 JSON（去除可能的 markdown 包裹）
    const jsonStr = content.replace(/^```json?\s*/, "").replace(/\s*```$/, "");
    const parsed = JSON.parse(jsonStr);

    const summary = parsed.summary || previousSummary;
    const concepts = parsed.concepts || {};

    // 合并概念状态（新的覆盖旧的）
    const { data: currentSession } = await supabase
      .from("learning_sessions")
      .select("concepts_touched")
      .eq("session_id", sessionId)
      .single();

    const mergedConcepts = {
      ...(currentSession?.concepts_touched || {}),
      ...concepts,
    };

    await supabase
      .from("learning_sessions")
      .update({
        context_summary: summary,
        concepts_touched: mergedConcepts,
        updated_at: new Date().toISOString(),
      })
      .eq("session_id", sessionId);

    console.log(`[Summary] 摘要已更新: session=${sessionId}, concepts=${Object.keys(concepts).join(",")}`);
  } catch (error) {
    console.error("[Summary] 摘要生成失败:", error);
  }
}

/** 截断字符串 */
function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen) + "...";
}
