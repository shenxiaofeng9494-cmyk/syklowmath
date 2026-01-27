# 智能绘图指南 - 如何根据任意文字画出正确的图

## 核心原则：先分析，再布局，后绘制

### 第一步：分析用户意图

| 用户说的话 | 图形类型 | 使用的形状 |
|-----------|---------|-----------|
| "流程"、"步骤"、"先...再...然后..." | 流程图 | rectangle + arrow + text |
| "分类"、"包含"、"结构"、"关系" | 思维导图 | ellipse + line + text |
| "对比"、"区别"、"相同点/不同点" | 对比图 | rectangle/cloud + text |
| "三角形"、"圆"、"正方形"等 | 几何图形 | 对应的 geo 形状 |
| "重点"、"注意"、"提示" | 标注图 | star/cloud + text |
| "正确/错误"、"对/错" | 判断图 | check-box/x-box + text |

### 第二步：智能布局计算

#### 画布基础信息
- 画布大小：800 × 600
- 安全区域：x: 50-750, y: 50-550
- 中心点：(400, 300)

#### 布局公式

**垂直流程图（N 个节点）：**
```
节点宽度 = 140
节点高度 = 50
垂直间距 = 60
起始 X = 400 - 节点宽度/2 = 330
起始 Y = 50
第 i 个节点的 Y = 50 + i * (节点高度 + 垂直间距)
```

**思维导图（1 个中心 + N 个分支）：**
```
中心位置 = (350, 280)
中心大小 = 120 × 70
分支半径 = 180
第 i 个分支的角度 = -90° + i * (360° / N)
分支 X = 350 + cos(角度) * 半径
分支 Y = 280 + sin(角度) * 半径
```

**网格布局（M 行 × N 列）：**
```
单元格宽度 = (700 - (N-1)*30) / N
单元格高度 = (500 - (M-1)*30) / M
第 (i,j) 个单元格的 X = 50 + j * (单元格宽度 + 30)
第 (i,j) 个单元格的 Y = 50 + i * (单元格高度 + 30)
```

### 第三步：形状选择指南

#### 流程图形状规范
| 含义 | 形状 | 颜色建议 |
|-----|------|---------|
| 开始/结束 | ellipse | green/red |
| 处理步骤 | rectangle | blue |
| 判断/决策 | diamond | orange |
| 连接箭头 | arrow (垂直: width=0) | black |

#### 思维导图形状规范
| 含义 | 形状 | 颜色建议 |
|-----|------|---------|
| 中心主题 | ellipse | blue |
| 一级分支 | rectangle | 多色轮换 |
| 连接线 | line | grey |

#### 标注形状规范
| 含义 | 形状 | 颜色建议 |
|-----|------|---------|
| 重点/星标 | star | orange |
| 想法/概念 | cloud | light-blue |
| 正确 | check-box | green |
| 错误 | x-box | red |
| 爱心/鼓励 | heart | red |

## 实战模板

### 模板1：通用流程图（3-5步）

用户说："画一个解题流程图"

```json
{"action": "open", "shapes": [
  {"type": "ellipse", "x": 330, "y": 30, "width": 140, "height": 50, "color": "green"},
  {"type": "text", "x": 375, "y": 45, "text": "读题"},

  {"type": "arrow", "x": 400, "y": 80, "width": 0, "height": 40, "color": "black"},

  {"type": "rectangle", "x": 330, "y": 120, "width": 140, "height": 50, "color": "blue"},
  {"type": "text", "x": 360, "y": 135, "text": "分析条件"},

  {"type": "arrow", "x": 400, "y": 170, "width": 0, "height": 40, "color": "black"},

  {"type": "diamond", "x": 330, "y": 210, "width": 140, "height": 80, "color": "orange"},
  {"type": "text", "x": 360, "y": 240, "text": "选方法"},

  {"type": "arrow", "x": 400, "y": 290, "width": 0, "height": 40, "color": "black"},

  {"type": "rectangle", "x": 330, "y": 330, "width": 140, "height": 50, "color": "blue"},
  {"type": "text", "x": 370, "y": 345, "text": "计算"},

  {"type": "arrow", "x": 400, "y": 380, "width": 0, "height": 40, "color": "black"},

  {"type": "ellipse", "x": 330, "y": 420, "width": 140, "height": 50, "color": "red"},
  {"type": "text", "x": 370, "y": 435, "text": "检验"}
]}
```

### 模板2：通用思维导图（4分支）

用户说："画一个思维导图，中心是XXX"

