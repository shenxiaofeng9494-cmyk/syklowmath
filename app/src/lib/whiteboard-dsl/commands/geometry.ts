/**
 * Geometry Commands
 *
 * 几何图形绘制命令
 */

import type { DrawingShape } from "@/components/drawing-canvas/TldrawCanvas";
import type {
  ConstructTriangleParams,
  ConstructCircleParams,
  DrawAngleParams,
  DrawLineSegmentParams,
  CompilerContext,
  Point,
} from "../types";
import { angleBetween } from "../coordinate-system";

/**
 * 构造三角形
 */
export function constructTriangle(
  params: ConstructTriangleParams,
  _context: CompilerContext // eslint-disable-line @typescript-eslint/no-unused-vars
): DrawingShape[] {
  const shapes: DrawingShape[] = [];
  const { vertices, labels = true, showAngles = false, color = "blue" } = params;
  const { A, B, C } = vertices;

  // 绘制三角形边（闭合折线）
  shapes.push({
    type: "line",
    x: A.x,
    y: A.y,
    points: [
      { x: 0, y: 0 },
      { x: B.x - A.x, y: B.y - A.y },
      { x: C.x - A.x, y: C.y - A.y },
      { x: 0, y: 0 }, // 闭合
    ],
    color,
  });

  // 顶点标签
  if (labels) {
    // 计算标签偏移（向外）
    const center = {
      x: (A.x + B.x + C.x) / 3,
      y: (A.y + B.y + C.y) / 3,
    };

    const labelOffset = 15;

    const offsetA = normalizeVector(A.x - center.x, A.y - center.y, labelOffset);
    const offsetB = normalizeVector(B.x - center.x, B.y - center.y, labelOffset);
    const offsetC = normalizeVector(C.x - center.x, C.y - center.y, labelOffset);

    shapes.push({
      type: "text",
      x: A.x + offsetA.x - 5,
      y: A.y + offsetA.y - 8,
      text: "A",
      color: "black",
    });

    shapes.push({
      type: "text",
      x: B.x + offsetB.x - 5,
      y: B.y + offsetB.y - 8,
      text: "B",
      color: "black",
    });

    shapes.push({
      type: "text",
      x: C.x + offsetC.x - 5,
      y: C.y + offsetC.y - 8,
      text: "C",
      color: "black",
    });
  }

  // 显示角度
  if (showAngles) {
    // 角 A
    const angleA = angleBetween(A, B, C);
    shapes.push(...drawAngleArc(A, B, C, `${Math.round(angleA * 180 / Math.PI)}°`));

    // 角 B
    const angleB = angleBetween(B, A, C);
    shapes.push(...drawAngleArc(B, A, C, `${Math.round(angleB * 180 / Math.PI)}°`));

    // 角 C
    const angleC = angleBetween(C, A, B);
    shapes.push(...drawAngleArc(C, A, B, `${Math.round(angleC * 180 / Math.PI)}°`));
  }

  return shapes;
}

/**
 * 构造圆
 */
export function constructCircle(
  params: ConstructCircleParams,
  _context: CompilerContext // eslint-disable-line @typescript-eslint/no-unused-vars
): DrawingShape[] {
  const shapes: DrawingShape[] = [];
  const {
    center,
    radius,
    label,
    showCenter = true,
    showRadius = false,
    color = "blue",
  } = params;

  // 绘制圆（使用椭圆，宽高相等）
  shapes.push({
    type: "ellipse",
    x: center.x - radius,
    y: center.y - radius,
    width: radius * 2,
    height: radius * 2,
    color,
  });

  // 圆心标记
  if (showCenter) {
    shapes.push({
      type: "ellipse",
      x: center.x - 3,
      y: center.y - 3,
      width: 6,
      height: 6,
      color: "black",
    });

    shapes.push({
      type: "text",
      x: center.x + 8,
      y: center.y - 15,
      text: "O",
      color: "black",
    });
  }

  // 半径标注
  if (showRadius) {
    shapes.push({
      type: "line",
      x: center.x,
      y: center.y,
      points: [
        { x: 0, y: 0 },
        { x: radius, y: 0 },
      ],
      color: "red",
    });

    shapes.push({
      type: "text",
      x: center.x + radius / 2 - 5,
      y: center.y - 15,
      text: "r",
      color: "red",
    });
  }

  // 圆的标签
  if (label) {
    shapes.push({
      type: "text",
      x: center.x - label.length * 5,
      y: center.y + radius + 15,
      text: label,
      color: "black",
    });
  }

  return shapes;
}

/**
 * 绘制角
 */
