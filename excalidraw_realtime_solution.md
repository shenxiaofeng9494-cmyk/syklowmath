# OpenAI Realtime + Excalidraw：教育场景“边讲边画”落地方案（含 mcp_excalidraw 借鉴）

面向你的目标：学生提问（语音）→ AI 语音讲解的同时，在 Excalidraw 白板上实时画图，并且“画得准、改得快、不漂移”。下面给的是一套可直接落地的工程方案，并重点吸收 `yctimlin/mcp_excalidraw` 的成熟做法（“Canvas Server + 标准化工具层 + 实时同步”）。

---

## 1. 先把问题讲透：为什么“画不准”通常不是 Excalidraw 的锅

你现在的做法是：模型直接输出一组元素（含坐标/points），前端渲染。画不准的典型原因有四类：

1) **坐标是“像素级自由发挥”**：LLM 对几何约束、布局间距、对齐、比例非常不稳定。  
2) **线段/箭头是“弱约束元素”**：线段 points 只描述路径，不知道该自动“吸附/绑定”到某个形状的边界；所以看起来“没对上”。  
3) **缺少“布局引擎”**：你让 LLM 同时做“理解 + 布局 + 渲染参数”，属于高难任务，误差会累积。  
4) **缺少“渲染后校正”**：即便 LLM 生成得不错，也需要对齐、分布、组、锁定等后处理，才能稳定。

结论：想要“准”，要把绘图从“像素生成”升级为“结构化图 + 确定性渲染（layout/render）”。

---

## 2. mcp_excalidraw 到底是什么？与你“直接用 Excalidraw 组件”有什么区别

### 2.1 它是不是 MCP 服务器？
是。它实现了一套 **MCP（Model Context Protocol，模型上下文协议）** 的服务端，让支持 MCP 的客户端（如 Claude Desktop/Cursor 等）可以把“画图”当成一组标准工具来调用。你可以把 MCP 理解为：**让 AI 调工具的“标准插头”**，而不是每家都自定义 function schema。

### 2.2 为什么它要拆成两块：Canvas Server 和 MCP Server
`mcp_excalidraw` 的关键设计是“两套独立组件”：  
- **Canvas Server**：提供 Excalidraw Web 画布（并暴露 REST API，如 `/api/elements` CRUD、`/health`）。  
- **MCP Server**：面向 AI/IDE 的工具层，把“创建/更新/批量创建/对齐/分布/分组”等能力包装成 MCP tools；并在开启 canvas sync 时，通过 HTTP/WS 把变更同步到画布。

这种拆分很适合你教育场景：  
- 画布是“前端产品能力”（可嵌你自己的页面），  
- 工具层是“AI 操作能力”（可独立演进、可被不同模型/端复用）。

### 2.3 你是不是“直接用 Excalidraw 开源组件就行了”？
如果只做你自己的产品端，“直接用 Excalidraw 组件 + 你自定义的 function tool”确实够用。  
但 `mcp_excalidraw` 的价值在于：它已经把“画布状态管理 + CRUD API + 实时同步 + 高层工具（对齐/分布/分组/批量）”做成一套可复用的骨架。你可以：  
- **不一定实现 MCP 协议**，但可以复用它的“工具分层思想”和“API 设计”。  
- 如果你未来想让 Cursor/Claude Desktop 也能画进你的同一个画布，或者把绘图能力暴露给外部 agent，那 MCP 会更有价值。

---

## 3. 推荐的“成熟架构”（结合你的现状做升级）

你现在是“前端本地渲染 + LLM 输出 elements”。升级路线建议走：

### 3.1 三层分离：交互层 / 白板服务层 / 绘图智能层

**A. 交互层（Frontend）**
- ExcalidrawCanvas.tsx：只负责渲染 scene、切换视图、滚动聚焦、展示状态。
- 永远不要让 LLM 直接操控 React state；统一走“白板服务层”的 API。

**B. 白板服务层（Whiteboard Service，建议单独一个 Node 服务）**
- 存储 canonical scene（元素数组 + 必要 appState）。  
- 提供 REST：
  - GET/POST/PUT/DELETE `/api/elements`
  - POST `/api/elements/batch`
  - GET `/health`
