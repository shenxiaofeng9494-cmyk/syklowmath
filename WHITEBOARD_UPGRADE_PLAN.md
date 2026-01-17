# MathTalkTV 白板升级方案

## 一、现状分析

### 当前架构

```
学生语音 → OpenAI Realtime API → use_whiteboard(elements=[...]) → 前端渲染
                                        ↓
                              LLM 直接输出坐标（不稳定）
```

### 存在的问题

1. **坐标不稳定**：LLM 对几何布局、对齐、比例把握不好
2. **无状态管理**：每次都是全量渲染，无法增量更新
3. **缺后处理**：没有对齐、分组、绑定等能力
4. **线段弱约束**：一个 line 画闭合图形容易出错

### 你的优势（保留）

1. OpenAI Realtime API 的实时语音交互
2. 边讲边画的教学体验
3. 现有的工具指南系统（GUIDE.md）
4. 已有的 formula/graph/drawing 三种类型

---

## 二、目标架构

```
┌─────────────────────────────────────────────────────────────────────┐
│                        OpenAI Realtime API                          │
│  工具调用：use_whiteboard(content_type="drawing", diagram_ir={...}) │
└─────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────┐
│                    Next.js API (新增 /api/whiteboard)                │
│  1. 接收 Diagram IR                                                  │
│  2. 几何 Renderer 计算精确坐标                                        │
│  3. 生成 Excalidraw elements                                         │
│  4. WebSocket 广播更新                                               │
└─────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────┐
│                          前端 ExcalidrawCanvas                       │
│  1. WebSocket 监听 scene 更新                                        │
│  2. convertToExcalidrawElements + updateScene                       │
│  3. 增量更新，保持 ID 稳定                                            │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 三、核心改动

### 3.1 Diagram IR 设计（新增）

用于几何图形的中间表示，让 LLM 描述"画什么"而不是"怎么画"。

```typescript
// src/types/diagram-ir.ts

// 几何图形的中间表示
export interface DiagramIR {
  type: "geometry";
  title?: string;

  // 画布配置
  canvas?: {
    gridStep?: number;    // 网格步长，默认 40
    padding?: number;     // 边距，默认 80
  };

  // 节点（点、标签）
  nodes: DiagramNode[];

  // 边（线段、箭头）
  edges?: DiagramEdge[];

  // 约束（几何关系）
  constraints?: DiagramConstraint[];

  // 注释（额外文字）
  annotations?: DiagramAnnotation[];
}

// 节点类型
export interface DiagramNode {
  id: string;
  type: "point";
  label?: string;
  labelAnchor?: "top" | "bottom" | "left" | "right" | "topLeft" | "topRight" | "bottomLeft" | "bottomRight";
}

// 边类型
export interface DiagramEdge {
  type: "segment" | "ray" | "line" | "arc";
  from: string;   // 节点 ID
  to: string;     // 节点 ID
  style?: {
    strokeColor?: string;
    strokeWidth?: number;
    dashed?: boolean;
  };
}

// 约束类型
export type DiagramConstraint =
  | { type: "triangle"; vertices: [string, string, string] }
  | { type: "isosceles"; apex: string; base: [string, string] }
  | { type: "equilateral"; vertices: [string, string, string] }
  | { type: "right_angle"; vertex: string; rays: [string, string] }
  | { type: "circle"; center: string; radius: number }
  | { type: "circle_through"; center: string; point: string }
  | { type: "parallel"; line1: [string, string]; line2: [string, string] }
  | { type: "perpendicular"; line1: [string, string]; line2: [string, string] }
  | { type: "midpoint"; point: string; of: [string, string] }
  | { type: "angle_bisector"; vertex: string; rays: [string, string]; bisector: string }
  | { type: "rectangle"; vertices: [string, string, string, string] }
  | { type: "square"; vertices: [string, string, string, string] }
  | { type: "parallelogram"; vertices: [string, string, string, string] };

// 注释
export interface DiagramAnnotation {
  type: "text" | "length" | "angle";
  text?: string;
  attachTo?: string;      // 节点 ID
  position?: { x: number; y: number };  // 绝对位置
  offset?: [number, number];  // 相对 attachTo 的偏移
}
```

### 3.2 几何 Renderer（新增）

将 Diagram IR 转换为精确的 Excalidraw elements。

```typescript
// src/lib/geometry-renderer/index.ts

