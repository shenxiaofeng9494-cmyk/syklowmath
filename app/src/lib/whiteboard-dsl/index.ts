/**
 * Whiteboard DSL
 *
 * 数学教学白板 DSL + 编译器
 *
 * 使用方法：
 * ```typescript
 * import { compileDSL, validateDSL } from "@/lib/whiteboard-dsl";
 *
 * const script = {
 *   commands: [
 *     { command: "DrawCoordinatePlane", params: { xRange: [-5, 5], yRange: [-2, 10] } },
 *     { command: "PlotFunction", params: { expression: "y = x^2", color: "blue" } }
 *   ]
 * };
 *
 * const result = compileDSL(script);
 * if (result.success) {
 *   canvas.drawShapes(result.shapes);
 * }
 * ```
 */

// 主要导出
export { compileDSL, compileDSLFromJSON } from "./compiler";
export { validateDSL } from "./validator";

// 类型导出
export type {
  DSLScript,
  DSLCommand,
  CompileResult,
  Point,
  LabeledPoint,
  Range,
  DSLColor,
  // 命令参数类型
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
  // 辅助类型
  FlowchartStep,
  FlowchartConnection,
  MindmapBranch,
  TriangleVertices,
  CoordinateContext,
} from "./types";

// 坐标系工具（供高级用户使用）
export {
  createCoordinateContext,
  mathToCanvas,
  canvasToMath,
} from "./coordinate-system";

// 布局工具（供高级用户使用）
export {
  centerPosition,
  verticalLayout,
  horizontalLayout,
  radialLayout,
  gridLayout,
  boundingBox,
  estimateTextWidth,
} from "./layout";

/**
 * DSL 命令参考文档
 */
export const DSL_REFERENCE = `
# 白板 DSL 命令参考

## 坐标系与函数

### DrawCoordinatePlane - 绘制坐标平面
\`\`\`json
{
  "command": "DrawCoordinatePlane",
  "params": {
    "xRange": [-5, 5],
    "yRange": [-2, 10],
    "gridLines": true,
    "labels": true
  }
}
\`\`\`

### PlotFunction - 绘制函数图像
\`\`\`json
{
  "command": "PlotFunction",
  "params": {
    "expression": "y = x^2",
    "color": "blue",
    "domain": [-3, 3],
    "points": [{"x": 0, "y": 0, "label": "顶点"}]
  }
}
\`\`\`

## 几何图形

### ConstructTriangle - 构造三角形
\`\`\`json
{
  "command": "ConstructTriangle",
  "params": {
    "vertices": {
      "A": {"x": 300, "y": 100},
      "B": {"x": 200, "y": 300},
      "C": {"x": 400, "y": 300}
    },
    "labels": true,
    "showAngles": false
  }
}
\`\`\`

### ConstructCircle - 构造圆
\`\`\`json
{
  "command": "ConstructCircle",
  "params": {
    "center": {"x": 400, "y": 300},
    "radius": 100,
    "showCenter": true,
    "showRadius": true
  }
}
\`\`\`

### DrawAngle - 绘制角
\`\`\`json
{
  "command": "DrawAngle",
  "params": {
    "vertex": {"x": 200, "y": 300},
    "ray1End": {"x": 400, "y": 300},
    "ray2End": {"x": 300, "y": 150},
    "label": "α",
    "isRightAngle": false
  }
}
\`\`\`

### DrawLineSegment - 绘制线段
\`\`\`json
{
  "command": "DrawLineSegment",
  "params": {
    "start": {"x": 100, "y": 200},
    "end": {"x": 400, "y": 200},
    "label": "AB"
  }
}
\`\`\`

## 教学图表

### CreateFlowchart - 创建流程图
\`\`\`json
{
  "command": "CreateFlowchart",
  "params": {
    "steps": [
      {"id": "1", "label": "开始", "type": "start"},
      {"id": "2", "label": "读题"},
      {"id": "3", "label": "分析"},
      {"id": "4", "label": "结束", "type": "end"}
    ]
  }
}
\`\`\`

### CreateMindmap - 创建思维导图
\`\`\`json
{
  "command": "CreateMindmap",
  "params": {
    "center": "一元二次方程",
    "branches": ["定义", "求根公式", "判别式", "应用"]
  }
}
\`\`\`

### ShowCorrectWrong - 正误对比
\`\`\`json
{
  "command": "ShowCorrectWrong",
  "params": {
    "correct": "x² + 2x + 1 = (x+1)²",
    "wrong": "x² + 2x + 1 = (x+2)²"
  }
}
\`\`\`

## 标注

### AddLabel - 添加文字标签
\`\`\`json
{
  "command": "AddLabel",
  "params": {
    "text": "重点！",
    "position": {"x": 100, "y": 100},
    "color": "red"
  }
}
\`\`\`

### AddArrow - 添加箭头
\`\`\`json
{
  "command": "AddArrow",
  "params": {
    "from": {"x": 100, "y": 100},
    "to": {"x": 200, "y": 200},
    "label": "推导"
  }
}
\`\`\`

## 完整示例

画抛物线 y = x²：
\`\`\`json
{
  "commands": [
    {
      "command": "DrawCoordinatePlane",
      "params": {"xRange": [-5, 5], "yRange": [-2, 10]}
    },
    {
      "command": "PlotFunction",
      "params": {
        "expression": "y = x^2",
        "color": "blue",
        "points": [{"x": 0, "y": 0, "label": "顶点(0,0)"}]
      }
    },
    {
      "command": "AddLabel",
      "params": {
        "text": "y = x²",
        "position": {"x": 500, "y": 100},
        "color": "blue"
      }
    }
  ]
}
\`\`\`
`;
