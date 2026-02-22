/**
 * ASR SSE Streaming Endpoint
 *
 * Pushes ASR results to the client in real-time via Server-Sent Events,
 * replacing the previous 200ms polling approach.
 *
 * Usage: GET /api/voice/asr/stream?sessionId=xxx
 */

import { NextRequest } from "next/server";
import { sessions } from "../sessions";
import type { ASRResult } from "../sessions";

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
      // Send any buffered results that arrived before SSE connected
      if (session.results.length > 0) {
        for (const result of session.results) {
          const data = JSON.stringify(result);
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        }
        session.results = [];
      }

      // Listen for new results from the session's EventEmitter
      const onResult = (result: ASRResult) => {
        try {
          const data = JSON.stringify(result);
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

      session.emitter.on("result", onResult);
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
