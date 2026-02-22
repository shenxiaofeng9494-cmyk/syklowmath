import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getAuthUser } from "@/lib/auth/require-auth";

/** 生成本地 fallback session */
function createLocalSession(studentId: string, videoId: string) {
  return {
    session_id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    student_id: studentId,
    video_id: videoId,
    status: "active",
    turn_count: 0,
    context_summary: "",
    recent_qa: [],
    concepts_touched: {},
    plan_state: { checkpoints_triggered: [], checkpoints_invalidated: [], next_suggested_action: null },
    is_local: true,
  };
}

/**
 * POST /api/session/create
 *
 * 创建或恢复学习会话。一个学生同一视频同时只有一个 active session。
 * 如果已有 active session 则返回已有的（断线重连场景）。
 * Supabase 不可用时自动回退到本地模式。
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const videoId = body.videoId;

    // 服务端鉴权：从 cookie 取真实用户 ID，忽略客户端传的 studentId
    const authUser = await getAuthUser();
    const studentId = authUser?.userId ?? body.studentId;

    if (!studentId || !videoId) {
      return NextResponse.json(
        { error: "studentId and videoId are required" },
        { status: 400 }
      );
    }

    if (!supabase) {
      return NextResponse.json(createLocalSession(studentId, videoId));
    }

    // 尝试 Supabase，失败时回退到本地模式
    try {
      // 检查是否有未结束的 session（断线重连场景）
      const { data: existing, error: findError } = await supabase
        .from("learning_sessions")
        .select("*")
        .eq("student_id", studentId)
        .eq("video_id", videoId)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (existing && !findError) {
        console.log(`[Session] 恢复已有 session: ${existing.session_id}, turn_count: ${existing.turn_count}`);
        return NextResponse.json(existing);
      }

      // 创建新 session
      const { data: session, error: createError } = await supabase
        .from("learning_sessions")
        .insert({
          student_id: studentId,
          video_id: videoId,
          status: "active",
          turn_count: 0,
          context_summary: "",
          recent_qa: [],
          concepts_touched: {},
          plan_state: { checkpoints_triggered: [], checkpoints_invalidated: [], next_suggested_action: null },
        })
        .select()
        .single();

      if (createError) {
        console.warn("[Session] Supabase 创建失败，回退本地模式:", createError.message);
        return NextResponse.json(createLocalSession(studentId, videoId));
      }

      console.log(`[Session] 新建 session: ${session.session_id}`);
      return NextResponse.json(session);
    } catch (dbError) {
      console.warn("[Session] Supabase 不可用，回退本地模式:", dbError);
      return NextResponse.json(createLocalSession(studentId, videoId));
    }
  } catch (error) {
    console.error("[Session] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
