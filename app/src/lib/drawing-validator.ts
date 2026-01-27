/**
 * Drawing Shape Validator
 *
 * 验证和修正 AI 生成的绘图参数，确保图形在画布范围内且格式正确。
 */

import type { DrawingShape } from "@/components/drawing-canvas/TldrawCanvas";

// 画布尺寸
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const PADDING = 20;

// 有效的形状类型
const VALID_SHAPE_TYPES = new Set([
  "rectangle", "ellipse", "triangle", "diamond",
  "pentagon", "hexagon", "octagon", "star",
  "rhombus", "rhombus-2", "oval", "trapezoid",
  "cloud", "heart",
  "arrow-right", "arrow-left", "arrow-up", "arrow-down",
  "check-box", "x-box",
  "line", "arrow", "text", "freehand"
]);

// 有效的颜色
const VALID_COLORS = new Set([
  "red", "blue", "green", "yellow", "orange", "violet",
  "black", "white", "grey",
  "light-red", "light-blue", "light-green", "light-violet"
]);

export interface ValidationResult {
  valid: boolean;
  shapes: DrawingShape[];
  errors: string[];
  warnings: string[];
}

/**
 * 验证并修正单个形状
 */
function validateAndFixShape(shape: DrawingShape, index: number): {
  shape: DrawingShape;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  const fixed = { ...shape };

  // 1. 验证形状类型
  if (!VALID_SHAPE_TYPES.has(shape.type)) {
    errors.push(`Shape ${index}: Invalid type "${shape.type}"`);
    return { shape: fixed, errors, warnings };
  }

  // 2. 验证和修正坐标
  if (typeof fixed.x !== "number" || isNaN(fixed.x)) {
    fixed.x = CANVAS_WIDTH / 2;
    warnings.push(`Shape ${index}: Invalid x, set to center`);
  }
  if (typeof fixed.y !== "number" || isNaN(fixed.y)) {
    fixed.y = CANVAS_HEIGHT / 2;
    warnings.push(`Shape ${index}: Invalid y, set to center`);
  }

  // 3. 验证和修正尺寸
  const width = fixed.width ?? 100;
  const height = fixed.height ?? 100;

  if (width <= 0) {
    fixed.width = 100;
    warnings.push(`Shape ${index}: Invalid width, set to 100`);
  }
  if (height <= 0) {
    fixed.height = 100;
    warnings.push(`Shape ${index}: Invalid height, set to 100`);
  }

  // 4. 确保形状在画布范围内
  const maxX = CANVAS_WIDTH - PADDING;
  const maxY = CANVAS_HEIGHT - PADDING;

  // 如果形状超出右边界，向左移动
  if (fixed.x + (fixed.width ?? 0) > maxX) {
    const overflow = fixed.x + (fixed.width ?? 0) - maxX;
    fixed.x = Math.max(PADDING, fixed.x - overflow);
    warnings.push(`Shape ${index}: Moved left to fit canvas`);
  }

  // 如果形状超出下边界，向上移动
  if (fixed.y + (fixed.height ?? 0) > maxY) {
    const overflow = fixed.y + (fixed.height ?? 0) - maxY;
    fixed.y = Math.max(PADDING, fixed.y - overflow);
    warnings.push(`Shape ${index}: Moved up to fit canvas`);
  }

  // 如果形状超出左边界
  if (fixed.x < PADDING) {
    fixed.x = PADDING;
    warnings.push(`Shape ${index}: Moved right to fit canvas`);
  }

  // 如果形状超出上边界
  if (fixed.y < PADDING) {
    fixed.y = PADDING;
    warnings.push(`Shape ${index}: Moved down to fit canvas`);
  }

  // 5. 验证颜色
  if (fixed.color && !VALID_COLORS.has(fixed.color)) {
    warnings.push(`Shape ${index}: Invalid color "${fixed.color}", using black`);
    fixed.color = "black";
  }

  // 6. 验证 line 和 freehand 的 points
  if ((shape.type === "line" || shape.type === "freehand") && shape.points) {
    if (!Array.isArray(shape.points) || shape.points.length < 2) {
      errors.push(`Shape ${index}: Line/freehand needs at least 2 points`);
    } else {
      // 验证每个点
      fixed.points = shape.points.map((pt, i) => {
        const fixedPt = { ...pt };
        if (typeof fixedPt.x !== "number" || isNaN(fixedPt.x)) {
          fixedPt.x = 0;
          warnings.push(`Shape ${index}, point ${i}: Invalid x`);
        }
        if (typeof fixedPt.y !== "number" || isNaN(fixedPt.y)) {
          fixedPt.y = 0;
          warnings.push(`Shape ${index}, point ${i}: Invalid y`);
        }
        return fixedPt;
      });
    }
  }

  // 7. 验证 text 类型
  if (shape.type === "text") {
    if (!shape.text || typeof shape.text !== "string") {
      fixed.text = "";
      warnings.push(`Shape ${index}: Empty text`);
    }
  }

  return { shape: fixed, errors, warnings };
}

