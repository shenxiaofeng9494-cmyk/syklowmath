/**
 * ASR Proxy API Route
 *
 * Since browser WebSocket cannot set custom HTTP headers required by Doubao ASR,
 * this route acts as a proxy:
 * 1. Client sends audio via POST requests
 * 2. Server maintains WebSocket connection to Doubao ASR with proper auth headers
 * 3. Server returns transcription results
 *
 * Protocol: Doubao BigModel Streaming ASR
 * URL: wss://openspeech.bytedance.com/api/v3/sauc/bigmodel
 */

import { NextRequest, NextResponse } from "next/server";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const WebSocket = require("ws");

// Type for WebSocket instance
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type WebSocketInstance = any;

// Doubao ASR WebSocket URL (双向流式模式)
const ASR_WEBSOCKET_URL = "wss://openspeech.bytedance.com/api/v3/sauc/bigmodel";

// Store active sessions (in production, use Redis or similar)
const sessions = new Map<string, {
  ws: WebSocketInstance;
  results: Array<{ text: string; definite: boolean }>;
  error: string | null;
  closed: boolean;
}>();

// Protocol constants
const PROTOCOL = {
  VERSION: 0b0001,
  HEADER_SIZE: 0b0001,
  MSG_FULL_CLIENT_REQUEST: 0b0001,
  MSG_AUDIO_ONLY_REQUEST: 0b0010,
  MSG_FULL_SERVER_RESPONSE: 0b1001,
  MSG_SERVER_ERROR: 0b1111,
  FLAG_NONE: 0b0000,
  FLAG_LAST_PACKET: 0b0010,
  SERIAL_NONE: 0b0000,
  SERIAL_JSON: 0b0001,
  COMPRESS_NONE: 0b0000,
};

function encodeHeader(
  messageType: number,
  flags: number,
  serial: number,
  compress: number
): Buffer {
  const header = Buffer.alloc(4);
  header[0] = ((PROTOCOL.VERSION & 0x0f) << 4) | (PROTOCOL.HEADER_SIZE & 0x0f);
  header[1] = ((messageType & 0x0f) << 4) | (flags & 0x0f);
  header[2] = ((serial & 0x0f) << 4) | (compress & 0x0f);
  header[3] = 0; // reserved
  return header;
}

function buildFullClientRequest(payload: object): Buffer {
  const jsonStr = JSON.stringify(payload);
  const payloadBytes = Buffer.from(jsonStr, "utf-8");

  const header = encodeHeader(
    PROTOCOL.MSG_FULL_CLIENT_REQUEST,
    PROTOCOL.FLAG_NONE,
    PROTOCOL.SERIAL_JSON,
    PROTOCOL.COMPRESS_NONE
  );

  const frame = Buffer.alloc(4 + 4 + payloadBytes.length);
  header.copy(frame, 0);
  frame.writeUInt32BE(payloadBytes.length, 4);
  payloadBytes.copy(frame, 8);

  return frame;
}

function buildAudioFrame(audioData: Buffer, isLast: boolean): Buffer {
  const header = encodeHeader(
    PROTOCOL.MSG_AUDIO_ONLY_REQUEST,
    isLast ? PROTOCOL.FLAG_LAST_PACKET : PROTOCOL.FLAG_NONE,
    PROTOCOL.SERIAL_NONE,
    PROTOCOL.COMPRESS_NONE
  );

  const frame = Buffer.alloc(4 + 4 + audioData.length);
  header.copy(frame, 0);
  frame.writeUInt32BE(audioData.length, 4);
  audioData.copy(frame, 8);

  return frame;
}

function parseServerResponse(data: Buffer): {
  messageType: number;
  payload: Record<string, unknown> | null;
} {
  if (data.length < 8) {
    throw new Error("Invalid frame: too short");
  }

  const messageType = (data[1] >> 4) & 0x0f;
  const flags = data[1] & 0x0f;
  const serial = (data[2] >> 4) & 0x0f;

  // Check if there's a sequence number (when flags has bit 0 set)
  const hasSequence = (flags & 0x01) !== 0;
  const payloadSizeOffset = hasSequence ? 8 : 4;

  if (data.length < payloadSizeOffset + 4) {
    throw new Error("Invalid frame: missing payload size");
  }

  const payloadSize = data.readUInt32BE(payloadSizeOffset);
  const payloadOffset = payloadSizeOffset + 4;

  let payload: Record<string, unknown> | null = null;

  if (payloadSize > 0 && data.length >= payloadOffset + payloadSize) {
    const payloadBytes = data.slice(payloadOffset, payloadOffset + payloadSize);

    if (serial === PROTOCOL.SERIAL_JSON) {
      try {
        payload = JSON.parse(payloadBytes.toString("utf-8"));
      } catch (e) {
        console.error("Failed to parse JSON payload:", e);
      }
    }
  }

  return { messageType, payload };
}