- 提供 WebSocket：推送 element delta 或全量 scene（简单先全量）。

这层基本等价于 `mcp_excalidraw` 的 Canvas Server：你的产品可以直接借鉴这个接口形式。

**C. 绘图智能层（Diagram Intelligence）**
这层才是“画准”的关键：把 LLM 输出从“像素元素”提升到“结构化图（Diagram IR）”。

- LLM 输出：Diagram IR（中间表示）+ 必要的文本讲解计划  
- 稳定的 layout/render：把 Diagram IR 确定性转成 Excalidraw elements
- 后处理：对齐/分布/分组/锁定/自动留白

你可以把这层做在：
- 后端（更稳、更好控、便于评估/回放），或  
- 前端（实现快，但难评估、易受 UI 变化影响）。

教育产品一般建议后端。

---

## 4. Diagram IR：把“画图”从生成坐标升级为“生成结构”

### 4.1 IR 的核心字段（示例）
下面是推荐的 IR（你可以继续用 JSON）：

```json
{
  "title": "等腰三角形性质讲解",
  "canvas": { "grid": 40, "padding": 80 },
  "nodes": [
    { "id": "A", "type": "point", "label": "A" },
    { "id": "B", "type": "point", "label": "B" },
    { "id": "C", "type": "point", "label": "C" }
  ],
  "constraints": [
    { "type": "isosceles", "apex": "A", "base": ["B", "C"] },
    { "type": "label_near", "node": "A", "anchor": "top" },
    { "type": "label_near", "node": "B", "anchor": "bottomLeft" },
    { "type": "label_near", "node": "C", "anchor": "bottomRight" }
  ],
  "edges": [
    { "type": "segment", "from": "A", "to": "B" },
    { "type": "segment", "from": "A", "to": "C" },
    { "type": "segment", "from": "B", "to": "C" }
  ],
  "annotations": [
    { "type": "text", "text": "AB = AC", "attachTo": "A", "offset": [120, -40] }
  ]
}
```

解释：  
- **IR（Intermediate Representation，中间表示）**：不是最终渲染数据，而是“结构 + 约束”。  
- **constraints（约束）**：告诉系统“等腰”“标签放哪”“对齐/间距”，交给确定性 renderer 算坐标。

### 4.2 确定性渲染（Renderer）怎么做
核心思路：把几何约束写成确定性算法：  
- 等腰三角形：先定底边 BC，再定 apex A 的高度，保证 AB=AC。  
- 画点/线：生成 Excalidraw line 元素（建议三条线段而不是一个闭合 polyline）。  
- 标签：基于点坐标和字体大小计算 offset（而不是让 LLM 猜）。

Renderer 做完后输出：
- `elements[]`（可直接 `updateScene`）  
- `layoutMeta`（各元素 bbox、anchors，用于后续增量更新）

---

## 5. 工具层（Tool Schema）怎么设计，才能让模型画得稳

你现在的 `use_whiteboard(content_type="drawing")` 让模型一次性吐 elements。建议升级为“两类工具”：

### 5.1 高层语义工具（推荐）
- `whiteboard.render_diagram_ir(ir)`：把 IR 渲染成 elements（由你后端 renderer 完成）。  
- `whiteboard.add_annotation(...)`：只加文字标注。  
- `whiteboard.highlight(elements, style)`：强调某些边/角。

### 5.2 低层排版工具（借鉴 mcp_excalidraw）
如果你仍需要 element 级操作，至少提供“后处理工具”，减少 LLM 猜坐标：
- `batch_create_elements`
- `align_elements`（左/中/右/上/中/下）
- `distribute_elements`
- `group_elements / ungroup_elements`
- `lock_elements / unlock_elements`
- `query_elements`（把当前画布摘要给模型）

这些工具在 `mcp_excalidraw` 中就作为标准能力出现，你完全可以照搬到自己的 function schema 里（即便不做 MCP）。

---

## 6. OpenAI Realtime 模型：如何“边讲边画”不中断

Realtime 的关键点：你不是等它整段说完再画，而是让模型在讲解过程中触发工具调用，然后你执行并把结果回填，再继续讲解。

