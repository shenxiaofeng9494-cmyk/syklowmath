/**
 * Coordinate Commands
 *
 * 坐标系和函数绘制命令
 */

import type { DrawingShape } from "@/components/drawing-canvas/TldrawCanvas";
import type {
  DrawCoordinatePlaneParams,
  PlotFunctionParams,
  CompilerContext,
  Point,
} from "../types";
import {
  createCoordinateContext,
  mathToCanvas,
} from "../coordinate-system";

/**
 * 绘制坐标平面
 */
export function drawCoordinatePlane(
  params: DrawCoordinatePlaneParams,
  context: CompilerContext
): DrawingShape[] {
  const shapes: DrawingShape[] = [];
  const { xRange, yRange, gridLines = true, labels = true } = params;

  // 创建坐标系上下文
  const coordCtx = createCoordinateContext(
    xRange,
    yRange,
    context.canvasSize,
    params.origin
  );

  // 更新编译器上下文
  context.coordinateContext = coordCtx;

  const [xMin, xMax] = xRange;
  const [yMin, yMax] = yRange;

  // 计算轴的画布坐标
  const xAxisStart = mathToCanvas({ x: xMin, y: 0 }, coordCtx);
  const xAxisEnd = mathToCanvas({ x: xMax, y: 0 }, coordCtx);
  const yAxisStart = mathToCanvas({ x: 0, y: yMin }, coordCtx);
  const yAxisEnd = mathToCanvas({ x: 0, y: yMax }, coordCtx);

  // 绘制网格线
  if (gridLines) {
    // 垂直网格线
    for (let x = Math.ceil(xMin); x <= Math.floor(xMax); x++) {
      if (x === 0) continue; // 跳过 y 轴
      const top = mathToCanvas({ x, y: yMax }, coordCtx);
      const bottom = mathToCanvas({ x, y: yMin }, coordCtx);
      shapes.push({
        type: "line",
        x: top.x,
        y: top.y,
        points: [
          { x: 0, y: 0 },
          { x: 0, y: bottom.y - top.y },
        ],
        color: "grey",
      });
    }

    // 水平网格线
    for (let y = Math.ceil(yMin); y <= Math.floor(yMax); y++) {
      if (y === 0) continue; // 跳过 x 轴
      const left = mathToCanvas({ x: xMin, y }, coordCtx);
      const right = mathToCanvas({ x: xMax, y }, coordCtx);
      shapes.push({
        type: "line",
        x: left.x,
        y: left.y,
        points: [
          { x: 0, y: 0 },
          { x: right.x - left.x, y: 0 },
        ],
        color: "grey",
      });
    }
  }

  // X 轴
  shapes.push({
    type: "line",
    x: xAxisStart.x,
    y: xAxisStart.y,
    points: [
      { x: 0, y: 0 },
      { x: xAxisEnd.x - xAxisStart.x, y: 0 },
    ],
    color: "black",
  });

  // X 轴箭头
  shapes.push({
    type: "line",
    x: xAxisEnd.x,
    y: xAxisEnd.y,
    points: [
      { x: -10, y: -6 },
      { x: 0, y: 0 },
      { x: -10, y: 6 },
    ],
    color: "black",
  });

  // Y 轴
  shapes.push({
    type: "line",
    x: yAxisEnd.x,
    y: yAxisEnd.y,
    points: [
      { x: 0, y: 0 },
      { x: 0, y: yAxisStart.y - yAxisEnd.y },
    ],
    color: "black",
  });

  // Y 轴箭头
  shapes.push({
    type: "line",
    x: yAxisEnd.x,
    y: yAxisEnd.y,
    points: [
      { x: -6, y: 10 },
      { x: 0, y: 0 },
      { x: 6, y: 10 },
    ],
    color: "black",
  });

  // 标签
  if (labels) {
    // x 标签
    shapes.push({
      type: "text",
      x: xAxisEnd.x + 10,
      y: xAxisEnd.y - 8,
      text: "x",
      color: "black",
    });

    // y 标签
    shapes.push({
      type: "text",
      x: yAxisEnd.x + 8,
      y: yAxisEnd.y - 5,
      text: "y",
      color: "black",
    });

    // 原点 O
    shapes.push({
      type: "text",
      x: coordCtx.origin.x - 20,
      y: coordCtx.origin.y + 5,
      text: "O",
      color: "black",
    });

    // 刻度标签
    for (let x = Math.ceil(xMin); x <= Math.floor(xMax); x++) {
      if (x === 0) continue;
      const pos = mathToCanvas({ x, y: 0 }, coordCtx);
      shapes.push({
        type: "text",
        x: pos.x - 5,
        y: pos.y + 10,
        text: String(x),
        color: "black",
      });
    }

    for (let y = Math.ceil(yMin); y <= Math.floor(yMax); y++) {
      if (y === 0) continue;
      const pos = mathToCanvas({ x: 0, y }, coordCtx);
      shapes.push({
        type: "text",
        x: pos.x - 20,
        y: pos.y - 8,
        text: String(y),
        color: "black",
      });
    }
  }

  return shapes;
}