function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// POST /api/voice/asr - Create session or send audio
export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") || "";

    // Check for JSON (session management) vs binary (audio data)
    if (contentType.includes("application/json")) {
      const body = await req.json();
      const { action, sessionId, audioBase64 } = body;

      if (action === "create") {
        return await createSession();
      } else if (action === "audio" && sessionId && audioBase64) {
        return await sendAudio(sessionId, audioBase64, false);
      } else if (action === "end" && sessionId) {
        return await sendAudio(sessionId, "", true);
      } else if (action === "results" && sessionId) {
        return getResults(sessionId);
      } else if (action === "close" && sessionId) {
        return closeSession(sessionId);
      }

      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    return NextResponse.json({ error: "Invalid content type" }, { status: 400 });
  } catch (error) {
    console.error("ASR API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}

async function createSession(): Promise<NextResponse> {
  const appId = process.env.DOUBAO_APP_ID;
  const accessKey = process.env.DOUBAO_ACCESS_KEY;
  const resourceId = process.env.DOUBAO_ASR_RESOURCE_ID || "volc.bigasr.sauc.duration";

  if (!appId || !accessKey) {
    return NextResponse.json(
      { error: "DOUBAO_APP_ID or DOUBAO_ACCESS_KEY not configured" },
      { status: 500 }
    );
  }

  const sessionId = generateUUID();
  const connectId = generateUUID();

  return new Promise((resolve) => {
    const ws = new WebSocket(ASR_WEBSOCKET_URL, {
      headers: {
        "X-Api-App-Key": appId,
        "X-Api-Access-Key": accessKey,
        "X-Api-Resource-Id": resourceId,
        "X-Api-Connect-Id": connectId,
      },
    });

    const session = {
      ws,
      results: [] as Array<{ text: string; definite: boolean }>,
      error: null as string | null,
      closed: false,
    };

    const timeout = setTimeout(() => {
      ws.close();
      resolve(NextResponse.json(
        { error: "Connection timeout" },
        { status: 504 }
      ));
    }, 10000);

    ws.on("open", () => {
      clearTimeout(timeout);
      console.log(`ASR session ${sessionId} connected`);

      // Send Full Client Request
      const payload = {
        user: {
          uid: sessionId,
        },
        audio: {
          format: "pcm",
          rate: 16000,
          bits: 16,
          channel: 1,
        },
        request: {
          model_name: "bigmodel",
          enable_itn: true,
          enable_punc: true,
          result_type: "single",
          show_utterances: true,
        },
      };

      const frame = buildFullClientRequest(payload);
      ws.send(frame);

      sessions.set(sessionId, session);

      resolve(NextResponse.json({ sessionId, status: "connected" }));
    });

    ws.on("message", (data: Buffer) => {
      try {
        const { messageType, payload } = parseServerResponse(data);

        if (messageType === PROTOCOL.MSG_SERVER_ERROR) {
          console.error(`ASR session ${sessionId} server error:`, payload);
          session.error = JSON.stringify(payload);
          return;
        }

        if (messageType === PROTOCOL.MSG_FULL_SERVER_RESPONSE && payload) {
          const result = payload.result as { text?: string; utterances?: Array<{ text: string; definite: boolean }> } | undefined;

          if (result?.utterances) {
            for (const utterance of result.utterances) {
              session.results.push({
                text: utterance.text,
                definite: utterance.definite,
              });
            }
          } else if (result?.text) {
            session.results.push({
              text: result.text,
              definite: true,
            });
          }
        }
      } catch (e) {
        console.error(`ASR session ${sessionId} parse error:`, e);
      }
    });

    ws.on("error", (error: Error) => {
      clearTimeout(timeout);
      console.error(`ASR session ${sessionId} error:`, error);
      session.error = error.message;
      session.closed = true;
    });

    ws.on("close", (code: number, reason: Buffer) => {
      console.log(`ASR session ${sessionId} closed:`, code, reason.toString());
      session.closed = true;

      // Clean up session after 30 seconds
      setTimeout(() => {
        sessions.delete(sessionId);
      }, 30000);
    });
  });
}

async function sendAudio(
  sessionId: string,
  audioBase64: string,
  isLast: boolean
): Promise<NextResponse> {
  const session = sessions.get(sessionId);

  if (!session) {
    return NextResponse.json(
      { error: "Session not found" },
      { status: 404 }
    );
  }

  if (session.closed) {
    return NextResponse.json(
      { error: "Session closed" },
      { status: 410 }
    );
  }

  if (session.ws.readyState !== WebSocket.OPEN) {
    return NextResponse.json(
      { error: "WebSocket not connected" },
      { status: 503 }
    );
  }

  const audioData = audioBase64 ? Buffer.from(audioBase64, "base64") : Buffer.alloc(0);
  const frame = buildAudioFrame(audioData, isLast);

  session.ws.send(frame);

  return NextResponse.json({ status: "sent", isLast });
}

function getResults(sessionId: string): NextResponse {
  const session = sessions.get(sessionId);

  if (!session) {
    return NextResponse.json(
      { error: "Session not found" },
      { status: 404 }
    );
  }

  // Return and clear results
  const results = [...session.results];
  session.results = [];

  return NextResponse.json({
    results,
    error: session.error,
    closed: session.closed,
  });
}

function closeSession(sessionId: string): NextResponse {
  const session = sessions.get(sessionId);

  if (session) {
    if (session.ws.readyState === WebSocket.OPEN) {
      // Send end frame before closing
      const frame = buildAudioFrame(Buffer.alloc(0), true);
      session.ws.send(frame);
      session.ws.close();
    }
    sessions.delete(sessionId);
  }

  return NextResponse.json({ status: "closed" });
}