/**
 * 验证并修正整个形状数组
 */
export function validateShapes(shapes: unknown): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const validShapes: DrawingShape[] = [];

  // 检查是否为数组
  if (!Array.isArray(shapes)) {
    return {
      valid: false,
      shapes: [],
      errors: ["Shapes must be an array"],
      warnings: [],
    };
  }

  // 检查是否为空
  if (shapes.length === 0) {
    return {
      valid: true,
      shapes: [],
      errors: [],
      warnings: ["Empty shapes array"],
    };
  }

  // 验证每个形状
  for (let i = 0; i < shapes.length; i++) {
    const shape = shapes[i] as DrawingShape;

    // 基本类型检查
    if (!shape || typeof shape !== "object") {
      errors.push(`Shape ${i}: Invalid shape object`);
      continue;
    }

    if (!shape.type) {
      errors.push(`Shape ${i}: Missing type`);
      continue;
    }

    const result = validateAndFixShape(shape, i);
    errors.push(...result.errors);
    warnings.push(...result.warnings);

    // 只有没有严重错误的形状才添加
    if (result.errors.length === 0) {
      validShapes.push(result.shape);
    }
  }

  return {
    valid: errors.length === 0,
    shapes: validShapes,
    errors,
    warnings,
  };
}

/**
 * 自动缩放形状以适应画布
 */
export function autoScaleShapes(shapes: DrawingShape[]): DrawingShape[] {
  if (shapes.length === 0) return shapes;

  // 计算当前边界
  let minX = Infinity, minY = Infinity;
  let maxX = -Infinity, maxY = -Infinity;

  for (const shape of shapes) {
    minX = Math.min(minX, shape.x);
    minY = Math.min(minY, shape.y);
    maxX = Math.max(maxX, shape.x + (shape.width ?? 0));
    maxY = Math.max(maxY, shape.y + (shape.height ?? 0));
  }

  const currentWidth = maxX - minX;
  const currentHeight = maxY - minY;

  // 如果已经在范围内，不需要缩放
  const availableWidth = CANVAS_WIDTH - 2 * PADDING;
  const availableHeight = CANVAS_HEIGHT - 2 * PADDING;

  if (currentWidth <= availableWidth && currentHeight <= availableHeight) {
    // 只需要居中
    const offsetX = (CANVAS_WIDTH - currentWidth) / 2 - minX;
    const offsetY = (CANVAS_HEIGHT - currentHeight) / 2 - minY;

    return shapes.map(shape => ({
      ...shape,
      x: shape.x + offsetX,
      y: shape.y + offsetY,
      points: shape.points?.map(p => ({ x: p.x, y: p.y })),
    }));
  }

  // 计算缩放比例
  const scaleX = availableWidth / currentWidth;
  const scaleY = availableHeight / currentHeight;
  const scale = Math.min(scaleX, scaleY, 1); // 不放大，只缩小

  // 缩放并居中
  const scaledWidth = currentWidth * scale;
  const scaledHeight = currentHeight * scale;
  const offsetX = (CANVAS_WIDTH - scaledWidth) / 2;
  const offsetY = (CANVAS_HEIGHT - scaledHeight) / 2;

  return shapes.map(shape => ({
    ...shape,
    x: (shape.x - minX) * scale + offsetX,
    y: (shape.y - minY) * scale + offsetY,
    width: shape.width ? shape.width * scale : undefined,
    height: shape.height ? shape.height * scale : undefined,
    points: shape.points?.map(p => ({
      x: p.x * scale,
      y: p.y * scale,
    })),
  }));
}

/**
 * 完整的验证和修正流程
 */
export function processShapes(shapes: unknown): {
  shapes: DrawingShape[];
  errors: string[];
  warnings: string[];
} {
  // 1. 基础验证和修正
  const validation = validateShapes(shapes);

  if (validation.shapes.length === 0) {
    return {
      shapes: [],
      errors: validation.errors,
      warnings: validation.warnings,
    };
  }

  // 2. 自动缩放以适应画布
  const scaledShapes = autoScaleShapes(validation.shapes);

  return {
    shapes: scaledShapes,
    errors: validation.errors,
    warnings: validation.warnings,
  };
}
