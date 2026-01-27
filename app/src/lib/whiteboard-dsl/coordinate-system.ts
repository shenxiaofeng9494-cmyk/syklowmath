/**
 * Coordinate System Utilities
 *
 * 数学坐标系 ↔ 画布坐标转换
 */

import type { Point, Range, CoordinateContext } from "./types";

const DEFAULT_CANVAS_SIZE = { width: 800, height: 600 };
const PADDING = 60; // 画布边距

/**
 * 创建坐标系上下文
 */
export function createCoordinateContext(
  xRange: Range,
  yRange: Range,
  canvasSize = DEFAULT_CANVAS_SIZE,
  origin?: Point
): CoordinateContext {
  const [xMin, xMax] = xRange;
  const [yMin, yMax] = yRange;

  const drawableWidth = canvasSize.width - 2 * PADDING;
  const drawableHeight = canvasSize.height - 2 * PADDING;

  const xSpan = xMax - xMin;
  const ySpan = yMax - yMin;

  const scaleX = drawableWidth / xSpan;
  const scaleY = drawableHeight / ySpan;

  // 计算原点在画布上的位置
  const originX = origin?.x ?? PADDING + (-xMin / xSpan) * drawableWidth;
  const originY = origin?.y ?? PADDING + (yMax / ySpan) * drawableHeight;

  return {
    xRange,
    yRange,
    origin: { x: originX, y: originY },
    scale: { x: scaleX, y: scaleY },
  };
}

/**
 * 数学坐标 → 画布坐标
 */
export function mathToCanvas(
  point: Point,
  context: CoordinateContext
): Point {
  return {
    x: context.origin.x + point.x * context.scale.x,
    y: context.origin.y - point.y * context.scale.y, // y 轴翻转
  };
}

/**
 * 画布坐标 → 数学坐标
 */
export function canvasToMath(
  point: Point,
  context: CoordinateContext
): Point {
  return {
    x: (point.x - context.origin.x) / context.scale.x,
    y: (context.origin.y - point.y) / context.scale.y,
  };
}

/**
 * 计算两点之间的距离
 */
export function distance(p1: Point, p2: Point): number {
  return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
}

/**
 * 计算两点之间的角度（弧度）
 */
export function angle(from: Point, to: Point): number {
  return Math.atan2(to.y - from.y, to.x - from.x);
}

/**
 * 计算两向量之间的夹角（弧度）
 */
export function angleBetween(
  vertex: Point,
  p1: Point,
  p2: Point
): number {
  const v1 = { x: p1.x - vertex.x, y: p1.y - vertex.y };
  const v2 = { x: p2.x - vertex.x, y: p2.y - vertex.y };

  const dot = v1.x * v2.x + v1.y * v2.y;
  const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
  const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);

  return Math.acos(dot / (mag1 * mag2));
}

/**
 * 在两点之间插值
 */
export function lerp(p1: Point, p2: Point, t: number): Point {
  return {
    x: p1.x + (p2.x - p1.x) * t,
    y: p1.y + (p2.y - p1.y) * t,
  };
}

/**
 * 计算点到线段的垂足
 */
export function perpendicularFoot(
  point: Point,
  lineStart: Point,
  lineEnd: Point
): Point {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  const t = ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) /
    (dx * dx + dy * dy);
  return {
    x: lineStart.x + t * dx,
    y: lineStart.y + t * dy,
  };
}
