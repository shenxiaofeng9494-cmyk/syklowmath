/**
 * Diagram Commands
 *
 * 流程图、思维导图、对比图等教学图表
 */

import type { DrawingShape } from "@/components/drawing-canvas/TldrawCanvas";
import type {
  CreateFlowchartParams,
  CreateMindmapParams,
  ShowCorrectWrongParams,
  AddLabelParams,
  AddArrowParams,
  CompilerContext,
  FlowchartStep,
} from "../types";
import { verticalLayout, radialLayout, estimateTextWidth } from "../layout";

// 颜色轮换
const BRANCH_COLORS = [
  "green",
  "orange",
  "violet",
  "red",
  "blue",
  "light-green",
  "light-blue",
] as const;

/**
 * 创建流程图
 */
export function createFlowchart(
  params: CreateFlowchartParams,
  context: CompilerContext
): DrawingShape[] {
  const shapes: DrawingShape[] = [];
  const { steps } = params;

  const nodeWidth = 140;
  const nodeHeight = 50;
  const spacing = 50;

  // 计算起始位置（居中）
  const totalHeight = steps.length * nodeHeight + (steps.length - 1) * spacing;
  const startY = (context.canvasSize.height - totalHeight) / 2;
  const centerX = context.canvasSize.width / 2;

  // 计算每个节点的位置
  const positions = verticalLayout(
    steps.map(() => ({ width: nodeWidth, height: nodeHeight })),
    spacing,
    startY,
    centerX
  );

  steps.forEach((step, index) => {
    const pos = positions[index];
    const type = step.type || inferStepType(index, steps.length);

    // 确定形状和颜色
    let shapeType: DrawingShape["type"];
    let color: string;
    let height = nodeHeight;

    switch (type) {
      case "start":
        shapeType = "ellipse";
        color = "green";
        break;
      case "end":
        shapeType = "ellipse";
        color = "red";
        break;
      case "decision":
        shapeType = "diamond";
        color = "orange";
        height = nodeHeight * 1.4;
        break;
      default:
        shapeType = "rectangle";
        color = "blue";
    }

    // 添加形状
    shapes.push({
      type: shapeType,
      x: pos.x,
      y: pos.y,
      width: nodeWidth,
      height: height,
      color,
    });

    // 添加文字
    shapes.push({
      type: "text",
      x: pos.x + 20,
      y: pos.y + height / 3,
      text: step.label,
      color: "black",
    });

    // 添加连接线（到下一个节点）
    if (index < steps.length - 1) {
      const lineStartY = pos.y + height;
      const nextPos = positions[index + 1];

      // 垂直线
      shapes.push({
        type: "line",
        x: centerX,
        y: lineStartY,
        points: [
          { x: 0, y: 0 },
          { x: 0, y: spacing - 10 },
        ],
        color: "black",
      });

      // 箭头头部
      shapes.push({
        type: "line",
        x: centerX,
        y: nextPos.y - 10,
        points: [
          { x: -6, y: -10 },
          { x: 0, y: 0 },
          { x: 6, y: -10 },
        ],
        color: "black",
      });
    }
  });

  return shapes;
}

/**
 * 创建思维导图
 */
