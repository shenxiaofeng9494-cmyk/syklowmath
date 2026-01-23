/**
 * Doubao Realtime (S2S) Proxy API Route
 *
 * Browser WebSocket cannot set required auth headers, so this route maintains
 * a server-side WebSocket and exposes a polling-based HTTP API.
 */

import { NextRequest, NextResponse } from "next/server";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const WebSocket = require("ws") as typeof import("ws");

// Type for WebSocket instance
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type WebSocketInstance = InstanceType<typeof WebSocket>;

const REALTIME_WEBSOCKET_URL = "wss://openspeech.bytedance.com/api/v3/realtime/dialogue";
const REALTIME_RESOURCE_ID = "volc.speech.dialog";

const PROTOCOL = {
  VERSION: 0b0001,
  HEADER_SIZE: 0b0001,
  MSG_FULL_CLIENT_REQUEST: 0b0001,
  MSG_AUDIO_ONLY_REQUEST: 0b0010,
  MSG_FULL_SERVER_RESPONSE: 0b1001,
  MSG_AUDIO_ONLY_RESPONSE: 0b1011,
  MSG_SERVER_ERROR: 0b1111,
  FLAG_EVENT: 0b0100,
  FLAG_SEQ_MASK: 0b0011,
  SERIAL_NONE: 0b0000,
  SERIAL_JSON: 0b0001,
  COMPRESS_NONE: 0b0000,
} as const;

const EVENTS = {
  // Client
  START_CONNECTION: 1,
  FINISH_CONNECTION: 2,
  START_SESSION: 100,
  FINISH_SESSION: 102,
  TASK_REQUEST: 200,
  CHAT_TEXT_QUERY: 501,
  FUNCTION_CALL_RESULT: 502,  // Client sends function call result

  // Server
  CONNECTION_STARTED: 50,
  CONNECTION_FAILED: 51,
  CONNECTION_FINISHED: 52,
  SESSION_STARTED: 150,
  SESSION_FAILED: 153,
  SESSION_FINISHED: 152,
  ASR_INFO: 450,
  ASR_RESPONSE: 451,
  ASR_ENDED: 459,
  CHAT_RESPONSE: 550,
  CHAT_ENDED: 559,
  FUNCTION_CALL: 551,  // Server requests function call
  TTS_RESPONSE: 352,
  TTS_ENDED: 359,
} as const;

const CONNECT_EVENT_IDS = new Set<number>([
  EVENTS.START_CONNECTION,
  EVENTS.FINISH_CONNECTION,
  EVENTS.CONNECTION_STARTED,
  EVENTS.CONNECTION_FAILED,
  EVENTS.CONNECTION_FINISHED,
]);

function isSessionEvent(eventId?: number): boolean {
  return typeof eventId === "number" && eventId >= 100;
}

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
  header[3] = 0;
  return header;
}

function writeUInt32BE(value: number): Buffer {
  const buf = Buffer.alloc(4);
  buf.writeUInt32BE(value, 0);
  return buf;
}

function buildFrame(options: {
  messageType: number;
  flags: number;
  serial: number;
  eventId?: number;
  sessionId?: string;
  connectId?: string;
  payload?: Buffer;
}): Buffer {
  const header = encodeHeader(
    options.messageType,
    options.flags,
    options.serial,
    PROTOCOL.COMPRESS_NONE
  );

  const parts: Buffer[] = [header];

  // Optional sequence is not used in this proxy.

  if (options.flags & PROTOCOL.FLAG_EVENT) {
    parts.push(writeUInt32BE(options.eventId ?? 0));
  }

  if (options.connectId && CONNECT_EVENT_IDS.has(options.eventId ?? -1)) {
    const connectBytes = Buffer.from(options.connectId, "utf-8");
    parts.push(writeUInt32BE(connectBytes.length));
    parts.push(connectBytes);
  }

  if (options.sessionId && isSessionEvent(options.eventId)) {
    const sessionBytes = Buffer.from(options.sessionId, "utf-8");
    parts.push(writeUInt32BE(sessionBytes.length));
    parts.push(sessionBytes);
  }

  const payload = options.payload ?? Buffer.alloc(0);
  parts.push(writeUInt32BE(payload.length));
  if (payload.length > 0) {
    parts.push(payload);
  }

  return Buffer.concat(parts);
}

