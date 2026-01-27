---
name: drawing-board
description: use_drawing_board 画板工具完整指南，支持24种形状，可画几何图形、流程图、思维导图等任意图形。
---

# use_drawing_board 画板工具完整指南

## 【核心】根据用户意图选择图形类型

| 用户说的话 | 图形类型 | 使用的形状组合 |
|-----------|---------|---------------|
| "流程"、"步骤"、"先...再...然后..." | 流程图 | ellipse(开始/结束) + rectangle(步骤) + diamond(判断) + arrow(连接) |
| "分类"、"包含"、"结构"、"关系" | 思维导图 | ellipse(中心) + rectangle(分支) + line(连接) |
| "对比"、"区别"、"相同/不同" | 对比图 | cloud/rectangle + text |
| "三角形"、"圆"、"正方形"等 | 几何图形 | 对应的 geo 形状 |
| "重点"、"注意"、"提示" | 标注图 | star + text |
| "正确/错误"、"对/错" | 判断图 | check-box/x-box + text |

## 坐标系说明
- 画布大小约 800×600
- 左上角是 (0, 0)
- x 向右增大，y 向下增大
- 建议图形居中，主体放在 (150-400, 100-300) 区域

## 支持的形状类型（24种）

### 基础形状
- `rectangle` - 矩形
- `ellipse` - 椭圆/圆
- `triangle` - 三角形
- `diamond` - 菱形

### 多边形
- `pentagon` - 五边形
- `hexagon` - 六边形
- `octagon` - 八边形

### 特殊形状
- `star` - 五角星
- `rhombus` - 菱形（另一种）
- `rhombus-2` - 菱形变体
- `oval` - 椭圆形
- `trapezoid` - 梯形
- `cloud` - 云朵
- `heart` - 爱心

### 方向箭头
- `arrow-right` - 右箭头
- `arrow-left` - 左箭头
- `arrow-up` - 上箭头
- `arrow-down` - 下箭头

### 复选框
- `check-box` - 勾选框
- `x-box` - 叉选框

### 线条类型
- `line` - 线条/折线
- `arrow` - 箭头连接线
- `text` - 文字
- `freehand` - 自由绘制

## 图形类型速查

### 1. 三角形（用 line 闭合折线）

**等腰三角形**：
```json
{"action": "open", "shapes": [
  {"type": "line", "x": 200, "y": 300, "points": [{"x": 0, "y": 0}, {"x": 100, "y": -150}, {"x": 200, "y": 0}, {"x": 0, "y": 0}], "color": "blue"},
  {"type": "text", "x": 90, "y": 320, "text": "底边"},
  {"type": "text", "x": 295, "y": 140, "text": "顶点"}
]}
```

**直角三角形**：
```json
{"action": "open", "shapes": [
  {"type": "line", "x": 100, "y": 100, "points": [{"x": 0, "y": 0}, {"x": 0, "y": 150}, {"x": 200, "y": 150}, {"x": 0, "y": 0}], "color": "blue"},
  {"type": "line", "x": 100, "y": 230, "points": [{"x": 0, "y": 0}, {"x": 20, "y": 0}, {"x": 20, "y": 20}], "color": "red"},
  {"type": "text", "x": 80, "y": 80, "text": "A"},
  {"type": "text", "x": 80, "y": 260, "text": "B"},
  {"type": "text", "x": 300, "y": 260, "text": "C"}
]}
```

**等边三角形**：
```json
{"action": "open", "shapes": [
  {"type": "line", "x": 200, "y": 280, "points": [{"x": 100, "y": -173}, {"x": 200, "y": 0}, {"x": 0, "y": 0}, {"x": 100, "y": -173}], "color": "blue"}
]}
```

### 2. 圆和椭圆

**圆（带圆心）**：
```json
{"action": "open", "shapes": [
  {"type": "ellipse", "x": 200, "y": 150, "width": 200, "height": 200, "color": "blue"},
  {"type": "text", "x": 290, "y": 240, "text": "O"}
]}
```

**圆 + 半径**：
```json
{"action": "open", "shapes": [
  {"type": "ellipse", "x": 200, "y": 150, "width": 200, "height": 200, "color": "blue"},
  {"type": "line", "x": 300, "y": 250, "points": [{"x": 0, "y": 0}, {"x": 100, "y": 0}], "color": "red"},
  {"type": "text", "x": 290, "y": 240, "text": "O"},
  {"type": "text", "x": 340, "y": 225, "text": "r"}
]}
```

