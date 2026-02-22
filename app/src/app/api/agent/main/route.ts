// ============================================================
// V2 学习分析系统 - 主 API 路由
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { orchestrate, isDeepSeekAvailable } from '@/lib/agents';
import { getAuthUser } from '@/lib/auth/require-auth';
import type { OrchestratorRequest } from '@/lib/agents/types';

export async function POST(req: NextRequest) {
  try {
    // 检查 DeepSeek 是否可用
    if (!isDeepSeekAvailable()) {
      return NextResponse.json(
        { error: 'DeepSeek API not configured. Please set DEEPSEEK_API_KEY.' },
        { status: 500 }
      );
    }

    const body = await req.json();

    // 验证必要字段
    const { intent, videoId, payload } = body as OrchestratorRequest;

    // 服务端鉴权：从 cookie 取真实用户 ID，忽略客户端传的 studentId
    const authUser = await getAuthUser();
    const studentId = authUser?.userId ?? body.studentId;

    if (!intent) {
      return NextResponse.json(
        { error: 'Missing required field: intent' },
        { status: 400 }
      );
    }

    if (!studentId) {
      return NextResponse.json(
        { error: 'Missing required field: studentId' },
        { status: 400 }
      );
    }

    // 调用主控 Agent
    const result = await orchestrate({
      intent,
      studentId,
      videoId: videoId || '',
      payload,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('[Agent API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}

// 健康检查
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    deepseekAvailable: isDeepSeekAvailable(),
    version: 'v2',
  });
}