function buildJsonPayload(payload: object): Buffer {
  return Buffer.from(JSON.stringify(payload), "utf-8");
}

function decodeHeader(data: Buffer) {
  return {
    version: (data[0] >> 4) & 0x0f,
    headerSize: data[0] & 0x0f,
    messageType: (data[1] >> 4) & 0x0f,
    flags: data[1] & 0x0f,
    serial: (data[2] >> 4) & 0x0f,
    compress: data[2] & 0x0f,
    reserved: data[3],
  };
}

function parseFrame(data: Buffer): {
  header: ReturnType<typeof decodeHeader>;
  eventId?: number;
  sessionId?: string;
  payloadJson?: Record<string, unknown>;
  audioData?: Buffer;
  errorCode?: number;
} {
  if (data.length < 8) {
    throw new Error("Invalid frame: too short");
  }

  const header = decodeHeader(data);
  let offset = 4;

  let errorCode: number | undefined;
  if (header.messageType === PROTOCOL.MSG_SERVER_ERROR && data.length >= offset + 4) {
    errorCode = data.readUInt32BE(offset);
    offset += 4;
  }

  const seqFlag = header.flags & PROTOCOL.FLAG_SEQ_MASK;
  if (seqFlag === 0b0001 || seqFlag === 0b0011) {
    if (data.length >= offset + 4) {
      offset += 4;
    }
  }

  let eventId: number | undefined;
  if (header.flags & PROTOCOL.FLAG_EVENT) {
    if (data.length < offset + 4) {
      throw new Error("Invalid frame: missing event id");
    }
    eventId = data.readUInt32BE(offset);
    offset += 4;
  }

  let sessionId: string | undefined;

  if (eventId && CONNECT_EVENT_IDS.has(eventId)) {
    if (data.length >= offset + 4) {
      const connectSize = data.readUInt32BE(offset);
      offset += 4 + connectSize;
    }
  }

  if (eventId && isSessionEvent(eventId)) {
    if (data.length >= offset + 4) {
      const sessionSize = data.readUInt32BE(offset);
      offset += 4;
      if (data.length >= offset + sessionSize) {
        sessionId = data.slice(offset, offset + sessionSize).toString("utf-8");
        offset += sessionSize;
      }
    }
  }

  if (data.length < offset + 4) {
    throw new Error("Invalid frame: missing payload size");
  }

  const payloadSize = data.readUInt32BE(offset);
  offset += 4;

  const payloadBuffer = payloadSize > 0 && data.length >= offset + payloadSize
    ? data.slice(offset, offset + payloadSize)
    : Buffer.alloc(0);

  let payloadJson: Record<string, unknown> | undefined;
  let audioData: Buffer | undefined;

  if (payloadBuffer.length > 0) {
    if (header.serial === PROTOCOL.SERIAL_JSON) {
      try {
        payloadJson = JSON.parse(payloadBuffer.toString("utf-8"));
      } catch (e) {
        console.error("Failed to parse realtime JSON payload:", e);
      }
    } else if (header.serial === PROTOCOL.SERIAL_NONE) {
      audioData = payloadBuffer;
    }
  }

  return { header, eventId, sessionId, payloadJson, audioData, errorCode };
}

function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

const MAX_QUEUE = 200;

type QueuedEvent = {
  eventId: number;
  payload?: Record<string, unknown>;
  audioBase64?: string;
};

