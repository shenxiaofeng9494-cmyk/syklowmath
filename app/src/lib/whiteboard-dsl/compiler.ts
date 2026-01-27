/**
 * DSL Compiler
 *
 * 将 DSL 脚本编译为 tldraw shapes
 */

import type { DrawingShape } from "@/components/drawing-canvas/TldrawCanvas";
import type {
  DSLScript,
  DSLCommand,
  CompileResult,
  CompilerContext,
  DrawCoordinatePlaneParams,
  PlotFunctionParams,
  ConstructTriangleParams,
  ConstructCircleParams,
  DrawAngleParams,
  DrawLineSegmentParams,
  CreateFlowchartParams,
  CreateMindmapParams,
  ShowCorrectWrongParams,
  AddLabelParams,
  AddArrowParams,
} from "./types";
import { validateDSL } from "./validator";
import {
  drawCoordinatePlane,
  plotFunction,
  constructTriangle,
  constructCircle,
  drawAngle,
  drawLineSegment,
  createFlowchart,
  createMindmap,
  showCorrectWrong,
  addLabel,
  addArrow,
} from "./commands";

const DEFAULT_CANVAS_SIZE = { width: 800, height: 600 };

/**
 * 编译 DSL 脚本
 */
export function compileDSL(script: DSLScript): CompileResult {
  // 验证脚本
  const validation = validateDSL(script);
  if (!validation.valid) {
    return {
      success: false,
      shapes: [],
      errors: validation.errors,
    };
  }

  // 初始化编译器上下文
  const context: CompilerContext = {
    canvasSize: script.canvasSize || DEFAULT_CANVAS_SIZE,
  };

  const allShapes: DrawingShape[] = [];
  const errors: string[] = [];

  // 按顺序执行每个命令
  for (let i = 0; i < script.commands.length; i++) {
    const cmd = script.commands[i];
    try {
      const shapes = executeCommand(cmd, context);
      allShapes.push(...shapes);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`Command[${i}] (${cmd.command}): ${message}`);
    }
  }

  return {
    success: errors.length === 0,
    shapes: allShapes,
    errors: errors.length > 0 ? errors : undefined,
    coordinateContext: context.coordinateContext,
  };
}

/**
 * 执行单个命令
 */
function executeCommand(
  cmd: DSLCommand,
  context: CompilerContext
): DrawingShape[] {
  switch (cmd.command) {
    case "DrawCoordinatePlane":
      return drawCoordinatePlane(cmd.params as DrawCoordinatePlaneParams, context);

    case "PlotFunction":
      return plotFunction(cmd.params as PlotFunctionParams, context);

    case "ConstructTriangle":
      return constructTriangle(cmd.params as ConstructTriangleParams, context);

    case "ConstructCircle":
      return constructCircle(cmd.params as ConstructCircleParams, context);

    case "DrawAngle":
      return drawAngle(cmd.params as DrawAngleParams, context);

    case "DrawLineSegment":
      return drawLineSegment(cmd.params as DrawLineSegmentParams, context);

    case "CreateFlowchart":
      return createFlowchart(cmd.params as CreateFlowchartParams, context);

    case "CreateMindmap":
      return createMindmap(cmd.params as CreateMindmapParams, context);

    case "ShowCorrectWrong":
      return showCorrectWrong(cmd.params as ShowCorrectWrongParams, context);

    case "AddLabel":
      return addLabel(cmd.params as AddLabelParams, context);

    case "AddArrow":
      return addArrow(cmd.params as AddArrowParams, context);

    default:
      throw new Error(`Unknown command: ${(cmd as { command: string }).command}`);
  }
}

/**
 * 快捷方法：从 JSON 字符串编译
 */
export function compileDSLFromJSON(json: string): CompileResult {
  try {
    const script = JSON.parse(json) as DSLScript;
    return compileDSL(script);
  } catch (error) {
    return {
      success: false,
      shapes: [],
      errors: [`JSON parse error: ${error instanceof Error ? error.message : String(error)}`],
    };
  }
}
