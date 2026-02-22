/**
 * TTS Proxy API Route
 *
 * Since browser WebSocket cannot set custom HTTP headers required by Doubao TTS,
 * this route acts as a proxy:
 * 1. Client creates session via POST
 * 2. Server maintains WebSocket connection to Doubao TTS with proper auth headers
 * 3. Client sends text via POST, server returns audio
 *
 * Protocol: Doubao Bidirectional TTS
 * URL: wss://openspeech.bytedance.com/api/v3/tts/bidirection
 */

import { NextRequest, NextResponse } from "next/server";
import { EventEmitter } from "events";
import { sessions } from "./sessions";
import type { TTSSession } from "./sessions";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const WebSocket = require("ws");

// Doubao TTS WebSocket URL
const TTS_WEBSOCKET_URL = "wss://openspeech.bytedance.com/api/v3/tts/bidirection";

// Event codes per documentation
const TTS_EVENT = {
  // Upstream
  START_CONNECTION: 1,
  FINISH_CONNECTION: 2,
  START_SESSION: 100,
  CANCEL_SESSION: 101,
  FINISH_SESSION: 102,
  TASK_REQUEST: 200,

  // Downstream
  CONNECTION_STARTED: 50,
  CONNECTION_FAILED: 51,
  CONNECTION_FINISHED: 52,
  SESSION_STARTED: 150,
  SESSION_CANCELLED: 151,
  SESSION_FINISHED: 152,
  SESSION_FAILED: 153,
  TTS_SENTENCE_START: 350,
  TTS_SENTENCE_END: 351,
  TTS_RESPONSE: 352,
};

// Protocol constants
const PROTOCOL = {
  VERSION: 0b0001,
  HEADER_SIZE: 0b0001,
  MSG_FULL_CLIENT_REQUEST: 0b0001,
  MSG_FULL_SERVER_RESPONSE: 0b1001,
  MSG_AUDIO_ONLY_RESPONSE: 0b1011,
  MSG_ERROR: 0b1111,
  FLAG_WITH_EVENT: 0b0100,
  SERIAL_NONE: 0b0000,
  SERIAL_JSON: 0b0001,
  COMPRESS_NONE: 0b0000,
};

function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Build a TTS frame with event number
 * Format: [header 4B] + [event 4B] + [session_id_len 4B]? + [session_id]? + [payload_len 4B] + [payload]
 */
function buildTTSFrame(event: number, sessionId: string | null, payload: object): Buffer {
  const payloadJson = JSON.stringify(payload);
  const payloadBytes = Buffer.from(payloadJson, "utf-8");

  // Calculate total size
  let totalSize = 4 + 4 + 4 + payloadBytes.length; // header + event + payload_len + payload
  if (sessionId) {
    totalSize += 4 + sessionId.length; // session_id_len + session_id
  }

  const frame = Buffer.alloc(totalSize);
  let offset = 0;

  // Header (4 bytes)
  frame[0] = ((PROTOCOL.VERSION & 0x0f) << 4) | (PROTOCOL.HEADER_SIZE & 0x0f);
  frame[1] = ((PROTOCOL.MSG_FULL_CLIENT_REQUEST & 0x0f) << 4) | (PROTOCOL.FLAG_WITH_EVENT & 0x0f);
  frame[2] = ((PROTOCOL.SERIAL_JSON & 0x0f) << 4) | (PROTOCOL.COMPRESS_NONE & 0x0f);
  frame[3] = 0;
  offset += 4;

  // Event number (4 bytes, big-endian)
  frame.writeInt32BE(event, offset);
  offset += 4;

  // Session ID (if provided)
  if (sessionId) {
    frame.writeUInt32BE(sessionId.length, offset);
    offset += 4;
    frame.write(sessionId, offset, "utf-8");
    offset += sessionId.length;
  }

  // Payload length and payload
  frame.writeUInt32BE(payloadBytes.length, offset);
  offset += 4;
  payloadBytes.copy(frame, offset);

  return frame;
}

/**
 * Parse a TTS response frame
 */
