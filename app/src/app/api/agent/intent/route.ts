// ============================================================
// 意图识别 API（独立接口，可在语音流程中快速调用）
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { quickIntentCheck, isDeepSeekAvailable } from '@/lib/agents';

export async function POST(req: NextRequest) {
  try {
    if (!isDeepSeekAvailable()) {
      // 如果 DeepSeek 不可用，默认响应
      return NextResponse.json({
        shouldRespond: true,
        reason: 'DeepSeek not available, defaulting to respond',
      });
    }

    const body = await req.json();
    const { asrText, dialogState = 'idle' } = body;

    if (!asrText) {
      return NextResponse.json({
        shouldRespond: false,
        reason: 'Empty input',
      });
    }

    const result = await quickIntentCheck(asrText, dialogState);

    return NextResponse.json(result);
  } catch (error) {
    console.error('[Intent API] Error:', error);
    // 出错时默认响应，避免漏掉用户输入
    return NextResponse.json({
      shouldRespond: true,
      reason: 'Error occurred, defaulting to respond',
    });
  }
}
