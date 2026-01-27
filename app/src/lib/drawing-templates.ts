/**
 * Drawing Templates Library
 *
 * 预设模板库，AI 只需提供内容，即可生成完整的图形。
 * 注意：使用 line 类型画连接线，因为 arrow 类型在 tldraw 中有自动调整行为。
 */

import type { DrawingShape } from "@/components/drawing-canvas/TldrawCanvas";

// 颜色轮换
const COLORS = ["green", "orange", "violet", "red", "blue", "light-green", "light-blue"];

/**
 * 生成流程图
 * @param steps 步骤列表，每个步骤包含 label 和可选的 type
 */
export function generateFlowchart(
  steps: Array<{ label: string; type?: "start" | "end" | "process" | "decision" }>
): DrawingShape[] {
  const shapes: DrawingShape[] = [];
  const nodeWidth = 140;
  const nodeHeight = 50;
  const spacing = 50;
  const startX = 330;
  const centerX = startX + nodeWidth / 2;
  let currentY = 30;

  steps.forEach((step, index) => {
    const type = step.type || (index === 0 ? "start" : index === steps.length - 1 ? "end" : "process");

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
      x: startX,
      y: currentY,
      width: nodeWidth,
      height: height,
      color,
    });

    // 添加文字（居中）
    const textX = startX + 20;
    shapes.push({
      type: "text",
      x: textX,
      y: currentY + height / 3,
      text: step.label,
      color: "black",
    });

    // 添加连接线（使用 line 类型，因为 arrow 类型有问题）
    if (index < steps.length - 1) {
      const lineStartY = currentY + height;
      const lineEndY = lineStartY + spacing;

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

      // 箭头头部（小三角形）
      shapes.push({
        type: "line",
        x: centerX,
        y: lineEndY - 10,
        points: [
          { x: -6, y: -10 },
          { x: 0, y: 0 },
          { x: 6, y: -10 },
        ],
        color: "black",
      });
    }

    currentY += height + spacing;
  });

  return shapes;
}

/**
 * 生成思维导图
 * @param center 中心主题
 * @param branches 分支列表
 */
export function generateMindmap(
  center: string,
  branches: string[]
): DrawingShape[] {
  const shapes: DrawingShape[] = [];
  const centerX = 370;
  const centerY = 270;
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
    x: centerX - center.length * 6,
    y: centerY - 8,
    text: center,
    color: "black",
  });

  // 分支节点
  const angleStep = (2 * Math.PI) / branches.length;

  branches.forEach((branch, index) => {
    const angle = -Math.PI / 2 + index * angleStep;
    const branchX = centerX + Math.cos(angle) * radius;
    const branchY = centerY + Math.sin(angle) * radius;

    // 连接线
    shapes.push({
      type: "line",
      x: centerX,
      y: centerY,
      points: [
        { x: 0, y: 0 },
        { x: branchX - centerX, y: branchY - centerY },
      ],
      color: "grey",
    });

    // 分支节点
    shapes.push({
      type: "rectangle",
      x: branchX - branchWidth / 2,
      y: branchY - branchHeight / 2,
      width: branchWidth,
      height: branchHeight,
      color: COLORS[index % COLORS.length],
    });

    // 分支文字
    shapes.push({
      type: "text",
      x: branchX - branch.length * 5,
      y: branchY - 6,
      text: branch,
      color: "black",
    });
  });

  return shapes;
}

/**
 * 生成对比图
 * @param left 左侧内容
 * @param right 右侧内容
 * @param leftTitle 左侧标题
 * @param rightTitle 右侧标题
 */
