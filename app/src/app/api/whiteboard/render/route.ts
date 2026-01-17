import { NextRequest, NextResponse } from "next/server";
import { renderDiagramIR } from "@/lib/geometry-renderer";
import { DiagramIR } from "@/types/diagram-ir";

export async function POST(req: NextRequest) {
  try {
    const { diagram_ir } = await req.json();

    if (!diagram_ir) {
      return NextResponse.json(
        { success: false, error: "Missing diagram_ir" },
        { status: 400 }
      );
    }

    // Render IR to Excalidraw elements
    const result = renderDiagramIR(diagram_ir as DiagramIR);

    return NextResponse.json({
      success: true,
      elements: result.elements,
      nodePositions: Object.fromEntries(result.nodePositions),
    });
  } catch (error) {
    console.error("Render error:", error);
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