### 3. 四边形

**矩形**：
```json
{"action": "open", "shapes": [
  {"type": "rectangle", "x": 150, "y": 150, "width": 250, "height": 150, "color": "blue"}
]}
```

**正方形**：
```json
{"action": "open", "shapes": [
  {"type": "rectangle", "x": 200, "y": 150, "width": 180, "height": 180, "color": "blue"}
]}
```

**平行四边形**：
```json
{"action": "open", "shapes": [
  {"type": "line", "x": 100, "y": 150, "points": [{"x": 50, "y": 0}, {"x": 250, "y": 0}, {"x": 200, "y": 120}, {"x": 0, "y": 120}, {"x": 50, "y": 0}], "color": "green"}
]}
```

**梯形**：
```json
{"action": "open", "shapes": [
  {"type": "line", "x": 100, "y": 150, "points": [{"x": 80, "y": 0}, {"x": 220, "y": 0}, {"x": 280, "y": 120}, {"x": 0, "y": 120}, {"x": 80, "y": 0}], "color": "orange"}
]}
```

### 4. 角度

**一般角**：
```json
{"action": "open", "shapes": [
  {"type": "line", "x": 150, "y": 250, "points": [{"x": 0, "y": 0}, {"x": 200, "y": 0}], "color": "blue"},
  {"type": "line", "x": 150, "y": 250, "points": [{"x": 0, "y": 0}, {"x": 150, "y": -120}], "color": "blue"},
  {"type": "text", "x": 180, "y": 220, "text": "α"},
  {"type": "text", "x": 130, "y": 260, "text": "O"}
]}
```

**直角**：
```json
{"action": "open", "shapes": [
  {"type": "line", "x": 150, "y": 100, "points": [{"x": 0, "y": 0}, {"x": 0, "y": 180}], "color": "blue"},
  {"type": "line", "x": 150, "y": 280, "points": [{"x": 0, "y": 0}, {"x": 200, "y": 0}], "color": "blue"},
  {"type": "rectangle", "x": 150, "y": 260, "width": 20, "height": 20, "color": "red"},
  {"type": "text", "x": 175, "y": 250, "text": "90°"}
]}
```

### 5. 坐标系

```json
{"action": "open", "shapes": [
  {"type": "arrow", "x": 50, "y": 250, "width": 350, "height": 0, "color": "black"},
  {"type": "arrow", "x": 200, "y": 400, "width": 0, "height": -350, "color": "black"},
  {"type": "text", "x": 410, "y": 245, "text": "x"},
  {"type": "text", "x": 205, "y": 40, "text": "y"},
  {"type": "text", "x": 180, "y": 260, "text": "O"}
]}
```

### 6. 线段和射线

**线段 AB**：
```json
{"action": "open", "shapes": [
  {"type": "line", "x": 100, "y": 200, "points": [{"x": 0, "y": 0}, {"x": 250, "y": 0}], "color": "blue"},
  {"type": "text", "x": 85, "y": 195, "text": "A"},
  {"type": "text", "x": 355, "y": 195, "text": "B"}
]}
```

**平行线**：
```json
{"action": "open", "shapes": [
  {"type": "line", "x": 100, "y": 150, "points": [{"x": 0, "y": 0}, {"x": 300, "y": 0}], "color": "blue"},
  {"type": "line", "x": 100, "y": 250, "points": [{"x": 0, "y": 0}, {"x": 300, "y": 0}], "color": "blue"},
  {"type": "text", "x": 420, "y": 145, "text": "l₁"},
  {"type": "text", "x": 420, "y": 245, "text": "l₂"}
]}
```

## 关键技巧

1. **闭合图形**：line 的 points 最后一个点要回到第一个点
2. **文字标注**：放在图形旁边，不要重叠
3. **颜色搭配**：主图形用 blue，标注用 red，文字用 black
4. **居中显示**：主体图形的中心放在 (300, 250) 附近

## 新增形状示例

### 7. 三角形（直接使用 triangle 类型）

```json
{"action": "open", "shapes": [
  {"type": "triangle", "x": 200, "y": 150, "width": 200, "height": 180, "color": "blue"},
  {"type": "text", "x": 280, "y": 350, "text": "三角形"}
]}
```

### 8. 菱形