export function generateComparison(
  leftTitle: string,
  rightTitle: string,
  leftItems: string[],
  rightItems: string[]
): DrawingShape[] {
  const shapes: DrawingShape[] = [];

  // 左侧云朵
  shapes.push({
    type: "cloud",
    x: 50,
    y: 80,
    width: 200,
    height: 100,
    color: "blue",
  });
  shapes.push({
    type: "text",
    x: 100,
    y: 120,
    text: leftTitle,
    color: "black",
  });

  // 右侧云朵
  shapes.push({
    type: "cloud",
    x: 350,
    y: 80,
    width: 200,
    height: 100,
    color: "green",
  });
  shapes.push({
    type: "text",
    x: 400,
    y: 120,
    text: rightTitle,
    color: "black",
  });

  // VS 文字
  shapes.push({
    type: "text",
    x: 280,
    y: 120,
    text: "VS",
    color: "orange",
  });

  // 左侧列表
  leftItems.forEach((item, index) => {
    shapes.push({
      type: "text",
      x: 60,
      y: 200 + index * 35,
      text: `• ${item}`,
      color: "black",
    });
  });

  // 右侧列表
  rightItems.forEach((item, index) => {
    shapes.push({
      type: "text",
      x: 360,
      y: 200 + index * 35,
      text: `• ${item}`,
      color: "black",
    });
  });

  return shapes;
}

/**
 * 生成正误对比图
 * @param correct 正确内容
 * @param wrong 错误内容
 */
export function generateCorrectWrong(
  correct: string,
  wrong: string
): DrawingShape[] {
  return [
    // 正确部分
    { type: "check-box", x: 50, y: 80, width: 50, height: 50, color: "green" },
    { type: "text", x: 120, y: 95, text: "正确做法", color: "green" },
    { type: "rectangle", x: 120, y: 130, width: 550, height: 80, color: "light-green" },
    { type: "text", x: 140, y: 160, text: correct, color: "black" },

    // 错误部分
    { type: "x-box", x: 50, y: 250, width: 50, height: 50, color: "red" },
    { type: "text", x: 120, y: 265, text: "错误做法", color: "red" },
    { type: "rectangle", x: 120, y: 300, width: 550, height: 80, color: "light-red" },
    { type: "text", x: 140, y: 330, text: wrong, color: "black" },
  ];
}

/**
 * 生成重点标注图
 * @param points 重点列表
 */
export function generateKeyPoints(points: string[]): DrawingShape[] {
  const shapes: DrawingShape[] = [];

  points.forEach((point, index) => {
    const y = 60 + index * 100;

    shapes.push({
      type: "star",
      x: 50,
      y: y,
      width: 60,
      height: 60,
      color: "orange",
    });

    shapes.push({
      type: "text",
      x: 130,
      y: y + 20,
      text: `重点${index + 1}：${point}`,
      color: "black",
    });
  });

  return shapes;
}

/**
 * 生成几何图形
 */
export const geometryTemplates = {
  // 等腰三角形
  isoscelesTriangle: (): DrawingShape[] => [
    { type: "triangle", x: 250, y: 150, width: 200, height: 180, color: "blue" },
    { type: "text", x: 340, y: 120, text: "A", color: "black" },
    { type: "text", x: 230, y: 340, text: "B", color: "black" },
    { type: "text", x: 450, y: 340, text: "C", color: "black" },
    { type: "text", x: 260, y: 230, text: "腰", color: "red" },
    { type: "text", x: 420, y: 230, text: "腰", color: "red" },
    { type: "text", x: 330, y: 360, text: "底边", color: "red" },
  ],

  // 直角三角形
  rightTriangle: (): DrawingShape[] => [
    {
      type: "line",
      x: 150,
      y: 100,
      points: [
        { x: 0, y: 0 },
        { x: 0, y: 200 },
        { x: 250, y: 200 },
        { x: 0, y: 0 },
      ],
      color: "blue",
    },
    { type: "rectangle", x: 150, y: 280, width: 20, height: 20, color: "red" },
    { type: "text", x: 130, y: 80, text: "A", color: "black" },
    { type: "text", x: 130, y: 310, text: "B", color: "black" },
    { type: "text", x: 410, y: 310, text: "C", color: "black" },
  ],

  // 圆
  circle: (label?: string): DrawingShape[] => [
    { type: "ellipse", x: 250, y: 150, width: 200, height: 200, color: "blue" },
    { type: "text", x: 340, y: 240, text: "O", color: "black" },
    { type: "line", x: 350, y: 250, points: [{ x: 0, y: 0 }, { x: 100, y: 0 }], color: "red" },
    { type: "text", x: 390, y: 230, text: "r", color: "red" },
    ...(label ? [{ type: "text" as const, x: 300, y: 380, text: label, color: "black" }] : []),
  ],

  // 平行四边形
  parallelogram: (): DrawingShape[] => [
    {
      type: "line",
      x: 100,
      y: 150,
      points: [
        { x: 80, y: 0 },
        { x: 320, y: 0 },
        { x: 240, y: 150 },
        { x: 0, y: 150 },
        { x: 80, y: 0 },
      ],
      color: "blue",
    },
    { type: "text", x: 170, y: 130, text: "A", color: "black" },
    { type: "text", x: 420, y: 130, text: "B", color: "black" },
    { type: "text", x: 340, y: 310, text: "C", color: "black" },
    { type: "text", x: 80, y: 310, text: "D", color: "black" },
  ],

  // 坐标系（使用 line 类型，因为 arrow 类型有自动调整行为）
  coordinateSystem: (): DrawingShape[] => [
    // X 轴（水平线）
    { type: "line", x: 50, y: 300, points: [{ x: 0, y: 0 }, { x: 400, y: 0 }], color: "black" },
    // X 轴箭头头部
    { type: "line", x: 450, y: 300, points: [{ x: -10, y: -6 }, { x: 0, y: 0 }, { x: -10, y: 6 }], color: "black" },
    // Y 轴（垂直线）
    { type: "line", x: 250, y: 450, points: [{ x: 0, y: 0 }, { x: 0, y: -400 }], color: "black" },
    // Y 轴箭头头部
    { type: "line", x: 250, y: 50, points: [{ x: -6, y: 10 }, { x: 0, y: 0 }, { x: 6, y: 10 }], color: "black" },
    { type: "text", x: 460, y: 295, text: "x", color: "black" },
    { type: "text", x: 255, y: 30, text: "y", color: "black" },
    { type: "text", x: 230, y: 310, text: "O", color: "black" },
  ],
};

