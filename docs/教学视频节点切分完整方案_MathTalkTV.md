# 教学视频切分为“知识点节点”的完整方案（MathTalkTV）

本文给出一套可落地、可迭代的“教学视频节点化（node segmentation）”方案，目标是让视频具备：可随时打断提问、RAG 精准检索、可回溯跳转、进度条知识点标记等能力。

---

## 0. 先把“节点”定义清楚（否则切不稳）

一个“节点（Video Node）”不是简单的时间片段，而是一个**语义完整的教学单元**，通常对应一个知识点或教学环节，例如：

- 新概念讲解：定义、性质、注意事项
- 方法讲解：步骤、条件、常见错误
- 例题讲解：题目→思路→步骤→结论
- 小结/过渡：对上一段总结、引出下一段

节点需要满足两条硬指标：

1. **可检索**：节点文本/摘要能被检索命中（RAG 用）  
   - RAG（Retrieval-Augmented Generation，检索增强生成）：先从知识库检索相关片段，再让大模型基于检索结果回答，降低幻觉。
2. **可跳转**：用户“回到刚才配方法那段”，跳到节点开头能听懂，不是跳到半句公式里。

建议的节点时长区间：**60–180 秒**（可按课程风格调到 45–240 秒）。

---

## 1. 你现在的问题为什么常见（LLM 直接切分会抖）

仅用“Whisper 转写 → 把整段字幕丢给 GPT 切边界”通常会遇到：

- 老师口头禅、重复、插话导致语义边界模糊
- 静音/停顿不一定是知识点结束（可能在写板书）
- 同一知识点可能被讲得很长（>5 分钟），需要“方法内再分段”
- 不同老师/不同课程风格差异极大，LLM 纯推断稳定性不够

稳定做法是：**多信号生成候选切点 + LLM 只做裁决/归并 + 校验回路 + 人工编辑闭环**。

---

## 2. 总体架构（推荐 V1 落地）

数据流分 6 步：

1) ASR 转写（Whisper）  
2) 句子级切分（带时间戳）  
3) 候选边界生成（多信号打分）  
4) LLM 边界裁决 + 合并/拆分（满足时长约束）  
5) 节点内容增强（title/summary/keyConcepts/embedding）  
6) 质量校验 + 人工编辑（可选但强烈建议）

---

## 3. Step 1：ASR 转写（带时间戳）

输入：视频文件  
输出：字幕片段数组 `[{text, start, end}, ...]`

要点：
- 尽量保留逐句/逐短句的时间戳，而不是只要一整段文本
- 对噪声做最小清洗：去掉重复空格、统一标点、移除明显的识别错误（可选）
- 允许“口语化残缺”，后续环节会做鲁棒处理

---

## 4. Step 2：句子级切分（Sentence/Utterance segmentation）

把 Whisper 的片段进一步规范成“句子（sentence）”或“话轮（utterance）”。

术语解释：
- **Utterance（话轮）**：一次连续说话形成的文本单元，可能不是语法完整句，但在语音上连续。
- **Sentence segmentation（句子切分）**：按标点/停顿/语义，把文本切成更细粒度句子。

输出结构建议：

```json
[
  {
    "sid": "s-001",
    "start": 12.40,
    "end": 16.20,
    "text": "接下来我们用配方法来解这个一元二次方程。"
  }
]
```

---

## 5. Step 3：候选边界生成（多信号）

核心思路：在每个句间边界（s_i 与 s_{i+1} 之间）计算“像不像节点边界”的分数，得到候选列表。

### 5.1 信号 A：声学停顿（VAD / pause）

- **VAD（Voice Activity Detection，语音活动检测）**：判断一段音频是“有人声”还是“静音/噪声”
- 取 `pause = start(s_{i+1}) - end(s_i)`  
  - pause > 1.2s：强候选
  - 0.6–1.2s：中候选
  - <0.6s：弱（但不否定）

注意：板书/思考造成的静音不一定是知识点切换，所以它只能提供“候选”。

### 5.2 信号 B：过渡语/结构词（discourse markers）

命中以下模式时，提高候选边界分：

- 过渡：`接下来|下面我们|好现在|然后我们|我们再来看|总结一下|回顾一下`
- 新概念引入：`什么是|定义是|我们先定义|概念是`
- 例题切换：`来看一道例题|例题|题目是|我们做这道题`
- 小结/收束：`所以|因此|结论是|最后我们得到`

实现：正则/词典即可；后续可做老师个性化词典。

### 5.3 信号 C：语义漂移（embedding similarity drop）