推荐模式：
1) 学生语音输入 → Realtime session  
2) 模型输出：一边语音输出，一边产生 function call（例如 `render_diagram_ir`）  
3) 你执行 function（调用白板服务层更新画布）  
4) 你用 `conversation.item.create` 把 `function_call_output` 回填给模型，再 `response.create` 让它继续讲（或者继续画下一步）

如果用户打断（VAD），记得按 Realtime 的截断机制处理输出音频，避免模型“以为自己说完了”。

---

## 7. 针对你当前实现的“直接可做优化清单”

### 7.1 生成元素策略：从“一个 line 画三角形”改成“三条线段 + group”
你现在用一个 `line` 的 points 画闭合三角形，模型容易生成奇怪折线。建议：
- 生成 3 个 line 元素：AB、AC、BC
- 然后 group（或至少锁定）

这样 renderer 更可控，后续高亮某一边也更容易。

### 7.2 强制网格与留白（Grid + Padding）
- 规定 gridStep（例如 40）  
- 任何坐标都 round 到 gridStep  
- 每次绘制前先计算当前 scene 的 bbox，给新图留出 padding（例如 80px）

这能显著减少“挤在一起/比例失衡”。

### 7.3 增量更新：保持 element id 稳定
- 如果是“讲解步骤 A→B→C”，不要每一步都清空重画；而是更新或新增。  
- 稳定的 id 有利于“对齐/绑定/高亮”这些操作持续有效，也减少视觉抖动。

### 7.4 前端渲染：用 Excalidraw API 做标准更新
尽量使用 Excalidraw 官方 `updateScene()` 更新元素，再用 `scrollToContent()` 聚焦内容；必要时调用 `refresh()` 处理容器 offset 变化（例如你的 view 切换动画）。

### 7.5 给模型更好的“画布摘要”，减少胡画
提供一个 `get_scene_summary()` 工具：返回简化信息而不是全量 elements，例如：
- 每个元素：id、type、bbox、label（若有）  
- 当前内容 bbox  
- 最近一步绘制的元素 id 列表

模型就能“接着画”，而不是“重新猜坐标”。

---

## 8. 评估与回放：教育场景强烈建议加

你要做“画得准”，最好让系统可以离线评估：
- 把每次提问、IR、渲染结果（elements）、最终截图都存下来
- 用规则检查几何约束（等腰就检查两边长度差是否 < 阈值）
- 失败样本自动回放，迭代 renderer 或 prompt

这比纯 prompt 调参效率高很多。

---

## 9. 最小可行落地（MVP）建议顺序

1) 把白板 state 搬到后端：实现 Canvas Server（REST + WS）  
2) 把工具层拆出来：前端只订阅 WS + updateScene  
3) 新增 Diagram IR + renderer：先支持几何类（点/线/角/三角形/圆）  
4) Realtime：跑通“模型触发 render_ir → 回填 function_call_output → 继续讲解”闭环  
5) 加后处理工具：align/distribute/group/lock（可直接照搬 mcp_excalidraw 的能力集合）  
6) 加评估与回放：把“画不准”变成可复现 bug

---

## 10. 附：你可以直接复用/对齐的接口（参考 mcp_excalidraw 的风格）

建议你把自己的 whiteboard service API 做成类似：

- `GET /api/elements`
- `POST /api/elements`
- `PUT /api/elements/:id`
- `DELETE /api/elements/:id`
- `POST /api/elements/batch`
- `GET /health`

同时 WS 推送 `scene.updated`（你自定义即可）：
```json
{ "type": "scene.updated", "elements": [...], "revision": 42 }
```

这样你的前端、你的 Realtime 工具执行器、甚至未来的 MCP server 都能复用同一套白板服务层。

---

## 参考（你后续实现时建议优先读）
- `yctimlin/mcp_excalidraw` README（架构拆分、REST endpoints、工具能力集合）  
- Excalidraw developer docs：`updateScene() / scrollToContent() / refresh()` API  
- Excalidraw `@excalidraw/mermaid-to-excalidraw`：如果你要支持流程图/架构图，可让模型先生成 Mermaid，再确定性转换为 Excalidraw skeleton elements，再转 full elements。  
- OpenAI Realtime conversations：function call 回填的 `conversation.item.create` / `function_call_output` 工作流

