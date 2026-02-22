import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

/**
 * POST /api/session/end
 *
 * 结束学习会话（学生离开视频页面时调用）
 * Supabase 不可用时静默降级。
 */
export async function POST(req: NextRequest) {
  try {
    const { sessionId } = await req.json();

    if (!sessionId) {
      return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
    }

    // local session 或 Supabase 未配置
    if (!supabase || sessionId.startsWith("local-")) {
      return NextResponse.json({ ok: true, is_local: true });
    }

    try {
      const { error } = await supabase
        .from("learning_sessions")
        .update({
          status: "ended",
          ended_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("session_id", sessionId);

      if (error) {
        console.warn("[Session End] 更新失败:", error.message);
      } else {
        console.log(`[Session End] session=${sessionId}`);
      }
    } catch (dbError) {
      console.warn("[Session End] Supabase 不可用:", dbError);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[Session End] Error:", error);
    return NextResponse.json({ ok: true });
  }
}