import { DiagramIR, DiagramNode, DiagramEdge, DiagramConstraint } from "@/types/diagram-ir";
import { ExcalidrawElementSkeleton } from "@/types/excalidraw";

interface RenderResult {
  elements: ExcalidrawElementSkeleton[];
  nodePositions: Map<string, { x: number; y: number }>;
}

// 默认配置
const DEFAULT_CANVAS = {
  gridStep: 40,
  padding: 80,
  width: 600,
  height: 400,
  centerX: 300,
  centerY: 200,
};

export function renderDiagramIR(ir: DiagramIR): RenderResult {
  const canvas = { ...DEFAULT_CANVAS, ...ir.canvas };
  const elements: ExcalidrawElementSkeleton[] = [];
  const nodePositions = new Map<string, { x: number; y: number }>();

  // 1. 根据约束计算节点位置
  calculateNodePositions(ir, nodePositions, canvas);

  // 2. 渲染边（线段）
  for (const edge of ir.edges || []) {
    const edgeElements = renderEdge(edge, nodePositions);
    elements.push(...edgeElements);
  }

  // 3. 渲染节点标签
  for (const node of ir.nodes) {
    if (node.label) {
      const labelElement = renderNodeLabel(node, nodePositions);
      if (labelElement) elements.push(labelElement);
    }
  }

  // 4. 渲染注释
  for (const annotation of ir.annotations || []) {
    const annotationElement = renderAnnotation(annotation, nodePositions);
    if (annotationElement) elements.push(annotationElement);
  }

  return { elements, nodePositions };
}

// 根据约束计算节点位置
function calculateNodePositions(
  ir: DiagramIR,
  positions: Map<string, { x: number; y: number }>,
  canvas: typeof DEFAULT_CANVAS
) {
  // 处理每个约束
  for (const constraint of ir.constraints || []) {
    switch (constraint.type) {
      case "triangle":
        calculateTriangle(constraint.vertices, positions, canvas);
        break;
      case "isosceles":
        calculateIsoscelesTriangle(constraint, positions, canvas);
        break;
      case "right_angle":
        calculateRightAngle(constraint, positions, canvas);
        break;
      case "circle":
      case "circle_through":
        calculateCircle(constraint, positions, canvas);
        break;
      case "rectangle":
      case "square":
      case "parallelogram":
        calculateQuadrilateral(constraint, positions, canvas);
        break;
      // ... 其他约束
    }
  }
}

// 计算等腰三角形
function calculateIsoscelesTriangle(
  constraint: { type: "isosceles"; apex: string; base: [string, string] },
  positions: Map<string, { x: number; y: number }>,
  canvas: typeof DEFAULT_CANVAS
) {
  const [baseLeft, baseRight] = constraint.base;
  const apex = constraint.apex;

  // 底边宽度和高度
  const baseWidth = 200;
  const height = 150;

  // 底边中点在画布中央偏下
  const baseCenterX = canvas.centerX;
  const baseCenterY = canvas.centerY + height / 3;

  // 设置三个顶点
  positions.set(baseLeft, {
    x: roundToGrid(baseCenterX - baseWidth / 2, canvas.gridStep),
    y: roundToGrid(baseCenterY, canvas.gridStep),
  });
  positions.set(baseRight, {
    x: roundToGrid(baseCenterX + baseWidth / 2, canvas.gridStep),
    y: roundToGrid(baseCenterY, canvas.gridStep),
  });
  positions.set(apex, {
    x: roundToGrid(baseCenterX, canvas.gridStep),
    y: roundToGrid(baseCenterY - height, canvas.gridStep),
  });
}

// 计算普通三角形
function calculateTriangle(
  vertices: [string, string, string],
  positions: Map<string, { x: number; y: number }>,
  canvas: typeof DEFAULT_CANVAS
) {
  const [a, b, c] = vertices;

  // 默认三角形布局
  positions.set(a, {
    x: roundToGrid(canvas.centerX - 100, canvas.gridStep),
    y: roundToGrid(canvas.centerY + 80, canvas.gridStep),
  });
  positions.set(b, {
    x: roundToGrid(canvas.centerX + 100, canvas.gridStep),
    y: roundToGrid(canvas.centerY + 80, canvas.gridStep),
  });
  positions.set(c, {
    x: roundToGrid(canvas.centerX, canvas.gridStep),
    y: roundToGrid(canvas.centerY - 80, canvas.gridStep),
  });
}