const sessions = new Map<string, {
  ws: WebSocketInstance;
  events: QueuedEvent[];
  error: string | null;
  closed: boolean;
  dialogId?: string;
}>();

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body as { action?: string };

    if (action === "create") {
      return await createSession(body as {
        systemPrompt?: string;
        model?: string;
        speaker?: string;
        botName?: string;
        speakingStyle?: string;
        characterManifest?: string;
        tools?: Tool[];
      });
    }

    const sessionId = body.sessionId as string | undefined;
    if (!sessionId) {
      return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
    }

    if (action === "audio") {
      return await sendAudio(sessionId, body.audioBase64 as string | undefined);
    }

    if (action === "text") {
      return await sendText(sessionId, body.text as string | undefined);
    }

    if (action === "function_result") {
      return await sendFunctionResult(
        sessionId,
        body.callId as string | undefined,
        body.result as string | undefined
      );
    }

    if (action === "finish") {
      return await finishSession(sessionId);
    }

    if (action === "events") {
      return getEvents(sessionId);
    }

    if (action === "close") {
      return closeSession(sessionId);
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Doubao realtime API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}

interface ToolFunction {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

interface Tool {
  type: "function";
  function: ToolFunction;
}

async function createSession(config: {
  systemPrompt?: string;
  model?: string;
  speaker?: string;
  botName?: string;
  speakingStyle?: string;
  characterManifest?: string;
  tools?: Tool[];
}): Promise<NextResponse> {
  // Use same credentials as TTS (DOUBAO_APP_ID and DOUBAO_ACCESS_KEY)
  const appId = process.env.DOUBAO_APP_ID;
  const accessKey = process.env.DOUBAO_ACCESS_KEY;

  if (!appId || !accessKey) {
    return NextResponse.json(
      { error: "DOUBAO_APP_ID or DOUBAO_ACCESS_KEY not configured" },
      { status: 500 }
    );
  }

  const sessionId = generateUUID();
  const connectId = generateUUID();

  const model = config.model || process.env.DOUBAO_REALTIME_MODEL || "O";
  const speaker = config.speaker || process.env.DOUBAO_REALTIME_SPEAKER || "zh_female_vv_jupiter_bigtts";
  const botName = config.botName || "豆包老师";
  const speakingStyle = config.speakingStyle || "耐心、清晰、简洁，适合中学生";
  const systemPrompt = config.systemPrompt || "你是耐心的数学老师，帮助学生理解概念。";
  const characterManifest = config.characterManifest || process.env.DOUBAO_REALTIME_CHARACTER_MANIFEST;

  return new Promise((resolve) => {
    console.log(`Creating Realtime session with appId=${appId}, resourceId=${REALTIME_RESOURCE_ID}`);
    const ws = new WebSocket(REALTIME_WEBSOCKET_URL, {
      headers: {
        "X-Api-App-ID": appId,
        "X-Api-Access-Key": accessKey,
        "X-Api-Resource-Id": REALTIME_RESOURCE_ID,
        "X-Api-App-Key": "PlgvMymc7f3tQnJ6",
        "X-Api-Connect-Id": connectId,
      },
    });

    const session = {
      ws,
      events: [] as QueuedEvent[],
      error: null as string | null,
      closed: false,
      dialogId: undefined as string | undefined,
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
      console.log(`Realtime session ${sessionId} connected`);

      // StartConnection 事件不需要携带 connect_id
      const startConnectionFrame = buildFrame({
        messageType: PROTOCOL.MSG_FULL_CLIENT_REQUEST,
        flags: PROTOCOL.FLAG_EVENT,
        serial: PROTOCOL.SERIAL_JSON,
        eventId: EVENTS.START_CONNECTION,
        payload: buildJsonPayload({}),
      });

      ws.send(startConnectionFrame);

      const startSessionPayload: Record<string, unknown> = {
        asr: {
          audio_info: {
            format: "pcm",
            sample_rate: 16000,
            channel: 1,
          },
        },
        tts: {
          audio_config: {
            channel: 1,
            format: "pcm_s16le",
            sample_rate: 24000,
          },
          speaker,
        },
        dialog: {
          bot_name: botName,
          system_role: systemPrompt,
          speaking_style: speakingStyle,
          extra: {
            strict_audit: true,
            model,
          },
        },
      };

      // Add tools if provided (Function Calling support)
      if (config.tools && config.tools.length > 0) {
        (startSessionPayload.dialog as Record<string, unknown>).tools = config.tools.map(t => ({
          type: "function",
          function: {
            name: t.function.name,
            description: t.function.description,
            parameters: t.function.parameters,
          },
        }));
      }

      if (characterManifest) {
        (startSessionPayload.dialog as Record<string, unknown>).character_manifest = characterManifest;
      }

      const startSessionFrame = buildFrame({
        messageType: PROTOCOL.MSG_FULL_CLIENT_REQUEST,
        flags: PROTOCOL.FLAG_EVENT,
        serial: PROTOCOL.SERIAL_JSON,
        eventId: EVENTS.START_SESSION,
        sessionId,
        payload: buildJsonPayload(startSessionPayload),
      });

      ws.send(startSessionFrame);

      sessions.set(sessionId, session);
    });

    ws.on("message", (data: Buffer) => {
      try {
        const parsed = parseFrame(data);

        if (parsed.header.messageType === PROTOCOL.MSG_SERVER_ERROR) {
          session.error = parsed.payloadJson ? JSON.stringify(parsed.payloadJson) : "Server error";
          return;
        }

        if (parsed.eventId === EVENTS.SESSION_STARTED && parsed.payloadJson?.dialog_id) {
          session.dialogId = String(parsed.payloadJson.dialog_id);
        }

        if (parsed.eventId) {
          const queued: QueuedEvent = {
            eventId: parsed.eventId,
          };

          if (parsed.payloadJson) {
            queued.payload = parsed.payloadJson;
          }

          if (parsed.audioData) {
            queued.audioBase64 = parsed.audioData.toString("base64");
          }

          session.events.push(queued);
          if (session.events.length > MAX_QUEUE) {
            session.events.shift();
          }
        }
      } catch (e) {
        console.error(`Realtime session ${sessionId} parse error:`, e);
      }
    });

    ws.on("error", (error: Error) => {
      clearTimeout(timeout);
      console.error(`Realtime session ${sessionId} error:`, error.message);
      session.error = error.message;
      session.closed = true;
      // Return error immediately if not yet resolved
      resolve(NextResponse.json(
        { error: `WebSocket error: ${error.message}` },
        { status: 502 }
      ));
    });

    ws.on("close", (code: number, reason: Buffer) => {
      console.log(`Realtime session ${sessionId} closed:`, code, reason.toString());
      session.closed = true;
      // If closed before session started, return error
      if (!session.dialogId) {
        resolve(NextResponse.json(
          { error: `Connection closed: ${code} ${reason.toString()}` },
          { status: 502 }
        ));
      }

      setTimeout(() => {
        sessions.delete(sessionId);
      }, 30000);
    });

    const waitForSessionStart = setTimeout(() => {
      if (!session.closed) {
        resolve(NextResponse.json({ sessionId, status: "connected" }));
      }
    }, 300);

    ws.on("message", () => {
      if (session.dialogId) {
        clearTimeout(waitForSessionStart);
        resolve(NextResponse.json({ sessionId, status: "connected", dialogId: session.dialogId }));
      }
    });
  });
}