/**
 * 根据模板名称和参数生成图形
 */
export function generateFromTemplate(
  templateName: string,
  params: Record<string, unknown>
): DrawingShape[] | null {
  switch (templateName) {
    case "flowchart":
      return generateFlowchart(params.steps as Array<{ label: string; type?: "start" | "end" | "process" | "decision" }>);

    case "mindmap":
      return generateMindmap(
        params.center as string,
        params.branches as string[]
      );

    case "comparison":
      return generateComparison(
        params.leftTitle as string,
        params.rightTitle as string,
        params.leftItems as string[],
        params.rightItems as string[]
      );

    case "correct-wrong":
      return generateCorrectWrong(
        params.correct as string,
        params.wrong as string
      );

    case "key-points":
      return generateKeyPoints(params.points as string[]);

    case "isosceles-triangle":
      return geometryTemplates.isoscelesTriangle();

    case "right-triangle":
      return geometryTemplates.rightTriangle();

    case "circle":
      return geometryTemplates.circle(params.label as string | undefined);

    case "parallelogram":
      return geometryTemplates.parallelogram();

    case "coordinate-system":
      return geometryTemplates.coordinateSystem();

    default:
      return null;
  }
}

// 导出模板列表供 AI 参考
export const TEMPLATE_LIST = `
## 可用的预设模板

### 1. flowchart - 流程图
参数：steps: [{label: "步骤名", type?: "start"|"end"|"process"|"decision"}]
示例：generateFromTemplate("flowchart", {steps: [{label:"开始"}, {label:"处理"}, {label:"结束"}]})

### 2. mindmap - 思维导图
参数：center: "中心主题", branches: ["分支1", "分支2", ...]
示例：generateFromTemplate("mindmap", {center: "数学", branches: ["代数", "几何", "统计"]})

### 3. comparison - 对比图
参数：leftTitle, rightTitle, leftItems: [], rightItems: []
示例：generateFromTemplate("comparison", {leftTitle: "优点", rightTitle: "缺点", leftItems: ["快"], rightItems: ["贵"]})

### 4. correct-wrong - 正误对比
参数：correct: "正确内容", wrong: "错误内容"

### 5. key-points - 重点标注
参数：points: ["重点1", "重点2", ...]

### 6. 几何图形模板
- isosceles-triangle: 等腰三角形
- right-triangle: 直角三角形
- circle: 圆（可选 label 参数）
- parallelogram: 平行四边形
- coordinate-system: 坐标系
`;