// 计算直角
function calculateRightAngle(
  constraint: { type: "right_angle"; vertex: string; rays: [string, string] },
  positions: Map<string, { x: number; y: number }>,
  canvas: typeof DEFAULT_CANVAS
) {
  const { vertex, rays } = constraint;
  const [ray1End, ray2End] = rays;

  // 直角顶点
  positions.set(vertex, {
    x: roundToGrid(canvas.centerX - 80, canvas.gridStep),
    y: roundToGrid(canvas.centerY + 80, canvas.gridStep),
  });

  // 水平射线端点
  positions.set(ray1End, {
    x: roundToGrid(canvas.centerX + 120, canvas.gridStep),
    y: roundToGrid(canvas.centerY + 80, canvas.gridStep),
  });

  // 垂直射线端点
  positions.set(ray2End, {
    x: roundToGrid(canvas.centerX - 80, canvas.gridStep),
    y: roundToGrid(canvas.centerY - 100, canvas.gridStep),
  });
}

// 计算圆
function calculateCircle(
  constraint: { type: "circle" | "circle_through"; center: string; radius?: number; point?: string },
  positions: Map<string, { x: number; y: number }>,
  canvas: typeof DEFAULT_CANVAS
) {
  positions.set(constraint.center, {
    x: canvas.centerX,
    y: canvas.centerY,
  });
  // 圆通过 renderCircle 单独处理
}

// 计算四边形
function calculateQuadrilateral(
  constraint: { type: string; vertices: [string, string, string, string] },
  positions: Map<string, { x: number; y: number }>,
  canvas: typeof DEFAULT_CANVAS
) {
  const [a, b, c, d] = constraint.vertices;

  if (constraint.type === "rectangle" || constraint.type === "square") {
    const size = constraint.type === "square" ? 160 : 200;
    const height = constraint.type === "square" ? 160 : 120;

    positions.set(a, { x: canvas.centerX - size / 2, y: canvas.centerY + height / 2 });
    positions.set(b, { x: canvas.centerX + size / 2, y: canvas.centerY + height / 2 });
    positions.set(c, { x: canvas.centerX + size / 2, y: canvas.centerY - height / 2 });
    positions.set(d, { x: canvas.centerX - size / 2, y: canvas.centerY - height / 2 });
  } else if (constraint.type === "parallelogram") {
    const offset = 40;
    positions.set(a, { x: canvas.centerX - 100, y: canvas.centerY + 60 });
    positions.set(b, { x: canvas.centerX + 100, y: canvas.centerY + 60 });
    positions.set(c, { x: canvas.centerX + 100 + offset, y: canvas.centerY - 60 });
    positions.set(d, { x: canvas.centerX - 100 + offset, y: canvas.centerY - 60 });
  }
}

// 渲染边（线段）- 每条边单独一个 line 元素
function renderEdge(
  edge: DiagramEdge,
  positions: Map<string, { x: number; y: number }>
): ExcalidrawElementSkeleton[] {
  const from = positions.get(edge.from);
  const to = positions.get(edge.to);

  if (!from || !to) return [];

  return [{
    type: "line",
    x: from.x,
    y: from.y,
    points: [[0, 0], [to.x - from.x, to.y - from.y]],
    strokeColor: edge.style?.strokeColor || "#1e40af",
    strokeWidth: edge.style?.strokeWidth || 2,
  }];
}

// 渲染节点标签
function renderNodeLabel(
  node: DiagramNode,
  positions: Map<string, { x: number; y: number }>
): ExcalidrawElementSkeleton | null {
  const pos = positions.get(node.id);
  if (!pos || !node.label) return null;

  // 根据 anchor 计算标签偏移
  const offset = getLabelOffset(node.labelAnchor || "bottomLeft");

  return {
    type: "text",
    x: pos.x + offset.x,
    y: pos.y + offset.y,
    text: node.label,
    fontSize: 20,
  };
}

