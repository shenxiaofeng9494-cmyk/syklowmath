/**
 * TTS SSE Streaming Endpoint
 *
 * Pushes TTS audio data to the client in real-time via Server-Sent Events,
 * replacing the previous 100ms polling approach.
 *
 * Usage: GET /api/voice/tts/stream?sessionId=xxx
 */

import { NextRequest } from "next/server";
import { sessions } from "../sessions";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("sessionId");

  if (!sessionId) {
    return new Response(JSON.stringify({ error: "Missing sessionId" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const session = sessions.get(sessionId);

  if (!session) {
    return new Response(JSON.stringify({ error: "Session not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Send any buffered audio chunks that arrived before SSE connected
      if (session.audioChunks.length > 0) {
        for (const chunk of session.audioChunks) {
          const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
          const base64 = buffer.toString("base64");
          const data = JSON.stringify({ audio: base64 });
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        }
        session.audioChunks = [];
      }

      // Listen for new audio from the session's EventEmitter
      const onAudio = (audioBuffer: Buffer) => {
        try {
          const buffer = Buffer.isBuffer(audioBuffer) ? audioBuffer : Buffer.from(audioBuffer);
          const base64 = buffer.toString("base64");
          const data = JSON.stringify({ audio: base64 });
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        } catch {
          // Stream closed
        }
      };

      const onSessionStarted = () => {
        try {
          const data = JSON.stringify({ event: "sessionStarted" });
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        } catch {
          // Stream closed
        }
      };

      const onSessionFinished = () => {
        try {
          const data = JSON.stringify({ event: "sessionFinished" });
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        } catch {
          // Stream closed
        }
      };

      const onError = (error: string) => {
        try {
          const data = JSON.stringify({ error });
          controller.enqueue(encoder.encode(`event: error\ndata: ${data}\n\n`));
        } catch {
          // Stream closed
        }
      };

      const onClosed = () => {
        try {
          controller.enqueue(encoder.encode(`event: closed\ndata: {}\n\n`));
          controller.close();
        } catch {
          // Already closed
        }
      };

      session.emitter.on("audio", onAudio);
      session.emitter.on("sessionStarted", onSessionStarted);
      session.emitter.on("sessionFinished", onSessionFinished);
      session.emitter.on("error", onError);
      session.emitter.on("closed", onClosed);

      // If session is already closed, close the stream immediately
      if (session.closed) {
        onClosed();
        return;
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