async function sendAudio(sessionId: string, audioBase64?: string): Promise<NextResponse> {
  if (!audioBase64) {
    return NextResponse.json({ error: "Missing audio data" }, { status: 400 });
  }

  const session = sessions.get(sessionId);
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  if (session.closed) {
    return NextResponse.json({ error: "Session closed" }, { status: 410 });
  }

  if (session.ws.readyState !== WebSocket.OPEN) {
    return NextResponse.json({ error: "WebSocket not connected" }, { status: 503 });
  }

  const audioBuffer = Buffer.from(audioBase64, "base64");

  const audioFrame = buildFrame({
    messageType: PROTOCOL.MSG_AUDIO_ONLY_REQUEST,
    flags: PROTOCOL.FLAG_EVENT,
    serial: PROTOCOL.SERIAL_NONE,
    eventId: EVENTS.TASK_REQUEST,
    sessionId,
    payload: audioBuffer,
  });

  session.ws.send(audioFrame);

  return NextResponse.json({ status: "sent" });
}

async function sendText(sessionId: string, text?: string): Promise<NextResponse> {
  if (!text) {
    return NextResponse.json({ error: "Missing text" }, { status: 400 });
  }

  const session = sessions.get(sessionId);
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  if (session.closed) {
    return NextResponse.json({ error: "Session closed" }, { status: 410 });
  }

  if (session.ws.readyState !== WebSocket.OPEN) {
    return NextResponse.json({ error: "WebSocket not connected" }, { status: 503 });
  }

  const payload = buildJsonPayload({ content: text });

  const textFrame = buildFrame({
    messageType: PROTOCOL.MSG_FULL_CLIENT_REQUEST,
    flags: PROTOCOL.FLAG_EVENT,
    serial: PROTOCOL.SERIAL_JSON,
    eventId: EVENTS.CHAT_TEXT_QUERY,
    sessionId,
    payload,
  });

  session.ws.send(textFrame);

  return NextResponse.json({ status: "sent" });
}