// 根据锚点计算标签偏移
function getLabelOffset(anchor: string): { x: number; y: number } {
  const offsets: Record<string, { x: number; y: number }> = {
    top: { x: -8, y: -30 },
    bottom: { x: -8, y: 15 },
    left: { x: -25, y: -10 },
    right: { x: 15, y: -10 },
    topLeft: { x: -25, y: -25 },
    topRight: { x: 15, y: -25 },
    bottomLeft: { x: -25, y: 15 },
    bottomRight: { x: 15, y: 15 },
  };
  return offsets[anchor] || offsets.bottomLeft;
}

// 渲染注释
function renderAnnotation(
  annotation: DiagramAnnotation,
  positions: Map<string, { x: number; y: number }>
): ExcalidrawElementSkeleton | null {
  if (annotation.type === "text" && annotation.text) {
    let x = annotation.position?.x || 0;
    let y = annotation.position?.y || 0;

    if (annotation.attachTo) {
      const attachPos = positions.get(annotation.attachTo);
      if (attachPos && annotation.offset) {
        x = attachPos.x + annotation.offset[0];
        y = attachPos.y + annotation.offset[1];
      }
    }

    return {
      type: "text",
      x,
      y,
      text: annotation.text,
      fontSize: 18,
    };
  }
  return null;
}

// 对齐到网格
function roundToGrid(value: number, gridStep: number): number {
  return Math.round(value / gridStep) * gridStep;
}
```

### 3.3 白板服务 API（新增）

```typescript
// src/app/api/whiteboard/render/route.ts

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

    // 渲染 IR 为 Excalidraw elements
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
```

### 3.4 工具定义更新

修改 `/api/realtime/route.ts` 中的 `use_whiteboard` 工具：

```typescript
// 更新 TOOLS 中的 use_whiteboard
{
  type: "function",
  name: "use_whiteboard",
  description: "在画板上展示数学公式、函数图像或几何图形。",
  parameters: {
    type: "object",
    properties: {
      content_type: {
        type: "string",
        enum: ["formula", "graph", "drawing"],
        description: "内容类型",
      },
      // formula 类型参数（保持不变）
      latex: { type: "string" },
      steps: { type: "array", items: { type: "string" } },

      // graph 类型参数（保持不变）
      expression: { type: "string" },
      x_range: { type: "array", items: { type: "number" } },
      y_range: { type: "array", items: { type: "number" } },
      points: { type: "array" },

      // drawing 类型：新增 diagram_ir，废弃 elements
      title: { type: "string" },
      diagram_ir: {
        type: "object",
        description: "几何图形的结构化描述（推荐使用）",
        properties: {
          nodes: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                type: { type: "string", enum: ["point"] },
                label: { type: "string" },
                labelAnchor: {
                  type: "string",
                  enum: ["top", "bottom", "left", "right", "topLeft", "topRight", "bottomLeft", "bottomRight"]
                },
              },
              required: ["id", "type"],
            },
          },
          edges: {
            type: "array",
            items: {
              type: "object",
              properties: {
                type: { type: "string", enum: ["segment", "ray", "arc"] },
                from: { type: "string" },
                to: { type: "string" },
              },
              required: ["type", "from", "to"],
            },
          },
          constraints: {
            type: "array",
            description: "几何约束：triangle, isosceles, equilateral, right_angle, circle, rectangle, square, parallelogram 等",
            items: { type: "object" },
          },
          annotations: {
            type: "array",
            items: {
              type: "object",
              properties: {
                type: { type: "string", enum: ["text", "length", "angle"] },
                text: { type: "string" },
                attachTo: { type: "string" },
                offset: { type: "array", items: { type: "number" } },
              },
            },
          },
        },
        required: ["nodes"],
      },
      // 保留 elements 用于向后兼容
      elements: { type: "array" },
    },
    required: ["content_type"],
  },
}
```

### 3.5 工具指南更新

更新 `src/tool-guides/drawing/GUIDE.md`：

```markdown
---
name: drawing
description: use_whiteboard(content_type="drawing") 的详细使用指南
---