```json
{"action": "open", "shapes": [
  {"type": "ellipse", "x": 300, "y": 230, "width": 140, "height": 80, "color": "blue"},
  {"type": "text", "x": 340, "y": 260, "text": "中心主题"},

  {"type": "line", "x": 370, "y": 230, "points": [{"x": 0, "y": 0}, {"x": 0, "y": -100}], "color": "grey"},
  {"type": "rectangle", "x": 310, "y": 90, "width": 120, "height": 40, "color": "green"},
  {"type": "text", "x": 345, "y": 102, "text": "分支1"},

  {"type": "line", "x": 440, "y": 270, "points": [{"x": 0, "y": 0}, {"x": 120, "y": 0}], "color": "grey"},
  {"type": "rectangle", "x": 560, "y": 250, "width": 120, "height": 40, "color": "orange"},
  {"type": "text", "x": 595, "y": 262, "text": "分支2"},

  {"type": "line", "x": 370, "y": 310, "points": [{"x": 0, "y": 0}, {"x": 0, "y": 100}], "color": "grey"},
  {"type": "rectangle", "x": 310, "y": 410, "width": 120, "height": 40, "color": "violet"},
  {"type": "text", "x": 345, "y": 422, "text": "分支3"},

  {"type": "line", "x": 300, "y": 270, "points": [{"x": 0, "y": 0}, {"x": -120, "y": 0}], "color": "grey"},
  {"type": "rectangle", "x": 60, "y": 250, "width": 120, "height": 40, "color": "red"},
  {"type": "text", "x": 95, "y": 262, "text": "分支4"}
]}
```

### 模板3：对比图

用户说："画一个对比图，比较A和B"

```json
{"action": "open", "shapes": [
  {"type": "cloud", "x": 50, "y": 100, "width": 200, "height": 120, "color": "blue"},
  {"type": "text", "x": 110, "y": 150, "text": "概念A"},

  {"type": "cloud", "x": 350, "y": 100, "width": 200, "height": 120, "color": "green"},
  {"type": "text", "x": 410, "y": 150, "text": "概念B"},

  {"type": "text", "x": 270, "y": 150, "text": "VS"},

  {"type": "text", "x": 80, "y": 250, "text": "特点1：..."},
  {"type": "text", "x": 80, "y": 280, "text": "特点2：..."},

  {"type": "text", "x": 380, "y": 250, "text": "特点1：..."},
  {"type": "text", "x": 380, "y": 280, "text": "特点2：..."}
]}
```

### 模板4：正误对比

用户说："画一个正确和错误的对比"

```json
{"action": "open", "shapes": [
  {"type": "check-box", "x": 50, "y": 80, "width": 50, "height": 50, "color": "green"},
  {"type": "text", "x": 120, "y": 95, "text": "正确做法："},
  {"type": "rectangle", "x": 120, "y": 130, "width": 300, "height": 80, "color": "light-green"},
  {"type": "text", "x": 140, "y": 160, "text": "正确的内容写在这里"},

  {"type": "x-box", "x": 50, "y": 250, "width": 50, "height": 50, "color": "red"},
  {"type": "text", "x": 120, "y": 265, "text": "错误做法："},
  {"type": "rectangle", "x": 120, "y": 300, "width": 300, "height": 80, "color": "light-red"},
  {"type": "text", "x": 140, "y": 330, "text": "错误的内容写在这里"}
]}
```

### 模板5：重点标注

用户说："标注一下重点"

```json
{"action": "open", "shapes": [
  {"type": "star", "x": 50, "y": 50, "width": 60, "height": 60, "color": "orange"},
  {"type": "text", "x": 130, "y": 70, "text": "重点1：这是最重要的内容"},

  {"type": "star", "x": 50, "y": 150, "width": 60, "height": 60, "color": "orange"},
  {"type": "text", "x": 130, "y": 170, "text": "重点2：这也很重要"},

  {"type": "star", "x": 50, "y": 250, "width": 60, "height": 60, "color": "orange"},
  {"type": "text", "x": 130, "y": 270, "text": "重点3：别忘了这个"}
]}
```

## 动态内容替换规则

当用户提供具体内容时，按以下规则替换模板中的文字：

1. **流程图**：按顺序替换每个步骤的文字
2. **思维导图**：中心替换为主题，分支替换为子主题
3. **对比图**：替换两边的概念名称和特点
4. **标注图**：替换重点内容

## 颜色轮换方案

当需要多个同类形状时，使用以下颜色轮换：
```
["green", "orange", "violet", "red", "blue", "light-green", "light-blue"]
```

## 文字位置计算

文字应该放在形状的中心偏上位置：
```
文字 X = 形状 X + 形状宽度/4
文字 Y = 形状 Y + 形状高度/3
```

对于较长的文字，适当左移：
```
文字 X = 形状 X + 10
```
