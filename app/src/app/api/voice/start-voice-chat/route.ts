/**
 * StartVoiceChat API
 *
 * Calls Volcengine StartVoiceChat OpenAPI to start AI voice interaction
 * Reference: https://www.volcengine.com/docs/6348/2123348
 */

import { NextRequest, NextResponse } from "next/server";
import {
  signVolcengineRequest,
  buildVolcengineUrl,
} from "@/lib/volcengine-auth";

const RTC_API_HOST = "rtc.volcengineapi.com";
const API_VERSION = "2025-06-01";

interface StartVoiceChatRequest {
  roomId: string;
  userId: string;
  taskId: string;
  systemPrompt?: string;
  welcomeMessage?: string;
  tools?: ToolDefinition[];
}

interface ToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

// Convert our tool format to Volcengine format
function convertTools(tools: ToolDefinition[]) {
  return tools.map((tool) => ({
    type: "function",
    function: {
      name: tool.function.name,
      description: tool.function.description,
      parameters: tool.function.parameters,
    },
  }));
}

export async function POST(request: NextRequest) {
  try {
    const body: StartVoiceChatRequest = await request.json();
    const { roomId, userId, taskId, systemPrompt, welcomeMessage, tools } =
      body;

    if (!roomId || !userId || !taskId) {
      return NextResponse.json(
        { error: "roomId, userId, and taskId are required" },
        { status: 400 }
      );
    }

    const appId = process.env.VOLCENGINE_RTC_APP_ID;
    const accessKeyId = process.env.VOLCENGINE_ACCESS_KEY_ID;
    const accessKeySecret = process.env.VOLCENGINE_ACCESS_KEY_SECRET;
    const callbackUrl = process.env.VOLCENGINE_RTC_CALLBACK_URL;
    const callbackSignature =
      process.env.VOLCENGINE_RTC_CALLBACK_SIGNATURE || "mathtalk-signature";

    if (!appId || !accessKeyId || !accessKeySecret) {
      console.error("Missing Volcengine RTC credentials");
      return NextResponse.json(
        { error: "Volcengine RTC credentials not configured" },
        { status: 500 }
      );
    }

    // Build StartVoiceChat request body
    const voiceChatConfig = {
      AppId: appId,
      RoomId: roomId,
      TaskId: taskId,
      Config: {
        ASRConfig: {
          Provider: "volcano",
          ProviderParams: {
            Mode: "bigmodel",
            StreamMode: 2,
            enable_nonstream: true,
          },
          VADConfig: {
            SilenceTime: 600,
            AIVAD: true,
          },
          InterruptConfig: {
            InterruptSpeechDuration: 300,
          },
        },
        LLMConfig: {
          Mode: "ArkV3",
          ModelName: "doubao-seed-1-6-251015",
          SystemMessages: [
            systemPrompt ||
              "你是一个友好的数学老师，正在帮助初中生学习数学。",
          ],
          HistoryLength: 10,
          ThinkingType: "disabled",
          ...(tools && tools.length > 0
            ? { Tools: convertTools(tools), EnableParallelToolCalls: false }
            : {}),
        },
        TTSConfig: {
          Provider: "volcano_bidirection",
          ProviderParams: {
            Credential: {
              ResourceId: "seed-tts-1.0",
            },
            VolcanoTTSParameters: JSON.stringify({
              req_params: {
                speaker: "zh_female_tianmeixiaoyuan_moon_bigtts",
                audio_params: {
                  speech_rate: 0,
                },
              },
            }),
          },
        },
        SubtitleConfig: callbackUrl
          ? {
              ServerMessageUrl: `${callbackUrl}/api/voice/rtc-callback`,
              ServerMessageSignature: callbackSignature,
              SubtitleMode: 1,
            }
          : {},
        FunctionCallingConfig:
          callbackUrl && tools && tools.length > 0
            ? {
                ServerMessageUrl: `${callbackUrl}/api/voice/rtc-callback`,
                ServerMessageSignature: callbackSignature,
              }
            : {},
        InterruptMode: 0,
      },
      AgentConfig: {
        TargetUserId: [userId],
        UserId: `ai-tutor-${taskId}`,
        WelcomeMessage:
          welcomeMessage || "你好！我是你的数学小助手，有什么问题可以问我哦！",
        IdleTimeout: 180,
      },
    };

    const requestBody = JSON.stringify(voiceChatConfig);

    // Build query parameters
    const query = {
      Action: "StartVoiceChat",
      Version: API_VERSION,
    };

    // Sign the request
    const headers = signVolcengineRequest({
      method: "POST",
      host: RTC_API_HOST,
      path: "/",
      query,
      headers: {
        "content-type": "application/json",
      },
      body: requestBody,
      accessKeyId,
      accessKeySecret,
      region: "cn-north-1",
      service: "rtc",
    });

    // Build URL and make request
    const url = buildVolcengineUrl(RTC_API_HOST, "/", query);

    console.log("[StartVoiceChat] Calling API:", url);
    console.log("[StartVoiceChat] Request body:", requestBody);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        ...headers,
        "content-type": "application/json",
      },
      body: requestBody,
    });

    const responseText = await response.text();
    console.log("[StartVoiceChat] Response:", responseText);

    if (!response.ok) {
      console.error("[StartVoiceChat] API error:", responseText);
      return NextResponse.json(
        { error: "Failed to start voice chat", details: responseText },
        { status: response.status }
      );
    }

    const result = JSON.parse(responseText);

    return NextResponse.json({
      success: true,
      taskId,
      roomId,
      aiUserId: `ai-tutor-${taskId}`,
      result,
    });
  } catch (error) {
    console.error("[StartVoiceChat] Error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: String(error) },
      { status: 500 }
    );
  }
}