export function createMindmap(
  params: CreateMindmapParams,
  context: CompilerContext
): DrawingShape[] {
  const shapes: DrawingShape[] = [];
  const { center, branches } = params;

  const centerX = context.canvasSize.width / 2;
  const centerY = context.canvasSize.height / 2;
  const centerWidth = 140;
  const centerHeight = 80;
  const branchWidth = 120;
  const branchHeight = 40;
  const radius = 180;

  // 中心节点
  shapes.push({
    type: "ellipse",
    x: centerX - centerWidth / 2,
    y: centerY - centerHeight / 2,
    width: centerWidth,
    height: centerHeight,
    color: "blue",
  });

  shapes.push({
    type: "text",
    x: centerX - estimateTextWidth(center) / 2,
    y: centerY - 8,
    text: center,
    color: "black",
  });

  // 分支节点位置
  const branchPositions = radialLayout(branches.length, { x: centerX, y: centerY }, radius);

  branches.forEach((branch, index) => {
    const branchLabel = typeof branch === "string" ? branch : branch.label;
    const pos = branchPositions[index];
    const color = BRANCH_COLORS[index % BRANCH_COLORS.length];

    // 连接线
    shapes.push({
      type: "line",
      x: centerX,
      y: centerY,
      points: [
        { x: 0, y: 0 },
        { x: pos.x - centerX, y: pos.y - centerY },
      ],
      color: "grey",
    });

    // 分支节点
    shapes.push({
      type: "rectangle",
      x: pos.x - branchWidth / 2,
      y: pos.y - branchHeight / 2,
      width: branchWidth,
      height: branchHeight,
      color,
    });

    // 分支文字
    shapes.push({
      type: "text",
      x: pos.x - estimateTextWidth(branchLabel) / 2,
      y: pos.y - 6,
      text: branchLabel,
      color: "black",
    });
  });

  return shapes;
}

/**
 * 正误对比图
 */
export function showCorrectWrong(
  params: ShowCorrectWrongParams,
  _context: CompilerContext // eslint-disable-line @typescript-eslint/no-unused-vars
): DrawingShape[] {
  const {
    correct,
    wrong,
    correctTitle = "正确做法",
    wrongTitle = "错误做法",
  } = params;

  return [
    // 正确部分
    { type: "check-box", x: 50, y: 80, width: 50, height: 50, color: "green" },
    { type: "text", x: 120, y: 95, text: correctTitle, color: "green" },
    { type: "rectangle", x: 120, y: 130, width: 550, height: 80, color: "light-green" },
    { type: "text", x: 140, y: 160, text: correct, color: "black" },

    // 错误部分
    { type: "x-box", x: 50, y: 250, width: 50, height: 50, color: "red" },
    { type: "text", x: 120, y: 265, text: wrongTitle, color: "red" },
    { type: "rectangle", x: 120, y: 300, width: 550, height: 80, color: "light-red" },
    { type: "text", x: 140, y: 330, text: wrong, color: "black" },
  ];
}

/**
 * 添加标签
 */
export function addLabel(
  params: AddLabelParams,
  _context: CompilerContext // eslint-disable-line @typescript-eslint/no-unused-vars
): DrawingShape[] {
  const { text, position, color = "black" } = params;

  return [
    {
      type: "text",
      x: position.x,
      y: position.y,
      text,
      color,
    },
  ];
}

/**
 * 添加箭头
 */
export function addArrow(
  params: AddArrowParams,
  _context: CompilerContext // eslint-disable-line @typescript-eslint/no-unused-vars
): DrawingShape[] {
  const shapes: DrawingShape[] = [];
  const { from, to, label, color = "black" } = params;

  // 箭头线
  shapes.push({
    type: "line",
    x: from.x,
    y: from.y,
    points: [
      { x: 0, y: 0 },
      { x: to.x - from.x, y: to.y - from.y },
    ],
    color,
  });

  // 箭头头部
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  const arrowSize = 10;

  if (len > 0) {
    const ux = dx / len;
    const uy = dy / len;
    const perpX = -uy * arrowSize * 0.6;
    const perpY = ux * arrowSize * 0.6;

    shapes.push({
      type: "line",
      x: to.x,
      y: to.y,
      points: [
        { x: -ux * arrowSize + perpX, y: -uy * arrowSize + perpY },
        { x: 0, y: 0 },
        { x: -ux * arrowSize - perpX, y: -uy * arrowSize - perpY },
      ],
      color,
    });
  }

  // 标签
  if (label) {
    const midX = (from.x + to.x) / 2;
    const midY = (from.y + to.y) / 2;

    shapes.push({
      type: "text",
      x: midX + 5,
      y: midY - 15,
      text: label,
      color,
    });
  }

  return shapes;
}

// ============ 辅助函数 ============

/**
 * 推断步骤类型
 */
function inferStepType(
  index: number,
  total: number
): FlowchartStep["type"] {
  if (index === 0) return "start";
  if (index === total - 1) return "end";
  return "process";
}
