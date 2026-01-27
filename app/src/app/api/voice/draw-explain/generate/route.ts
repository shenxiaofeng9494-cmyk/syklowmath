import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import {
  DRAW_EXPLAIN_SYSTEM_PROMPT,
  DRAW_EXPLAIN_USER_PROMPT_TEMPLATE,
} from "@/lib/draw-explain/prompts";
import { DrawingScript } from "@/types/drawing-script";
import { getNodeByTime } from "@/lib/rag";

export async function POST(req: NextRequest) {
  try {
    const { userQuery, videoContext, videoId, currentTime } = await req.json();

    if (!userQuery) {
      return NextResponse.json(
        { error: "userQuery is required" },
        { status: 400 }
      );
    }

    // Check API key
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY not configured" },
        { status: 500 }
      );
    }

    // Build context from video
    let contextStr = videoContext || "";

    // Add current node info if available
    if (videoId && typeof currentTime === "number") {
      try {
        const currentNode = await getNodeByTime(videoId, currentTime);
        if (currentNode) {
          contextStr += `\n当前知识点：${currentNode.title}\n${currentNode.summary || ""}`;
        }
      } catch (e) {
        console.error("Failed to get node context:", e);
      }
    }

    // Create OpenAI client
    const openai = new OpenAI({ apiKey });

    // Call GPT-4o to generate drawing script
    const response = await openai.chat.completions.create({
      model: process.env.DRAW_EXPLAIN_MODEL || "gpt-4o",
      messages: [
        {
          role: "system",
          content: DRAW_EXPLAIN_SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: DRAW_EXPLAIN_USER_PROMPT_TEMPLATE(userQuery, contextStr),
        },
      ],
      max_tokens: 4096,
      temperature: 0.7,
    });

    const textContent = response.choices?.[0]?.message?.content;

    if (!textContent) {
      return NextResponse.json(
        { error: "No text response from GPT-4o" },
        { status: 500 }
      );
    }

    // Parse JSON from response
    let script: DrawingScript;
    try {
      // Extract JSON from markdown code block if present
      let jsonStr = textContent;
      const jsonMatch = jsonStr.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1];
      }
      script = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error("Failed to parse drawing script:", parseError);
      console.error("Raw response:", textContent);
      return NextResponse.json(
        { error: "Failed to parse drawing script from GPT-4o response" },
        { status: 500 }
      );
    }

    // Validate script structure
    if (!script.title || !script.opening || !script.steps || !script.closing) {
      return NextResponse.json(
        { error: "Invalid drawing script structure" },
        { status: 500 }
      );
    }

    return NextResponse.json({ script });
  } catch (error) {
    console.error("Error generating drawing script:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
