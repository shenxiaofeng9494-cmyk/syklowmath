---
name: whiteboard
description: use_whiteboard 工具的详细使用指南，包括公式、函数图像、几何图形三种类型的参数说明和示例。
---

# use_whiteboard 工具使用指南

## 概述

use_whiteboard 用于在画板上展示数学内容，支持三种类型：
- `formula`: 公式展示（LaTeX 渲染）
- `graph`: 函数图像（坐标系绘图）
- `drawing`: 几何图形（Excalidraw 绘图）

---

## formula 类型 - 公式展示

用于展示数学公式，使用 LaTeX 格式。

### 单个公式
```
use_whiteboard(content_type="formula", latex="ax^2 + bx + c = 0")
```

### 分步推导（用 steps 参数）
```
use_whiteboard(content_type="formula", steps=[
  "x^2 - 5x + 6 = 0",
  "(x-2)(x-3) = 0",
  "x_1 = 2, \\quad x_2 = 3"
])
```

### 常用 LaTeX 语法
| 效果 | LaTeX |
|------|-------|
| 分数 | `\frac{a}{b}` |
| 根号 | `\sqrt{x}` |
| 下标 | `x_1, x_2` |
| 上标 | `x^2, x^{10}` |
| 不等于 | `\neq` |
| 大于等于 | `\geq` |
| 小于等于 | `\leq` |
| 乘号 | `\times` |
| 除号 | `\div` |
| 空格 | `\quad` |

---

## graph 类型 - 函数图像

用于绘制函数图像，自动渲染坐标系。

### 基本用法
```
use_whiteboard(
  content_type="graph",
  expression="y = x^2 - 4*x + 3",
  x_range=[-2, 6],
  y_range=[-2, 8],
  points=[
    {"x": 2, "y": -1, "label": "顶点"},
    {"x": 1, "y": 0, "label": ""},
    {"x": 3, "y": 0, "label": ""}
  ]
)
```

### 表达式语法
| 运算 | 写法 |
|------|------|
| 加减乘除 | `+`, `-`, `*`, `/` |
| 幂 | `x^2`, `x^3` |
| 根号 | `sqrt(x)` |
| 三角函数 | `sin(x)`, `cos(x)`, `tan(x)` |
| 绝对值 | `abs(x)` |
| 自然对数 | `log(x)` |
| e的幂 | `exp(x)` |

### 参数说明
| 参数 | 说明 | 示例 |
|------|------|------|
| expression | 函数表达式 | `"y = 2*x + 1"` |
| x_range | x轴范围 | `[-5, 5]` |
| y_range | y轴范围 | `[-5, 5]` |
| points | 标记特殊点 | 顶点、交点等 |

### 常见函数示例

一次函数：
```
expression="y = 2*x + 1", x_range=[-5, 5], y_range=[-5, 10]
```

二次函数：
```
expression="y = x^2 - 2*x - 3", x_range=[-2, 4], y_range=[-5, 5]
points=[{"x": 1, "y": -4, "label": "顶点"}, {"x": -1, "y": 0}, {"x": 3, "y": 0}]
```

反比例函数：
```
expression="y = 6/x", x_range=[-10, 10], y_range=[-10, 10]
```

---

## drawing 类型 - 几何图形

用于绘制几何图形，需要详细指南时调用 `load_tool_guide("drawing")`。

### 基本用法
```
use_whiteboard(content_type="drawing", title="等腰三角形", elements=[...])
```

### 坐标系说明
- 原点在画布左上角
- X 轴向右为正
- Y 轴向下为正
- 建议画布范围：x: 100-500, y: 50-350

### 支持的元素类型
- `line`: 线段/折线/多边形
- `ellipse`: 圆/椭圆
- `rectangle`: 矩形
- `text`: 文字标注

详细的元素参数和示例请调用 `load_tool_guide("drawing")`。