async function sendFunctionResult(
  sessionId: string,
  callId?: string,
  result?: string
): Promise<NextResponse> {
  if (!callId) {
    return NextResponse.json({ error: "Missing callId" }, { status: 400 });
  }

  const session = sessions.get(sessionId);
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  if (session.closed) {
    return NextResponse.json({ error: "Session closed" }, { status: 410 });
  }

  if (session.ws.readyState !== WebSocket.OPEN) {
    return NextResponse.json({ error: "WebSocket not connected" }, { status: 503 });
  }

  const payload = buildJsonPayload({
    tool_call_id: callId,
    content: result || "success",
  });

  const resultFrame = buildFrame({
    messageType: PROTOCOL.MSG_FULL_CLIENT_REQUEST,
    flags: PROTOCOL.FLAG_EVENT,
    serial: PROTOCOL.SERIAL_JSON,
    eventId: EVENTS.FUNCTION_CALL_RESULT,
    sessionId,
    payload,
  });

  session.ws.send(resultFrame);

  return NextResponse.json({ status: "sent" });
}

async function finishSession(sessionId: string): Promise<NextResponse> {
  const session = sessions.get(sessionId);
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  if (session.ws.readyState === WebSocket.OPEN) {
    const finishFrame = buildFrame({
      messageType: PROTOCOL.MSG_FULL_CLIENT_REQUEST,
      flags: PROTOCOL.FLAG_EVENT,
      serial: PROTOCOL.SERIAL_JSON,
      eventId: EVENTS.FINISH_SESSION,
      sessionId,
      payload: buildJsonPayload({}),
    });
    session.ws.send(finishFrame);
  }

  return NextResponse.json({ status: "finishing" });
}

function getEvents(sessionId: string): NextResponse {
  const session = sessions.get(sessionId);

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const events = session.events.splice(0, session.events.length);

  return NextResponse.json({
    events,
    error: session.error,
    closed: session.closed,
  });
}

function closeSession(sessionId: string): NextResponse {
  const session = sessions.get(sessionId);

  if (session) {
    if (session.ws.readyState === WebSocket.OPEN) {
      try {
        const finishFrame = buildFrame({
          messageType: PROTOCOL.MSG_FULL_CLIENT_REQUEST,
          flags: PROTOCOL.FLAG_EVENT,
          serial: PROTOCOL.SERIAL_JSON,
          eventId: EVENTS.FINISH_SESSION,
          sessionId,
          payload: buildJsonPayload({}),
        });
        session.ws.send(finishFrame);
      } catch {
        // Ignore
      }
      session.ws.close();
    }
    sessions.delete(sessionId);
  }

  return NextResponse.json({ status: "closed" });
}