```json
{"action": "open", "shapes": [
  {"type": "diamond", "x": 200, "y": 150, "width": 180, "height": 180, "color": "green"},
  {"type": "text", "x": 260, "y": 350, "text": "菱形"}
]}
```

### 9. 五角星

```json
{"action": "open", "shapes": [
  {"type": "star", "x": 200, "y": 150, "width": 200, "height": 200, "color": "orange"},
  {"type": "text", "x": 260, "y": 370, "text": "五角星"}
]}
```

### 10. 云朵（用于想法、概念）

```json
{"action": "open", "shapes": [
  {"type": "cloud", "x": 200, "y": 150, "width": 250, "height": 150, "color": "light-blue"},
  {"type": "text", "x": 280, "y": 210, "text": "想法"}
]}
```

### 11. 爱心

```json
{"action": "open", "shapes": [
  {"type": "heart", "x": 250, "y": 150, "width": 150, "height": 150, "color": "red"}
]}
```

### 12. 多边形

**五边形**：
```json
{"action": "open", "shapes": [
  {"type": "pentagon", "x": 200, "y": 150, "width": 180, "height": 180, "color": "violet"}
]}
```

**六边形**：
```json
{"action": "open", "shapes": [
  {"type": "hexagon", "x": 200, "y": 150, "width": 180, "height": 180, "color": "blue"}
]}
```

**八边形**：
```json
{"action": "open", "shapes": [
  {"type": "octagon", "x": 200, "y": 150, "width": 180, "height": 180, "color": "green"}
]}
```

## 流程图绘制模板

### 基本流程图规则
- **开始/结束** → 用 `ellipse`（椭圆）
- **处理步骤** → 用 `rectangle`（矩形）
- **判断/决策** → 用 `diamond`（菱形）
- **连接** → 用 `arrow`（箭头）

### 简单流程图示例

```json
{"action": "open", "shapes": [
  {"type": "ellipse", "x": 250, "y": 50, "width": 120, "height": 60, "color": "green"},
  {"type": "text", "x": 285, "y": 70, "text": "开始"},

  {"type": "arrow", "x": 310, "y": 110, "width": 0, "height": 40, "color": "black"},

  {"type": "rectangle", "x": 230, "y": 150, "width": 160, "height": 60, "color": "blue"},
  {"type": "text", "x": 265, "y": 170, "text": "处理步骤"},

  {"type": "arrow", "x": 310, "y": 210, "width": 0, "height": 40, "color": "black"},

  {"type": "diamond", "x": 230, "y": 250, "width": 160, "height": 100, "color": "orange"},
  {"type": "text", "x": 280, "y": 290, "text": "判断?"},

  {"type": "arrow", "x": 310, "y": 350, "width": 0, "height": 40, "color": "black"},

  {"type": "ellipse", "x": 250, "y": 390, "width": 120, "height": 60, "color": "red"},
  {"type": "text", "x": 285, "y": 410, "text": "结束"}
]}
```

### 带分支的流程图

```json
{"action": "open", "shapes": [
  {"type": "ellipse", "x": 300, "y": 30, "width": 100, "height": 50, "color": "green"},
  {"type": "text", "x": 330, "y": 45, "text": "开始"},

  {"type": "arrow", "x": 350, "y": 80, "width": 0, "height": 30, "color": "black"},

  {"type": "diamond", "x": 280, "y": 110, "width": 140, "height": 80, "color": "orange"},
  {"type": "text", "x": 315, "y": 140, "text": "条件?"},

  {"type": "text", "x": 430, "y": 140, "text": "是"},
  {"type": "arrow", "x": 420, "y": 150, "width": 60, "height": 0, "color": "black"},
  {"type": "rectangle", "x": 480, "y": 120, "width": 100, "height": 60, "color": "blue"},
  {"type": "text", "x": 500, "y": 140, "text": "步骤A"},

  {"type": "text", "x": 250, "y": 140, "text": "否"},
  {"type": "arrow", "x": 280, "y": 150, "width": -60, "height": 0, "color": "black"},
  {"type": "rectangle", "x": 120, "y": 120, "width": 100, "height": 60, "color": "blue"},
  {"type": "text", "x": 140, "y": 140, "text": "步骤B"}
]}
```

## 思维导图绘制模板