- **Embedding（向量表示）**：把文本映射到向量空间，用向量距离/角度衡量语义相似度
- **Cosine similarity（余弦相似度）**：两个向量夹角的余弦值，越大越相近

做法：
1) 以滑动窗口聚合上下文（例如前 3 句 vs 后 3 句）
2) 分别计算 embedding
3) 若相似度突然下降（例如从 0.85 降到 0.65），说明话题可能切换

阈值建议：先用统计法（均值-方差）自动定，再人工微调。

### 5.4 信号 D：教学结构/内容形态（可选）

对数学课特别有效：

- 出现“题号/小问/（1）（2）/已知/求证/解：”
- 公式密度突然上升（连续出现 `=`, `x^2`, `√`, 分式等）
- “我们先…再…”结构（方法步骤展开）

如果视频是 PPT/屏幕录制，还可加：
- **画面翻页/大幅变动**（视觉切点）：用帧差或 OCR 标题变化检测（V2 再做也行）

### 5.5 候选边界打分与输出

把各信号合成一个分数：

```text
score = w_pause * f(pause) + w_marker * hit_marker + w_sem * drop(sim) + w_struct * hit_struct
```

输出候选列表（供 LLM 裁决）：

```json
[
  {
    "time": 95.20,
    "between": ["s-012", "s-013"],
    "score": 0.86,
    "signals": ["pause>1.2s", "marker:接下来", "semantic_drop"]
  }
]
```

---

## 6. Step 4：LLM 边界裁决 + 合并/拆分（关键稳定器）

这里的关键是：**LLM 不从 0 猜边界，而是对候选做“确认/否决”，并把节点长度约束落地**。

### 6.1 输入组织方式（避免一次喂全视频）

推荐分两层：

- 粗块（chunk）：按时间先切成 4–6 分钟一块（稳定、可并行）
- 块内裁决：只在该块内裁决候选边界
- 跨块校正：处理“边界落在 chunk 边缘”的情况（合并或微调）

### 6.2 LLM 裁决 Prompt（建议）

给 LLM 的内容包括：

1) 当前 chunk 的句子列表（每句带 start/end）
2) 候选边界列表（带 signals 和 score）
3) 约束：节点时长范围、尽量“一个知识点一个节点”、允许合并/拆分

输出要求：只输出 JSON，包含每个节点的 startTime/endTime + boundary_reason（为什么切这里）。

示例输出结构（可扩展你现有模型）：

```json
[
  {
    "order": 1,
    "startTime": 0.0,
    "endTime": 95.2,
    "boundary_reason": "从定义讲解切换到第一种解法（直接开平）"
  }
]
```

### 6.3 合并/拆分策略（让节点长度合理）

LLM 裁决后再做一次规则化修正：

- 若节点 < 45 秒：与前/后相邻节点合并（优先合并同类型：概念+概念、例题+例题）
- 若节点 > 240 秒：在节点内部找次级边界（优先用语义漂移 + 结构词“步骤1/2/3”）
- 允许 2–5 秒 overlap（重叠）以保证跳转可听懂

术语解释：
- **Overlap（重叠）**：相邻节点时间上重叠一点点，让节点开头包含必要上下文，提升“跳回去能听懂”。

---

## 7. Step 5：节点内容增强（title / summary / keyConcepts / embedding）

这是你后续 RAG 的基础。

- title：10 字以内（用于进度条/侧边栏）
- summary：50–100 字（用于向量检索）
- keyConcepts：3–6 个关键词（用于关键词检索兜底）

向量化建议：
- 输入：`summary + " " + " ".join(keyConcepts)`
- 模型：如 `text-embedding-3-small`（1536 维向量）
- 存储：PostgreSQL + pgvector（pgvector 是 Postgres 的向量索引扩展）

---

## 8. Step 6：质量校验（自动拦截坏节点）

切分完成后跑一轮校验，避免“看起来切了，但体验很差”。

建议的校验项：

1) 节点开头是否“半句开始”
- 如果节点首句以“所以/因此/然后/我们继续”开头，通常需要向前扩一点（或合并）

2) 节点结尾是否“悬空”
- 如果末句以“下一步/接下来我们”结尾，通常边界应该后移

3) 单节点主题是否过多（概念+例题+总结塞一起）
- 通过 keyConcepts/summary 检查是否覆盖多个不相干概念

4) 时长分布是否异常
- 统计各节点时长的均值/方差，异常点进入“需人工复核”列表