function parseTTSFrame(data: Buffer): {
  event: number;
  sessionId: string | null;
  connectionId: string | null;
  payload: Record<string, unknown> | null;
  audioData: Buffer | null;
  isError: boolean;
} {
  if (data.length < 8) {
    throw new Error("Invalid TTS frame: too short");
  }

  const messageType = (data[1] >> 4) & 0x0f;
  const flags = data[1] & 0x0f;
  const serial = (data[2] >> 4) & 0x0f;

  const isError = messageType === PROTOCOL.MSG_ERROR;
  const hasEvent = (flags & 0x04) !== 0;

  let offset = 4;
  let event = 0;
  let sessionId: string | null = null;
  let connectionId: string | null = null;
  let payload: Record<string, unknown> | null = null;
  let audioData: Buffer | null = null;

  // Read event number if present
  if (hasEvent && data.length >= offset + 4) {
    event = data.readInt32BE(offset);
    offset += 4;
  }

  // For error frames, read error code
  if (isError && data.length >= offset + 4) {
    const errorCode = data.readUInt32BE(offset);
    offset += 4;
    // Read payload
    if (data.length >= offset + 4) {
      const payloadLen = data.readUInt32BE(offset);
      offset += 4;
      if (payloadLen > 0 && data.length >= offset + payloadLen) {
        const payloadBytes = data.slice(offset, offset + payloadLen);
        try {
          payload = JSON.parse(payloadBytes.toString("utf-8"));
          if (payload) {
            payload.error_code = errorCode;
          }
        } catch {
          payload = { error_code: errorCode, message: "Unknown error" };
        }
      }
    }
    return { event, sessionId, connectionId, payload, audioData, isError: true };
  }

  // For connection events, read connection_id
  if (event === TTS_EVENT.CONNECTION_STARTED || event === TTS_EVENT.CONNECTION_FAILED) {
    if (data.length >= offset + 4) {
      const connIdLen = data.readUInt32BE(offset);
      offset += 4;
      if (connIdLen > 0 && data.length >= offset + connIdLen) {
        connectionId = data.slice(offset, offset + connIdLen).toString("utf-8");
        offset += connIdLen;
      }
    }
  }

  // For session events, read session_id
  // This includes SESSION_STARTED (150), SESSION_FINISHED (152), etc.
  // AND TTS events (350-352) which also have session_id
  if ((event >= 150 && event < 200) || (event >= 350 && event < 400)) {
    if (data.length >= offset + 4) {
      const sessIdLen = data.readUInt32BE(offset);
      offset += 4;
      if (sessIdLen > 0 && data.length >= offset + sessIdLen) {
        sessionId = data.slice(offset, offset + sessIdLen).toString("utf-8");
        offset += sessIdLen;
      }
    }
  }

  // Read payload length and data
  if (data.length >= offset + 4) {
    const payloadLen = data.readUInt32BE(offset);
    offset += 4;

    if (payloadLen > 0 && data.length >= offset + payloadLen) {
      const payloadBytes = data.slice(offset, offset + payloadLen);

      if (serial === PROTOCOL.SERIAL_JSON) {
        try {
          payload = JSON.parse(payloadBytes.toString("utf-8"));
        } catch {
          console.error("Failed to parse TTS JSON payload");
        }
      } else if (serial === PROTOCOL.SERIAL_NONE) {
        // Raw audio data
        audioData = payloadBytes;
      }
    }
  }

  return { event, sessionId, connectionId, payload, audioData, isError };
}