export function drawAngle(
  params: DrawAngleParams,
  _context: CompilerContext // eslint-disable-line @typescript-eslint/no-unused-vars
): DrawingShape[] {
  const shapes: DrawingShape[] = [];
  const {
    vertex,
    ray1End,
    ray2End,
    label,
    isRightAngle = false,
    showArc = true,
    color = "blue",
  } = params;

  // 绘制两条射线
  shapes.push({
    type: "line",
    x: vertex.x,
    y: vertex.y,
    points: [
      { x: 0, y: 0 },
      { x: ray1End.x - vertex.x, y: ray1End.y - vertex.y },
    ],
    color,
  });

  shapes.push({
    type: "line",
    x: vertex.x,
    y: vertex.y,
    points: [
      { x: 0, y: 0 },
      { x: ray2End.x - vertex.x, y: ray2End.y - vertex.y },
    ],
    color,
  });

  // 直角标记
  if (isRightAngle) {
    const size = 15;
    const dir1 = normalizeVector(
      ray1End.x - vertex.x,
      ray1End.y - vertex.y,
      size
    );
    const dir2 = normalizeVector(
      ray2End.x - vertex.x,
      ray2End.y - vertex.y,
      size
    );

    shapes.push({
      type: "line",
      x: vertex.x + dir1.x,
      y: vertex.y + dir1.y,
      points: [
        { x: 0, y: 0 },
        { x: dir2.x, y: dir2.y },
        { x: dir2.x - dir1.x, y: dir2.y - dir1.y },
      ],
      color: "red",
    });
  } else if (showArc) {
    // 角弧
    shapes.push(...drawAngleArc(vertex, ray1End, ray2End, label));
  }

  // 标签（如果没有弧线但有标签）
  if (label && !showArc && !isRightAngle) {
    const midDir = {
      x: (ray1End.x - vertex.x + ray2End.x - vertex.x) / 2,
      y: (ray1End.y - vertex.y + ray2End.y - vertex.y) / 2,
    };
    const labelPos = normalizeVector(midDir.x, midDir.y, 25);

    shapes.push({
      type: "text",
      x: vertex.x + labelPos.x - 10,
      y: vertex.y + labelPos.y - 8,
      text: label,
      color: "black",
    });
  }

  return shapes;
}

/**
 * 绘制线段
 */
export function drawLineSegment(
  params: DrawLineSegmentParams,
  _context: CompilerContext // eslint-disable-line @typescript-eslint/no-unused-vars
): DrawingShape[] {
  const shapes: DrawingShape[] = [];
  const { start, end, label, color = "blue" } = params;

  shapes.push({
    type: "line",
    x: start.x,
    y: start.y,
    points: [
      { x: 0, y: 0 },
      { x: end.x - start.x, y: end.y - start.y },
    ],
    color,
  });

  if (label) {
    const midX = (start.x + end.x) / 2;
    const midY = (start.y + end.y) / 2;

    // 计算垂直于线段的偏移
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    const perpX = -dy / len * 15;
    const perpY = dx / len * 15;

    shapes.push({
      type: "text",
      x: midX + perpX - label.length * 4,
      y: midY + perpY - 8,
      text: label,
      color: "black",
    });
  }

  return shapes;
}

// ============ 辅助函数 ============

/**
 * 归一化向量到指定长度
 */
function normalizeVector(
  x: number,
  y: number,
  length: number
): { x: number; y: number } {
  const mag = Math.sqrt(x * x + y * y);
  if (mag === 0) return { x: 0, y: 0 };
  return {
    x: (x / mag) * length,
    y: (y / mag) * length,
  };
}

/**
 * 绘制角弧和标签
 */
function drawAngleArc(
  vertex: Point,
  p1: Point,
  p2: Point,
  label?: string
): DrawingShape[] {
  const shapes: DrawingShape[] = [];
  const arcRadius = 20;

  // 计算两条边的方向
  const dir1 = normalizeVector(p1.x - vertex.x, p1.y - vertex.y, arcRadius);
  const dir2 = normalizeVector(p2.x - vertex.x, p2.y - vertex.y, arcRadius);

  // 简化：用折线近似弧
  const numPoints = 10;
  const arcPoints: Array<{ x: number; y: number }> = [];

  for (let i = 0; i <= numPoints; i++) {
    const t = i / numPoints;
    // 线性插值方向，然后归一化
    const interpX = dir1.x + (dir2.x - dir1.x) * t;
    const interpY = dir1.y + (dir2.y - dir1.y) * t;
    const normalized = normalizeVector(interpX, interpY, arcRadius);
    arcPoints.push({
      x: normalized.x - dir1.x,
      y: normalized.y - dir1.y,
    });
  }

  shapes.push({
    type: "line",
    x: vertex.x + dir1.x,
    y: vertex.y + dir1.y,
    points: arcPoints,
    color: "red",
  });

  // 标签
  if (label) {
    const midDir = normalizeVector(
      (dir1.x + dir2.x) / 2,
      (dir1.y + dir2.y) / 2,
      arcRadius + 15
    );

    shapes.push({
      type: "text",
      x: vertex.x + midDir.x - label.length * 4,
      y: vertex.y + midDir.y - 8,
      text: label,
      color: "black",
    });
  }

  return shapes;
}
