/**
 * RTC Token Generation API
 *
 * Generates RTC authentication tokens for Volcengine AI Audio/Video Interaction
 * Reference: https://www.volcengine.com/docs/6348/70121
 */

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

// Token validity period (24 hours in seconds)
const TOKEN_EXPIRE_TIME = 24 * 60 * 60;

interface TokenRequest {
  roomId: string;
  userId: string;
}

interface TokenResponse {
  token: string;
  appId: string;
  roomId: string;
  userId: string;
  expireTime: number;
}

/**
 * Generate RTC Token using HMAC-SHA256
 * Based on Volcengine RTC Token generation algorithm
 */
function generateRTCToken(
  appId: string,
  appKey: string,
  roomId: string,
  userId: string,
  expireTime: number
): string {
  const currentTime = Math.floor(Date.now() / 1000);
  const expire = currentTime + expireTime;

  // Build token payload
  const payload = {
    version: "001",
    appId,
    roomId,
    userId,
    expire,
    permissions: {
      publish: true,
      subscribe: true,
    },
  };

  const payloadStr = JSON.stringify(payload);
  const payloadBase64 = Buffer.from(payloadStr).toString("base64url");

  // Generate signature
  const signature = crypto
    .createHmac("sha256", appKey)
    .update(payloadBase64)
    .digest("base64url");

  // Combine token
  return `${payloadBase64}.${signature}`;
}

export async function POST(request: NextRequest) {
  try {
    const body: TokenRequest = await request.json();
    const { roomId, userId } = body;

    if (!roomId || !userId) {
      return NextResponse.json(
        { error: "roomId and userId are required" },
        { status: 400 }
      );
    }

    const appId = process.env.VOLCENGINE_RTC_APP_ID;
    const appKey = process.env.VOLCENGINE_RTC_APP_KEY;

    if (!appId || !appKey) {
      console.error("Missing VOLCENGINE_RTC_APP_ID or VOLCENGINE_RTC_APP_KEY");
      return NextResponse.json(
        { error: "RTC credentials not configured" },
        { status: 500 }
      );
    }

    const token = generateRTCToken(
      appId,
      appKey,
      roomId,
      userId,
      TOKEN_EXPIRE_TIME
    );

    const response: TokenResponse = {
      token,
      appId,
      roomId,
      userId,
      expireTime: TOKEN_EXPIRE_TIME,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error generating RTC token:", error);
    return NextResponse.json(
      { error: "Failed to generate token" },
      { status: 500 }
    );
  }
}