# 几何绘图指南（Diagram IR 版本）

## 核心概念

使用 `diagram_ir` 描述几何图形的**结构和约束**，系统会自动计算精确坐标。

**你只需要描述"画什么"，不需要计算坐标！**

## 基本格式

```json
{
  "content_type": "drawing",
  "title": "图形标题",
  "diagram_ir": {
    "nodes": [...],      // 点
    "edges": [...],      // 线段
    "constraints": [...] // 几何约束
  }
}
```

## 示例

### 示例1：等腰三角形 ABC

```json
{
  "content_type": "drawing",
  "title": "等腰三角形",
  "diagram_ir": {
    "nodes": [
      { "id": "A", "type": "point", "label": "A", "labelAnchor": "bottomLeft" },
      { "id": "B", "type": "point", "label": "B", "labelAnchor": "bottomRight" },
      { "id": "C", "type": "point", "label": "C", "labelAnchor": "top" }
    ],
    "edges": [
      { "type": "segment", "from": "A", "to": "B" },
      { "type": "segment", "from": "A", "to": "C" },
      { "type": "segment", "from": "B", "to": "C" }
    ],
    "constraints": [
      { "type": "isosceles", "apex": "C", "base": ["A", "B"] }
    ]
  }
}
```

### 示例2：直角三角形（带直角标记）

```json
{
  "content_type": "drawing",
  "title": "直角三角形",
  "diagram_ir": {
    "nodes": [
      { "id": "A", "type": "point", "label": "A", "labelAnchor": "bottomLeft" },
      { "id": "B", "type": "point", "label": "B", "labelAnchor": "bottomRight" },
      { "id": "C", "type": "point", "label": "C", "labelAnchor": "topLeft" }
    ],
    "edges": [
      { "type": "segment", "from": "A", "to": "B" },
      { "type": "segment", "from": "A", "to": "C" },
      { "type": "segment", "from": "B", "to": "C" }
    ],
    "constraints": [
      { "type": "right_angle", "vertex": "A", "rays": ["B", "C"] }
    ],
    "annotations": [
      { "type": "text", "text": "∠A=90°", "attachTo": "A", "offset": [-50, 30] }
    ]
  }
}
```

### 示例3：圆 O

```json
{
  "content_type": "drawing",
  "title": "圆",
  "diagram_ir": {
    "nodes": [
      { "id": "O", "type": "point", "label": "O" }
    ],
    "constraints": [
      { "type": "circle", "center": "O", "radius": 100 }
    ]
  }
}
```

### 示例4：平行四边形 ABCD

```json
{
  "content_type": "drawing",
  "title": "平行四边形",
  "diagram_ir": {
    "nodes": [
      { "id": "A", "type": "point", "label": "A", "labelAnchor": "bottomLeft" },
      { "id": "B", "type": "point", "label": "B", "labelAnchor": "bottomRight" },
      { "id": "C", "type": "point", "label": "C", "labelAnchor": "topRight" },
      { "id": "D", "type": "point", "label": "D", "labelAnchor": "topLeft" }
    ],
    "edges": [
      { "type": "segment", "from": "A", "to": "B" },
      { "type": "segment", "from": "B", "to": "C" },
      { "type": "segment", "from": "C", "to": "D" },
      { "type": "segment", "from": "D", "to": "A" }
    ],
    "constraints": [
      { "type": "parallelogram", "vertices": ["A", "B", "C", "D"] }
    ]
  }
}
```

## 可用约束类型

| 约束 | 说明 | 参数 |
|------|------|------|
| triangle | 普通三角形 | vertices: [A, B, C] |
| isosceles | 等腰三角形 | apex, base: [B, C] |
| equilateral | 等边三角形 | vertices: [A, B, C] |
| right_angle | 直角 | vertex, rays: [B, C] |
| circle | 圆 | center, radius |
| rectangle | 矩形 | vertices: [A, B, C, D] |
| square | 正方形 | vertices: [A, B, C, D] |
| parallelogram | 平行四边形 | vertices: [A, B, C, D] |

## 标签锚点

