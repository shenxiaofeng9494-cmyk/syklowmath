/**
 * Layout Engine
 *
 * 自动排版、对齐、布局算法
 */

import type { Point } from "./types";

const DEFAULT_CANVAS = { width: 800, height: 600 };

/**
 * 计算居中位置
 */
export function centerPosition(
  itemWidth: number,
  itemHeight: number,
  canvasSize = DEFAULT_CANVAS
): Point {
  return {
    x: (canvasSize.width - itemWidth) / 2,
    y: (canvasSize.height - itemHeight) / 2,
  };
}

/**
 * 垂直布局：将多个元素垂直排列
 */
export function verticalLayout(
  items: Array<{ width: number; height: number }>,
  spacing: number,
  startY: number,
  centerX: number
): Point[] {
  const positions: Point[] = [];
  let currentY = startY;

  for (const item of items) {
    positions.push({
      x: centerX - item.width / 2,
      y: currentY,
    });
    currentY += item.height + spacing;
  }

  return positions;
}

/**
 * 水平布局：将多个元素水平排列
 */
export function horizontalLayout(
  items: Array<{ width: number; height: number }>,
  spacing: number,
  startX: number,
  centerY: number
): Point[] {
  const positions: Point[] = [];
  let currentX = startX;

  for (const item of items) {
    positions.push({
      x: currentX,
      y: centerY - item.height / 2,
    });
    currentX += item.width + spacing;
  }

  return positions;
}

/**
 * 环形布局：将元素围绕中心点排列
 */
export function radialLayout(
  count: number,
  center: Point,
  radius: number,
  startAngle = -Math.PI / 2 // 从顶部开始
): Point[] {
  const positions: Point[] = [];
  const angleStep = (2 * Math.PI) / count;

  for (let i = 0; i < count; i++) {
    const angle = startAngle + i * angleStep;
    positions.push({
      x: center.x + Math.cos(angle) * radius,
      y: center.y + Math.sin(angle) * radius,
    });
  }

  return positions;
}

/**
 * 网格布局
 */
export function gridLayout(
  rows: number,
  cols: number,
  cellWidth: number,
  cellHeight: number,
  startX: number,
  startY: number,
  spacing = 0
): Point[][] {
  const grid: Point[][] = [];

  for (let r = 0; r < rows; r++) {
    const row: Point[] = [];
    for (let c = 0; c < cols; c++) {
      row.push({
        x: startX + c * (cellWidth + spacing),
        y: startY + r * (cellHeight + spacing),
      });
    }
    grid.push(row);
  }

  return grid;
}

/**
 * 计算包围盒
 */
export function boundingBox(
  points: Point[]
): { min: Point; max: Point; width: number; height: number } {
  if (points.length === 0) {
    return { min: { x: 0, y: 0 }, max: { x: 0, y: 0 }, width: 0, height: 0 };
  }

  let minX = Infinity, minY = Infinity;
  let maxX = -Infinity, maxY = -Infinity;

  for (const p of points) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }

  return {
    min: { x: minX, y: minY },
    max: { x: maxX, y: maxY },
    width: maxX - minX,
    height: maxY - minY,
  };
}

/**
 * 计算文本宽度估算（基于字符数）
 */
export function estimateTextWidth(text: string, fontSize = 16): number {
  // 中文字符宽度约等于字号，英文约为字号的 0.6
  let width = 0;
  for (const char of text) {
    if (/[\u4e00-\u9fa5]/.test(char)) {
      width += fontSize;
    } else {
      width += fontSize * 0.6;
    }
  }
  return width;
}

/**
 * 自动调整位置避免重叠
 */
export function avoidOverlap(
  positions: Point[],
  sizes: Array<{ width: number; height: number }>,
  minDistance = 10
): Point[] {
  const adjusted = positions.map((p) => ({ ...p }));

  // 简单的碰撞检测和调整
  for (let i = 0; i < adjusted.length; i++) {
    for (let j = i + 1; j < adjusted.length; j++) {
      const box1 = {
        x: adjusted[i].x,
        y: adjusted[i].y,
        w: sizes[i].width,
        h: sizes[i].height,
      };
      const box2 = {
        x: adjusted[j].x,
        y: adjusted[j].y,
        w: sizes[j].width,
        h: sizes[j].height,
      };

      // 检查是否重叠
      if (
        box1.x < box2.x + box2.w + minDistance &&
        box1.x + box1.w + minDistance > box2.x &&
        box1.y < box2.y + box2.h + minDistance &&
        box1.y + box1.h + minDistance > box2.y
      ) {
        // 向外推开
        const dx = (box1.x + box1.w / 2) - (box2.x + box2.w / 2);
        const dy = (box1.y + box1.h / 2) - (box2.y + box2.h / 2);
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const push = minDistance / 2;

        adjusted[i].x += (dx / dist) * push;
        adjusted[i].y += (dy / dist) * push;
        adjusted[j].x -= (dx / dist) * push;
        adjusted[j].y -= (dy / dist) * push;
      }
    }
  }

  return adjusted;
}