/**
 * 解析函数表达式
 * 支持格式：
 * - "y = x^2"
 * - "x^2"
 * - "y = 2*x + 1"
 */
function parseExpression(expr: string): string {
  // 移除 "y = " 前缀
  let cleaned = expr.replace(/^y\s*=\s*/i, "").trim();

  // 转换数学表达式为 JavaScript
  cleaned = cleaned
    // 幂运算
    .replace(/\^/g, "**")
    // 隐式乘法：2x -> 2*x, x(x+1) -> x*(x+1)
    .replace(/(\d)([a-z])/gi, "$1*$2")
    .replace(/([a-z])(\d)/gi, "$1*$2")
    .replace(/(\))(\()/g, "$1*$2")
    .replace(/(\d)(\()/g, "$1*$2")
    .replace(/(\))([a-z])/gi, "$1*$2")
    // 三角函数
    .replace(/\bsin\b/g, "Math.sin")
    .replace(/\bcos\b/g, "Math.cos")
    .replace(/\btan\b/g, "Math.tan")
    .replace(/\bsqrt\b/g, "Math.sqrt")
    .replace(/\babs\b/g, "Math.abs")
    .replace(/\bln\b/g, "Math.log")
    .replace(/\blog\b/g, "Math.log10")
    .replace(/\bexp\b/g, "Math.exp")
    .replace(/\bpi\b/gi, "Math.PI")
    .replace(/\be\b/g, "Math.E");

  return cleaned;
}

/**
 * 安全计算函数值
 */
function safeEval(expr: string, x: number): number | null {
  try {
    const fn = new Function("x", `return ${expr}`);
    const result = fn(x);
    if (typeof result === "number" && isFinite(result)) {
      return result;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * 绘制函数图像
 */
export function plotFunction(
  params: PlotFunctionParams,
  context: CompilerContext
): DrawingShape[] {
  const shapes: DrawingShape[] = [];
  const coordCtx = context.coordinateContext;

  if (!coordCtx) {
    console.warn("PlotFunction: No coordinate context. Call DrawCoordinatePlane first.");
    return shapes;
  }

  const { expression, color = "blue", domain, points: markedPoints } = params;
  const jsExpr = parseExpression(expression);

  // 确定绘制范围
  const [xMin, xMax] = domain || coordCtx.xRange;
  const [yMin, yMax] = coordCtx.yRange;

  // 采样点数
  const numSamples = 200;
  const step = (xMax - xMin) / numSamples;

  // 收集有效点
  const segments: Point[][] = [];
  let currentSegment: Point[] = [];

  for (let i = 0; i <= numSamples; i++) {
    const x = xMin + i * step;
    const y = safeEval(jsExpr, x);

    if (y !== null && y >= yMin && y <= yMax) {
      const canvasPoint = mathToCanvas({ x, y }, coordCtx);
      currentSegment.push(canvasPoint);
    } else {
      // 断开线段
      if (currentSegment.length > 1) {
        segments.push(currentSegment);
      }
      currentSegment = [];
    }
  }

  // 添加最后一段
  if (currentSegment.length > 1) {
    segments.push(currentSegment);
  }

  // 绘制每段曲线
  for (const segment of segments) {
    if (segment.length < 2) continue;

    const startPoint = segment[0];
    const relativePoints = segment.map((p) => ({
      x: p.x - startPoint.x,
      y: p.y - startPoint.y,
    }));

    shapes.push({
      type: "line",
      x: startPoint.x,
      y: startPoint.y,
      points: relativePoints,
      color,
    });
  }

  // 标记特殊点
  if (markedPoints) {
    for (const pt of markedPoints) {
      const canvasPoint = mathToCanvas(pt, coordCtx);

      // 点标记（小圆）
      shapes.push({
        type: "ellipse",
        x: canvasPoint.x - 4,
        y: canvasPoint.y - 4,
        width: 8,
        height: 8,
        color,
      });

      // 标签
      if (pt.label) {
        shapes.push({
          type: "text",
          x: canvasPoint.x + 8,
          y: canvasPoint.y - 15,
          text: pt.label,
          color,
        });
      }
    }
  }

  return shapes;
}