| 锚点 | 位置 |
|------|------|
| top | 点的正上方 |
| bottom | 点的正下方 |
| left | 点的左侧 |
| right | 点的右侧 |
| topLeft | 点的左上方 |
| topRight | 点的右上方 |
| bottomLeft | 点的左下方 |
| bottomRight | 点的右下方 |
```

### 3.6 前端处理更新

修改 `VoiceInteraction.tsx` 中的工具调用处理：

```typescript
// 在 onToolCall 回调中处理 drawing
if (p.content_type === "drawing") {
  if (p.diagram_ir) {
    // 新方式：使用 Diagram IR
    try {
      const response = await fetch("/api/whiteboard/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ diagram_ir: p.diagram_ir }),
      });
      const result = await response.json();

      if (result.success) {
        onShowDrawing({
          elements: result.elements,
          title: p.title,
        });
      }
    } catch (error) {
      console.error("Failed to render diagram:", error);
    }
  } else if (p.elements) {
    // 旧方式：向后兼容
    onShowDrawing({
      elements: p.elements,
      title: p.title,
    });
  }
}
```

---

## 四、实施计划

### 阶段 1：基础设施（1-2天）

1. 创建 `src/types/diagram-ir.ts` 类型定义
2. 创建 `src/lib/geometry-renderer/` 目录结构
3. 实现基本的三角形渲染（triangle, isosceles）

### 阶段 2：核心 Renderer（2-3天）

1. 实现更多约束类型（right_angle, circle, rectangle 等）
2. 实现边渲染（每条边独立 line 元素）
3. 实现标签渲染（带锚点偏移）
4. 创建 `/api/whiteboard/render` API

### 阶段 3：集成（1天）

1. 更新 `/api/realtime/route.ts` 工具定义
2. 更新 `VoiceInteraction.tsx` 处理逻辑
3. 更新 `drawing/GUIDE.md` 指南

### 阶段 4：测试与优化（1-2天）

1. 测试各种几何图形
2. 优化布局算法
3. 添加更多约束类型

### 可选阶段：后端状态管理

如果需要增量更新和多客户端同步，可以借鉴 mcp_excalidraw：

1. 创建 `/api/whiteboard/elements` CRUD API
2. 添加 WebSocket 广播
3. 前端改为监听 WebSocket 更新

---

## 五、示例对比

### 旧方式（不稳定）

```json
{
  "content_type": "drawing",
  "elements": [
    { "type": "line", "x": 200, "y": 250, "points": [[0,0], [200,0], [100,-150], [0,0]] },
    { "type": "text", "x": 185, "y": 270, "text": "A" },
    { "type": "text", "x": 400, "y": 270, "text": "B" },
    { "type": "text", "x": 290, "y": 80, "text": "C" }
  ]
}
```

问题：LLM 需要计算所有坐标，容易出错。

### 新方式（稳定）

```json
{
  "content_type": "drawing",
  "diagram_ir": {
    "nodes": [
      { "id": "A", "type": "point", "label": "A", "labelAnchor": "bottomLeft" },
      { "id": "B", "type": "point", "label": "B", "labelAnchor": "bottomRight" },
      { "id": "C", "type": "point", "label": "C", "labelAnchor": "top" }
    ],
    "edges": [
      { "type": "segment", "from": "A", "to": "B" },
      { "type": "segment", "from": "A", "to": "C" },
      { "type": "segment", "from": "B", "to": "C" }
    ],
    "constraints": [
      { "type": "isosceles", "apex": "C", "base": ["A", "B"] }
    ]
  }
}
```

优势：LLM 只需要描述结构，坐标由 Renderer 计算。

---

## 六、借鉴 mcp_excalidraw 的部分

| 特性 | 是否采用 | 原因 |
|------|---------|------|
| Canvas Server 分离 | 暂不 | 当前规模不需要 |
| REST API 设计 | 部分 | `/api/whiteboard/render` |
| WebSocket 同步 | 可选 | 如需增量更新再加 |
| 元素 ID 稳定 | 是 | Renderer 生成稳定 ID |
| batch_create | 是 | 一次渲染多个元素 |
| 绑定验证 | 暂不 | Diagram IR 避免了这个问题 |
| Mermaid 转换 | 可选 | 后续扩展流程图 |
| align/distribute | 暂不 | Renderer 已处理布局 |
