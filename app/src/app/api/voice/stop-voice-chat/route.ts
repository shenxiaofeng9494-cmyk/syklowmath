/**
 * StopVoiceChat API
 *
 * Calls Volcengine StopVoiceChat OpenAPI to stop AI voice interaction
 * Reference: https://www.volcengine.com/docs/6348/2123349
 */

import { NextRequest, NextResponse } from "next/server";
import {
  signVolcengineRequest,
  buildVolcengineUrl,
} from "@/lib/volcengine-auth";

const RTC_API_HOST = "rtc.volcengineapi.com";
const API_VERSION = "2025-06-01";

interface StopVoiceChatRequest {
  roomId: string;
  taskId: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: StopVoiceChatRequest = await request.json();
    const { roomId, taskId } = body;

    if (!roomId || !taskId) {
      return NextResponse.json(
        { error: "roomId and taskId are required" },
        { status: 400 }
      );
    }

    const appId = process.env.VOLCENGINE_RTC_APP_ID;
    const accessKeyId = process.env.VOLCENGINE_ACCESS_KEY_ID;
    const accessKeySecret = process.env.VOLCENGINE_ACCESS_KEY_SECRET;

    if (!appId || !accessKeyId || !accessKeySecret) {
      console.error("Missing Volcengine RTC credentials");
      return NextResponse.json(
        { error: "Volcengine RTC credentials not configured" },
        { status: 500 }
      );
    }

    // Build StopVoiceChat request body
    const stopConfig = {
      AppId: appId,
      RoomId: roomId,
      TaskId: taskId,
    };

    const requestBody = JSON.stringify(stopConfig);

    // Build query parameters
    const query = {
      Action: "StopVoiceChat",
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

    console.log("[StopVoiceChat] Calling API:", url);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        ...headers,
        "content-type": "application/json",
      },
      body: requestBody,
    });

    const responseText = await response.text();
    console.log("[StopVoiceChat] Response:", responseText);

    if (!response.ok) {
      console.error("[StopVoiceChat] API error:", responseText);
      return NextResponse.json(
        { error: "Failed to stop voice chat", details: responseText },
        { status: response.status }
      );
    }

    const result = JSON.parse(responseText);

    return NextResponse.json({
      success: true,
      taskId,
      roomId,
      result,
    });
  } catch (error) {
    console.error("[StopVoiceChat] Error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: String(error) },
      { status: 500 }
    );
  }
}
