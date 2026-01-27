/**
 * Whiteboard DSL Type Definitions
 *
 * 高层数学教学专用指令类型定义
 */

import type { DrawingShape } from "@/components/drawing-canvas/TldrawCanvas";

// ============ 基础类型 ============

/** 2D 点 */
export interface Point {
  x: number;
  y: number;
}

/** 带标签的点 */
export interface LabeledPoint extends Point {
  label?: string;
}

/** 数值范围 */
export type Range = [number, number];

/** 颜色 */
export type DSLColor =
  | "red"
  | "blue"
  | "green"
  | "yellow"
  | "orange"
  | "violet"
  | "black"
  | "grey"
  | "light-red"
  | "light-blue"
  | "light-green"
  | "light-violet";

// ============ 坐标系与函数命令 ============

/** 绘制坐标平面 */
export interface DrawCoordinatePlaneParams {
  xRange: Range;
  yRange: Range;
  gridLines?: boolean;
  labels?: boolean;
  origin?: Point; // 画布上原点位置，默认居中
}

/** 绘制函数图像 */
export interface PlotFunctionParams {
  expression: string; // 如 "y = x^2" 或 "x^2"
  color?: DSLColor;
  domain?: Range; // x 的定义域，默认使用坐标系范围
  points?: LabeledPoint[]; // 标记的特殊点
  dashed?: boolean;
}

// ============ 几何图形命令 ============

/** 三角形顶点 */
export interface TriangleVertices {
  A: Point;
  B: Point;
  C: Point;
}

/** 构造三角形 */
export interface ConstructTriangleParams {
  vertices: TriangleVertices;
  labels?: boolean; // 是否显示顶点标签
  showAngles?: boolean; // 是否显示角度
  showSides?: boolean; // 是否显示边长标注
  color?: DSLColor;
}

/** 构造圆 */
export interface ConstructCircleParams {
  center: Point;
  radius: number;
  label?: string;
  showCenter?: boolean;
  showRadius?: boolean;
  color?: DSLColor;
}

/** 绘制角 */
export interface DrawAngleParams {
  vertex: Point;
  ray1End: Point;
  ray2End: Point;
  label?: string;
  isRightAngle?: boolean;
  showArc?: boolean;
  color?: DSLColor;
}

/** 绘制线段 */
export interface DrawLineSegmentParams {
  start: Point;
  end: Point;
  label?: string;
  color?: DSLColor;
  dashed?: boolean;
}

// ============ 教学图表命令 ============

/** 流程图步骤 */
export interface FlowchartStep {
  id: string;
  label: string;
  type?: "start" | "end" | "process" | "decision";
}

/** 流程图连接 */
export interface FlowchartConnection {
  from: string;
  to: string;
  label?: string;
}

/** 创建流程图 */
export interface CreateFlowchartParams {
  steps: FlowchartStep[];
  connections?: FlowchartConnection[];
  direction?: "vertical" | "horizontal";
}

/** 思维导图分支 */
export interface MindmapBranch {
  label: string;
  children?: MindmapBranch[];
}

/** 创建思维导图 */
export interface CreateMindmapParams {
  center: string;
  branches: (string | MindmapBranch)[];
}

/** 正误对比 */
export interface ShowCorrectWrongParams {
  correct: string;
  wrong: string;
  correctTitle?: string;
  wrongTitle?: string;
}

// ============ 标注命令 ============

/** 文字样式 */
export interface TextStyle {
  size?: "s" | "m" | "l";
  bold?: boolean;
}

/** 添加标签 */
export interface AddLabelParams {
  text: string;
  position: Point;
  style?: TextStyle;
  color?: DSLColor;
}

/** 添加箭头 */
export interface AddArrowParams {
  from: Point;
  to: Point;
  label?: string;
  color?: DSLColor;
}

// ============ DSL 命令联合类型 ============

export type DSLCommand =
  | { command: "DrawCoordinatePlane"; params: DrawCoordinatePlaneParams }
  | { command: "PlotFunction"; params: PlotFunctionParams }
  | { command: "ConstructTriangle"; params: ConstructTriangleParams }
  | { command: "ConstructCircle"; params: ConstructCircleParams }
  | { command: "DrawAngle"; params: DrawAngleParams }
  | { command: "DrawLineSegment"; params: DrawLineSegmentParams }
  | { command: "CreateFlowchart"; params: CreateFlowchartParams }
  | { command: "CreateMindmap"; params: CreateMindmapParams }
  | { command: "ShowCorrectWrong"; params: ShowCorrectWrongParams }
  | { command: "AddLabel"; params: AddLabelParams }
  | { command: "AddArrow"; params: AddArrowParams };

/** DSL 脚本 */
export interface DSLScript {
  commands: DSLCommand[];
  /** 画布尺寸，默认 800x600 */
  canvasSize?: { width: number; height: number };
}

// ============ 编译结果 ============

export interface CompileResult {
  success: boolean;
  shapes: DrawingShape[];
  errors?: string[];
  /** 编译过程中的坐标系上下文 */
  coordinateContext?: CoordinateContext;
}

/** 坐标系上下文（用于函数绘制） */
export interface CoordinateContext {
  xRange: Range;
  yRange: Range;
  /** 画布上的原点位置 */
  origin: Point;
  /** 每单位对应的像素数 */
  scale: { x: number; y: number };
}

// ============ 命令处理器类型 ============

export type CommandHandler<T> = (
  params: T,
  context: CompilerContext
) => DrawingShape[];

/** 编译器上下文 */
export interface CompilerContext {
  canvasSize: { width: number; height: number };
  coordinateContext?: CoordinateContext;
}