### 思维导图规则
- **中心主题** → 用 `ellipse` 或 `cloud`，放在画布中心
- **一级分支** → 用 `rectangle`，围绕中心
- **连接线** → 用 `line` 或 `arrow`
- **布局** → 中心扩散，层级递进

### 简单思维导图示例

```json
{"action": "open", "shapes": [
  {"type": "ellipse", "x": 280, "y": 200, "width": 140, "height": 80, "color": "blue"},
  {"type": "text", "x": 320, "y": 230, "text": "数学"},

  {"type": "line", "x": 350, "y": 200, "points": [{"x": 0, "y": 0}, {"x": 0, "y": -80}], "color": "grey"},
  {"type": "rectangle", "x": 300, "y": 80, "width": 100, "height": 40, "color": "green"},
  {"type": "text", "x": 325, "y": 92, "text": "代数"},

  {"type": "line", "x": 420, "y": 240, "points": [{"x": 0, "y": 0}, {"x": 80, "y": 0}], "color": "grey"},
  {"type": "rectangle", "x": 500, "y": 220, "width": 100, "height": 40, "color": "orange"},
  {"type": "text", "x": 525, "y": 232, "text": "几何"},

  {"type": "line", "x": 350, "y": 280, "points": [{"x": 0, "y": 0}, {"x": 0, "y": 80}], "color": "grey"},
  {"type": "rectangle", "x": 300, "y": 360, "width": 100, "height": 40, "color": "violet"},
  {"type": "text", "x": 325, "y": 372, "text": "统计"},

  {"type": "line", "x": 280, "y": 240, "points": [{"x": 0, "y": 0}, {"x": -80, "y": 0}], "color": "grey"},
  {"type": "rectangle", "x": 100, "y": 220, "width": 100, "height": 40, "color": "red"},
  {"type": "text", "x": 120, "y": 232, "text": "函数"}
]}
```

## 方向箭头使用

### 流程方向指示

```json
{"action": "open", "shapes": [
  {"type": "arrow-right", "x": 100, "y": 200, "width": 80, "height": 50, "color": "blue"},
  {"type": "text", "x": 200, "y": 215, "text": "下一步"},

  {"type": "arrow-down", "x": 350, "y": 150, "width": 50, "height": 80, "color": "green"},
  {"type": "text", "x": 420, "y": 180, "text": "继续"}
]}
```

## 复选框使用

### 待办事项列表

```json
{"action": "open", "shapes": [
  {"type": "check-box", "x": 100, "y": 100, "width": 30, "height": 30, "color": "green"},
  {"type": "text", "x": 140, "y": 105, "text": "已完成任务"},

  {"type": "x-box", "x": 100, "y": 150, "width": 30, "height": 30, "color": "red"},
  {"type": "text", "x": 140, "y": 155, "text": "未完成任务"},

  {"type": "rectangle", "x": 100, "y": 200, "width": 30, "height": 30, "color": "grey"},
  {"type": "text", "x": 140, "y": 205, "text": "待处理任务"}
]}
```

## 颜色搭配建议

| 用途 | 推荐颜色 |
|------|----------|
| 主图形 | blue, green |
| 强调/重点 | red, orange |
| 辅助线 | grey, black |
| 背景/装饰 | light-blue, light-green |
| 警告/错误 | red |
| 成功/完成 | green |
| 创意/想法 | violet, light-violet |

## 【重要】智能布局计算规则

### 画布基础
- 画布大小：800 × 600
- 安全区域：x: 50-750, y: 50-550
- 中心点：(400, 300)

### 垂直流程图布局（N 个节点）
```
节点宽度 = 140, 节点高度 = 50, 间距 = 50
起始 X = 330 (居中)
第 i 个节点的 Y = 50 + i × 100
箭头位置：x = 400, y = 节点底部, width = 0, height = 50
```

### 思维导图布局（1 中心 + N 分支）
```
中心位置 = (300, 230), 中心大小 = 140 × 80
分支半径 = 150
4分支角度：上(-90°)、右(0°)、下(90°)、左(180°)
分支 X = 300 + cos(角度) × 150
分支 Y = 230 + sin(角度) × 150
```

### 文字位置计算
```
文字 X = 形状 X + 形状宽度 / 4
文字 Y = 形状 Y + 形状高度 / 3
```

## 颜色轮换方案

多个同类形状时使用：
```
["green", "orange", "violet", "red", "blue", "light-green", "light-blue"]
```