// POST /api/voice/tts
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, sessionId, text } = body;

    if (action === "create") {
      return await createSession();
    } else if (action === "speak" && sessionId && text) {
      return await speakText(sessionId, text);
    } else if (action === "audio" && sessionId) {
      return getAudio(sessionId);
    } else if (action === "cancel" && sessionId) {
      return cancelSession(sessionId);
    } else if (action === "close" && sessionId) {
      return closeSession(sessionId);
    } else if (action === "close-all") {
      return closeAllSessions();
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("TTS API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}

async function createSession(): Promise<NextResponse> {
  const appId = process.env.DOUBAO_APP_ID;
  const accessKey = process.env.DOUBAO_ACCESS_KEY;
  const resourceId = process.env.DOUBAO_TTS_RESOURCE_ID || "seed-tts-2.0";

  if (!appId || !accessKey) {
    return NextResponse.json(
      { error: "DOUBAO_APP_ID or DOUBAO_ACCESS_KEY not configured" },
      { status: 500 }
    );
  }

  const clientSessionId = generateUUID();
  const connectId = generateUUID();

  return new Promise((resolve) => {
    const ws = new WebSocket(TTS_WEBSOCKET_URL, {
      headers: {
        "X-Api-App-Key": appId,
        "X-Api-Access-Key": accessKey,
        "X-Api-Resource-Id": resourceId,
        "X-Api-Connect-Id": connectId,
      },
    });

    const session: TTSSession = {
      ws,
      connectionId: connectId,
      sessionId: null,
      audioChunks: [],
      isConnectionStarted: false,
      isSessionStarted: false,
      error: null,
      closed: false,
      emitter: new EventEmitter(),
    };

    const timeout = setTimeout(() => {
      ws.close();
      resolve(NextResponse.json({ error: "Connection timeout" }, { status: 504 }));
    }, 10000);

    ws.on("open", () => {
      console.log(`TTS session ${clientSessionId} WebSocket connected`);

      // Send StartConnection
      const frame = buildTTSFrame(TTS_EVENT.START_CONNECTION, null, {});
      ws.send(frame);
    });

    ws.on("message", (data: Buffer) => {
      try {
        const parsed = parseTTSFrame(data);
        console.log("TTS event received:", parsed.event);

        if (parsed.isError) {
          console.error("TTS error:", parsed.payload);
          session.error = JSON.stringify(parsed.payload);
          session.emitter.emit("error", JSON.stringify(parsed.payload));
          return;
        }

        switch (parsed.event) {
          case TTS_EVENT.CONNECTION_STARTED:
            clearTimeout(timeout);
            console.log(`TTS connection started: ${parsed.connectionId}`);
            session.isConnectionStarted = true;
            if (parsed.connectionId) {
              session.connectionId = parsed.connectionId;
            }
            sessions.set(clientSessionId, session);
            resolve(NextResponse.json({
              sessionId: clientSessionId,
              status: "connected",
            }));
            break;

          case TTS_EVENT.CONNECTION_FAILED:
            clearTimeout(timeout);
            console.error("TTS connection failed:", parsed.payload);
            session.error = JSON.stringify(parsed.payload);
            resolve(NextResponse.json(
              { error: "Connection failed", details: parsed.payload },
              { status: 500 }
            ));
            break;

          case TTS_EVENT.SESSION_STARTED:
            console.log("TTS session started");
            session.isSessionStarted = true;
            session.emitter.emit("sessionStarted");
            break;

          case TTS_EVENT.SESSION_FINISHED:
            console.log("TTS session finished");
            session.isSessionStarted = false;
            session.sessionId = null;
            session.emitter.emit("sessionFinished");
            break;

          case TTS_EVENT.SESSION_CANCELLED:
            console.log("TTS session cancelled");
            session.isSessionStarted = false;
            session.sessionId = null;
            session.emitter.emit("sessionFinished");
            break;

          case TTS_EVENT.SESSION_FAILED:
            console.error("TTS session failed:", parsed.payload);
            session.error = JSON.stringify(parsed.payload);
            session.isSessionStarted = false;
            session.emitter.emit("error", JSON.stringify(parsed.payload));
            break;

          case TTS_EVENT.TTS_RESPONSE:
            // Audio data — push to buffer AND emit for SSE listeners
            if (parsed.audioData) {
              console.log(`TTS audio chunk received: ${parsed.audioData.length} bytes`);
              session.audioChunks.push(parsed.audioData);
              session.emitter.emit("audio", parsed.audioData);
            } else {
              console.log("TTS_RESPONSE but no audioData, payload:", parsed.payload);
            }
            break;

          case TTS_EVENT.TTS_SENTENCE_START:
          case TTS_EVENT.TTS_SENTENCE_END:
            // Sentence markers - ignore for now
            break;

          default:
            console.log("TTS unknown event:", parsed.event);
        }
      } catch (e) {
        console.error("Failed to parse TTS response:", e);
      }
    });

    ws.on("error", (error: Error) => {
      clearTimeout(timeout);
      console.error(`TTS session ${clientSessionId} error:`, error);
      session.error = error.message;
      session.closed = true;
      session.emitter.emit("error", error.message);
    });

    ws.on("close", (code: number, reason: Buffer) => {
      console.log(`TTS session ${clientSessionId} closed:`, code, reason.toString());
      session.closed = true;
      session.emitter.emit("closed");

      // Clean up after 30 seconds
      setTimeout(() => {
        session.emitter.removeAllListeners();
        sessions.delete(clientSessionId);
      }, 30000);
    });
  });
}

async function speakText(clientSessionId: string, text: string): Promise<NextResponse> {
  const session = sessions.get(clientSessionId);

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  if (session.closed) {
    return NextResponse.json({ error: "Session closed" }, { status: 410 });
  }

  if (!session.isConnectionStarted) {
    return NextResponse.json({ error: "Connection not started" }, { status: 503 });
  }

  // Wait for previous session to finish (max 5 seconds)
  if (session.isSessionStarted) {
    console.log("Waiting for previous TTS session to finish...");
    const maxWait = 5000;
    const startTime = Date.now();
    while (session.isSessionStarted && Date.now() - startTime < maxWait) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    if (session.isSessionStarted) {
      console.warn("Previous TTS session did not finish in time, proceeding anyway");
    }
  }

  const voice = process.env.DOUBAO_TTS_VOICE || "zh_female_xiaohe_uranus_bigtts";
  const speechRate = parseInt(process.env.DOUBAO_TTS_SPEECH_RATE || "-20", 10); // -50 to 100, -20 is ~0.8x speed

  // Generate new session ID for this speak request
  const ttsSessionId = generateUUID();
  session.sessionId = ttsSessionId;
  session.audioChunks = []; // Clear previous audio

  // Send StartSession
  const startSessionPayload = {
    user: { uid: clientSessionId },
    event: TTS_EVENT.START_SESSION,
    req_params: {
      speaker: voice,
      audio_params: {
        format: "pcm",
        sample_rate: 24000,
        speech_rate: speechRate,
      },
    },
  };

  const startSessionFrame = buildTTSFrame(
    TTS_EVENT.START_SESSION,
    ttsSessionId,
    startSessionPayload
  );
  session.ws.send(startSessionFrame);

  // Send TaskRequest with text (no delay - StartSession/TaskRequest/FinishSession sent back-to-back)
  const taskPayload = {
    event: TTS_EVENT.TASK_REQUEST,
    req_params: {
      text,
    },
  };

  const taskFrame = buildTTSFrame(TTS_EVENT.TASK_REQUEST, ttsSessionId, taskPayload);
  session.ws.send(taskFrame);

  // Send FinishSession
  const finishFrame = buildTTSFrame(TTS_EVENT.FINISH_SESSION, ttsSessionId, {});
  session.ws.send(finishFrame);

  return NextResponse.json({ status: "speaking", ttsSessionId });
}

function getAudio(clientSessionId: string): NextResponse {
  const session = sessions.get(clientSessionId);

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  // Return and clear audio chunks
  const chunks = [...session.audioChunks];
  session.audioChunks = [];

  // Convert to base64
  const audioBase64 = chunks.map((chunk) => {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    return buffer.toString("base64");
  });

  return NextResponse.json({
    audio: audioBase64,
    error: session.error,
    closed: session.closed,
    isSessionStarted: session.isSessionStarted,
  });
}

function cancelSession(clientSessionId: string): NextResponse {
  const session = sessions.get(clientSessionId);

  if (session && session.sessionId && session.isSessionStarted) {
    const cancelFrame = buildTTSFrame(TTS_EVENT.CANCEL_SESSION, session.sessionId, {});
    session.ws.send(cancelFrame);
    session.audioChunks = [];
  }

  return NextResponse.json({ status: "cancelled" });
}

function closeSession(clientSessionId: string): NextResponse {
  const session = sessions.get(clientSessionId);

  if (session) {
    // Send FinishConnection
    if (session.ws.readyState === WebSocket.OPEN) {
      const frame = buildTTSFrame(TTS_EVENT.FINISH_CONNECTION, null, {});
      session.ws.send(frame);
      session.ws.close();
    }
    sessions.delete(clientSessionId);
  }

  return NextResponse.json({ status: "closed" });
}

function closeAllSessions(): NextResponse {
  let closedCount = 0;

  for (const [clientSessionId, session] of sessions.entries()) {
    try {
      if (session.ws.readyState === WebSocket.OPEN) {
        const frame = buildTTSFrame(TTS_EVENT.FINISH_CONNECTION, null, {});
        session.ws.send(frame);
        session.ws.close();
      }
      sessions.delete(clientSessionId);
      closedCount++;
    } catch (e) {
      console.error(`Failed to close TTS session ${clientSessionId}:`, e);
    }
  }

  console.log(`Closed ${closedCount} TTS sessions`);
  return NextResponse.json({ status: "closed", count: closedCount });
}
