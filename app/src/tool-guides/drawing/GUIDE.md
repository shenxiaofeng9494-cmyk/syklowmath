---
name: drawing
description: use_whiteboard(content_type="drawing") 的详细使用指南 - Diagram IR 版本
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
    "canvas": {         // 可选：画布配置
      "centerX": 300,   // 图形中心 X 坐标（默认 300）
      "centerY": 200    // 图形中心 Y 坐标（默认 200）
    },
    "nodes": [...],      // 点
    "edges": [...],      // 线段
    "constraints": [...] // 几何约束
  }
}
```

## 重要：避免图形重叠

**当需要画多个图形时，必须为每个图形设置不同的 centerX 或 centerY，否则它们会重叠！**

### 示例：画两个图形避免重叠

第一个图形（左侧）：
```json
{
  "content_type": "drawing",
  "title": "三角形 ABC",
  "diagram_ir": {
    "canvas": { "centerX": 200 },  // 左侧
    "nodes": [...],
    "edges": [...],
    "constraints": [...]
  }
}
```

第二个图形（右侧）：
```json
{
  "content_type": "drawing",
  "title": "正方形 DEFG",
  "diagram_ir": {
    "canvas": { "centerX": 450 },  // 右侧（相距 250px）
    "nodes": [...],
    "edges": [...],
    "constraints": [...]
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

### 示例5：正方形 ABCD

```json
{
  "content_type": "drawing",
  "title": "正方形",
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
      { "type": "square", "vertices": ["A", "B", "C", "D"] }
    ]
  }
}
```

### 示例6：等边三角形 ABC

```json
{
  "content_type": "drawing",
  "title": "等边三角形",
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
      { "type": "equilateral", "vertices": ["A", "B", "C"] }
    ],
    "annotations": [
      { "type": "text", "text": "AB = BC = CA", "attachTo": "B", "offset": [20, 60] }
    ]
  }
}
```

## 可用约束类型

| 约束 | 说明 | 参数示例 |
|------|------|----------|
| triangle | 普通三角形 | `{"type": "triangle", "vertices": ["A", "B", "C"]}` |
| isosceles | 等腰三角形 | `{"type": "isosceles", "apex": "C", "base": ["A", "B"]}` |
| equilateral | 等边三角形 | `{"type": "equilateral", "vertices": ["A", "B", "C"]}` |
| right_angle | 直角 | `{"type": "right_angle", "vertex": "A", "rays": ["B", "C"]}` |
| circle | 圆 | `{"type": "circle", "center": "O", "radius": 100}` |
| rectangle | 矩形 | `{"type": "rectangle", "vertices": ["A", "B", "C", "D"]}` |
| square | 正方形 | `{"type": "square", "vertices": ["A", "B", "C", "D"]}` |
| parallelogram | 平行四边形 | `{"type": "parallelogram", "vertices": ["A", "B", "C", "D"]}` |

## 标签锚点（labelAnchor）

标签相对于点的位置：

| 锚点 | 位置 | 适用场景 |
|------|------|----------|
| top | 点的正上方 | 三角形顶点 |
| bottom | 点的正下方 | 倒三角顶点 |
| left | 点的左侧 | 右侧的点 |
| right | 点的右侧 | 左侧的点 |
| topLeft | 点的左上方 | 右下角的点 |
| topRight | 点的右上方 | 左下角的点 |
| bottomLeft | 点的左下方 | 右上角的点（默认） |
| bottomRight | 点的右下方 | 左上角的点 |

## 边类型（edge type）

- `segment`: 线段（两点间的直线段）
- `ray`: 射线（从一点出发延伸的半直线）
- `line`: 直线（穿过两点的无限直线）
- `arc`: 弧（圆或圆的一部分）

## 注释（annotations）

用于添加额外的文字说明：

```json
{
  "type": "text",
  "text": "AB = 5cm",
  "attachTo": "A",     // 附着到点 A
  "offset": [20, -30]  // 相对 A 点右移 20，上移 30
}
```

## 关键要点

1. **只描述结构，不计算坐标**：系统会根据约束自动布局
2. **使用约束表达几何关系**：等腰、直角、平行等
3. **标签锚点很重要**：确保标签不遮挡图形
4. **每条边独立定义**：三角形需要三条 edge，不是一个闭合 line
5. **优先使用 diagram_ir**：比旧的 elements 方式更稳定、更准确

## 向后兼容

旧的 `elements` 参数仍然可用，但推荐使用新的 `diagram_ir` 方式以获得更准确的几何图形。