校验输出：
- `PASS`
- `AUTO_FIX`（自动微调 start/end）
- `NEED_REVIEW`（进编辑器）

---

## 9. 人工编辑闭环（强烈建议做，且越早越好）

你不需要做复杂编辑器，V1 只要能：

- 列表展示节点（title、start/end、时长、boundary_reason）
- 时间轴拖拽调整 start/end
- 一键合并/拆分
- 编辑 title/summary/keyConcepts
- 保存版本（node_version）

为什么它是“正路”：
- 这是你未来训练边界分类器的标注数据来源
- 也是你把“切分质量从 70 分提到 90 分”的最有效手段

---

## 10. 数据结构建议（在你现有 VideoNode 上扩展）

你已有核心字段（startTime/endTime/title/summary/keyConcepts/transcript/embedding）。建议额外加：

```typescript
interface VideoNodeExt {
  boundaryConfidence: number;      // 0-1，综合分
  boundarySignals: string[];       // ["pause>1.2s","marker:接下来","semantic_drop"]
  boundaryReason: string;          // 给运营/老师看的解释
  nodeType?: "concept"|"method"|"example"|"summary"|"transition";
  version: number;                 // 人工编辑/重跑后 +1
  createdBy: "auto"|"human";
}
```

---

## 11. 评估体系（没有评估就很难“稳”）

离线评估（有人工标注后可做）：
- 边界 F1：预测边界 vs 人工边界（允许 ±3s 容差）
- 节点平均编辑次数：越低越好
- 节点时长分布：是否集中在目标区间

在线评估（上线就能做）：
- 提问命中率：RAG 召回的 top-k 是否包含正确节点
- “回溯跳转”成功率：跳转后继续播放时用户是否马上再问同一问题（是则可能没跳对）
- 回答反馈（有帮助/没帮助）
- 节点热度：哪些节点频繁回看（可能是难点，也可能切分不合理）

---

## 12. 迭代路线图（从能用到很稳）

V0（最快跑通）
- Whisper → LLM 直接切分 → LLM 增强 → 向量化
- 加人工编辑兜底

V1（推荐落地）
- 多信号候选边界 → LLM 裁决/归并 → 校验回路 → 编辑器闭环

V2（降本提稳）
- 用编辑数据训练一个“边界分类器”（轻量模型即可）
- LLM 只处理低置信/难样本

V3（多模态更强）
- 加视觉切点：翻页/标题变化/板书区域变化

---

## 13. 实现伪代码（候选边界打分）

```python
for i in range(len(sentences)-1):
    pause = sentences[i+1].start - sentences[i].end
    score_pause = f_pause(pause)

    marker_hit = hit_marker(sentences[i].text) or hit_marker(sentences[i+1].text)
    score_marker = 1.0 if marker_hit else 0.0

    sim = cosine(emb(window_prev(i)), emb(window_next(i)))
    score_sem = f_drop(sim)  # sim 越低，分越高

    struct_hit = hit_struct(sentences[i].text, sentences[i+1].text)
    score_struct = 1.0 if struct_hit else 0.0

    score = w1*score_pause + w2*score_marker + w3*score_sem + w4*score_struct
    if score >= THRESH:
        candidates.append(...)
```

---

## 14. 常见坑与处理

1) 老师写板书导致长静音  
→ 静音只做候选，不做最终边界；结合“过渡语/语义漂移”裁决。

2) 一个例题讲很久  
→ 允许“例题内分段”：题目理解/列式/推导/结论，每段 60–120 秒。

3) 老师回顾上一节内容  
→ 识别“回顾/复习/上节课”结构词，nodeType 可标为 transition/summary。

4) LLM 输出不一致（边界飘）  
→ 输入改为“候选裁决”，并固定输出 schema；加入校验回路。

---

## 15. 最小可用清单（你现在就可以照着做）

- [ ] Whisper 输出保持 `[{text,start,end}]`
- [ ] 句子级结构化（sid,start,end,text）
- [ ] 候选边界：pause + marker + semantic shift（先做这 3 个就够）
- [ ] LLM 裁决：只在候选点里选边界，并做合并/拆分
- [ ] 节点增强：title/summary/keyConcepts + embedding
- [ ] 校验：半句开头/悬空结尾/时长异常
- [ ] 简单编辑器：拖动边界 + 合并拆分 + 版本记录

---

如果你把一段带时间戳的字幕（3–8 分钟）贴出来，我可以按“候选边界 → LLM 裁决输出 JSON → 节点增强”给你跑一遍样例结果，方便你直接对照实现。
