# Skylow Math 项目全景图

**项目定位**: AI驱动的初中数学录播课交互系统
**核心理念**: 从"更快给答案"转向"更慢训思维"
**差异化**: 系统主动控制课堂节奏 + 深度学习分析

---

## 🎯 项目核心价值

```
传统录播课 = 学生被动看 + 可以随时跳过
Skylow课堂 = 系统主动停 + 学生必须回应 + 课后深度分析
```

**三大核心能力**：
1. **课堂节奏控制** - AI拥有"什么时候停"的判断权
2. **智能引导对话** - 6层判断引擎，苏格拉底式引导
3. **Deep Research** - 基于全量交互数据的深度学习分析

---

## 📊 整体架构图

```
┌─────────────────────────────────────────────────────────────────────┐
│                         用户界面层 (Next.js)                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │              VideoPlayer 页面 (全屏模式)                      │   │
│  │                                                                │   │
│  │  ┌──────────────────────────────────────────────────────┐   │   │
│  │  │  VideoPlayer.tsx                                      │   │   │
│  │  │  - HTML5 视频播放                                      │   │   │
│  │  │  - currentTime 监听                                    │   │   │
│  │  │  - pause/play/seekTo 控制                             │   │   │
│  │  └──────────────────────────────────────────────────────┘   │   │
│  │                         ↓                                     │   │
│  │  ┌──────────────────────────────────────────────────────┐   │   │
│  │  │  ProactiveTriggerController.tsx (主动触发)            │   │   │
│  │  │  - 监听 currentTime                                    │   │   │
│  │  │  - 检测 trigger_time                                   │   │   │
│  │  │  - 弹出检查题                                          │   │   │
│  │  │  - 收集学生回答                                        │   │   │
│  │  └──────────────────────────────────────────────────────┘   │   │
│  │                         ↓                                     │   │
│  │  ┌──────────────────────────────────────────────────────┐   │   │
│  │  │  VoiceChat.tsx (语音交互)                             │   │   │
│  │  │  - DoubaoVoiceClient (WebSocket)                      │   │   │
│  │  │  - VAD检测 → 自动暂停视频                             │   │   │
│  │  │  - ASR转文本                                           │   │   │
│  │  │  - 检测困惑关键词 → 触发ConfusionLocator              │   │   │
│  │  │  - TTS播放AI回答                                       │   │   │
│  │  └──────────────────────────────────────────────────────┘   │   │
│  │                         ↓                                     │   │
│  │  ┌──────────────────────────────────────────────────────┐   │   │
│  │  │  ConfusionLocator.tsx (困惑定位)                       │   │   │
│  │  │  - 两级选择菜单                                        │   │   │
│  │  │  - 4大类困惑 × 3个子类型                               │   │   │
│  │  │  - 发送到后端分析                                      │   │   │
│  │  └──────────────────────────────────────────────────────┘   │   │
│  │                                                                │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │              Report 页面 (课后学习报告)                       │   │
│  │                                                                │   │
│  │  - 学习统计卡片（检查点数、正确率、困惑点、学习时长）         │   │
│  │  - 学习总结                                                    │   │
│  │  - 知识掌握情况（熟练/基本/部分/未掌握）                      │   │
│  │  - 困惑点分析（热点识别）                                      │   │
│  │  - 学习建议 + 鼓励的话                                         │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘
                                    ↕ HTTP/WebSocket
┌─────────────────────────────────────────────────────────────────────┐
│                      后端服务层 (FastAPI + Python)                    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    main.py (API路由)                           │   │
│  │                                                                │   │
│  │  GET  /api/v2/proactive_checks/{video_id}                     │   │
│  │       → 返回主动检查点配置                                      │   │
│  │                                                                │   │
│  │  POST /api/v2/proactive_check/response                        │   │
│  │       → 记录学生检查响应                                        │   │
│  │                                                                │   │
│  │  POST /api/v2/confusion/identify                              │   │
│  │       → 处理困惑定位，生成针对性解释                            │   │
│  │                                                                │   │
│  │  GET  /api/v2/learning_report/{session_id}                    │   │
│  │       → 生成/获取学习报告                                       │   │
│  │                                                                │   │
│  │  WS   /ws/voice/{video_id}                                    │   │
│  │       → 实时语音交互 (ASR + LLM + TTS)                         │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                    ↓                                  │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │           TeacherJudgmentEngine (6层判断引擎)                  │   │
│  │                                                                │   │
│  │  判断流程：                                                     │   │
│  │  1. check_knowledge_boundary()    - 知识边界判断               │   │
│  │     → 超纲/跑题 → REFUSE                                       │   │
│  │                                                                │   │
│  │  2. check_topic_relevance()       - 话题相关性判断             │   │
│  │     → 未来内容 → DEFER（延迟回答）                             │   │
│  │                                                                │   │
│  │  3. classify_intent()             - 意图分类                   │   │
│  │     → clarify_concept / understand_why / lazy_question         │   │
│  │                                                                │   │
│  │  4. identify_confusion_point()    - 困惑点定位                 │   │
│  │     → concept_unclear / step_confused / misconception          │   │
│  │     → 严重程度: mild / moderate / severe                       │   │
│  │                                                                │   │
│  │  5. determine_response_depth()    - 回应深度判断               │   │
│  │     → counter_question (反问)                                  │   │
│  │     → hint_only (提示)                                         │   │
│  │     → partial_explain (部分解释)                               │   │
│  │     → full_explain (完整解释)                                  │   │
│  │                                                                │   │
│  │  6. should_intervene()            - 学习状态评估               │   │
│  │     → encourage / slow_down / review / none                   │   │
│  │                                                                │   │
│  │  → _synthesize_judgment()         - 综合判断生成最终回应       │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                    ↓                                  │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │            DeepResearchEngine (深度分析引擎)                   │   │
│  │                                                                │   │
│  │  分析流程：                                                     │   │
│  │  1. collect_session_data()      - 收集会话数据                 │   │
│  │     → proactive_check_responses                                │   │
│  │     → confusion_records                                        │   │
│  │     → conversation_history                                     │   │
│  │     → learning_behaviors                                       │   │
│  │     → student_state_snapshots                                  │   │
│  │                                                                │   │
│  │  2. analyze_all_dimensions()    - 5维度分析                    │   │
│  │     ├─ analyze_knowledge_mastery()      - 知识掌握            │   │
│  │     │   → 正确率、响应时间 → 熟练/基本/部分/未掌握             │   │
│  │     ├─ analyze_confusion_patterns()     - 困惑模式            │   │
│  │     │   → 统计分布、识别热点                                   │   │
│  │     ├─ analyze_learning_behavior()      - 学习行为            │   │
│  │     │   → 暂停/回看/跳过 → 反复回看型/频繁暂停型               │   │
│  │     ├─ analyze_interaction_quality()    - 互动质量            │   │
│  │     │   → 提问次数、问题质量评分                               │   │
│  │     └─ analyze_comprehension_trend()    - 理解度趋势          │   │
│  │         → 上升/下降/稳定                                        │   │
│  │                                                                │   │
│  │  3. synthesize_report()         - LLM生成自然语言报告          │   │
│  │     → 学习总结、知识掌握、困惑分析、学习建议、鼓励的话         │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                    ↓                                  │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                   Agent 系统 (7个专业Agent)                    │   │
│  │                                                                │   │
│  │  ├─ ConceptExplainerAgent         - 概念解释                   │   │
│  │  ├─ StepByStepGuideAgent          - 步骤引导                   │   │
│  │  ├─ MisconceptionCorrectorAgent   - 误区纠正                   │   │
│  │  ├─ PatternRecognitionAgent       - 规律发现引导               │   │
│  │  ├─ ExampleGeneratorAgent         - 例题生成                   │   │
│  │  ├─ PrerequisiteCheckerAgent      - 前置知识检查               │   │
│  │  └─ MotivationAgent               - 学习动机激发               │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                    ↓                                  │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    RAG Engine (知识检索)                        │   │
│  │                                                                │   │
│  │  - Chroma向量数据库                                             │   │
│  │  - Embedding: text-embedding-ada-002                           │   │
│  │  - 知识点切片存储                                               │   │
│  │  - 语义搜索 + 时间戳定位                                        │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘
                                    ↕
┌─────────────────────────────────────────────────────────────────────┐
│                      数据层 (PostgreSQL)                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  [V1.0 表]                                                            │
│  ├─ conversation_history            - 对话记录                        │
│  ├─ learning_behaviors              - 学习行为轨迹                    │
│  ├─ student_state_snapshots         - 学生状态快照                    │
│  └─ knowledge_base                  - 知识库                          │
│                                                                       │
│  [V2.0 新增表]                                                        │
│  ├─ proactive_check_responses       - 主动检查响应记录                │
│  │   └─ 字段: session_id, check_id, selected_option,                │
│  │            is_correct, response_time, next_action                 │
│  │                                                                    │
│  ├─ confusion_records               - 困惑记录                        │
│  │   └─ 字段: session_id, timestamp, category, sub_type,            │
│  │            prompt, resolution_method                              │
│  │                                                                    │
│  └─ learning_reports                - 学习报告                        │
│      └─ 字段: session_id (UNIQUE), report_data (JSON)                │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘
                                    ↕
┌─────────────────────────────────────────────────────────────────────┐
│                      外部服务层                                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐ │
│  │  豆包语音服务     │  │  OpenAI API       │  │  文件系统         │ │
│  │                  │  │                  │  │                  │ │
│  │  - ASR (语音转文本│  │  - GPT-4 (对话)  │  │  - 视频文件       │ │
│  │  - TTS (文本转语音│  │  - Embedding     │  │  - knowledge_    │ │
│  │  - VAD (端点检测) │  │                  │  │    points.json   │ │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘ │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 🔄 核心数据流

### 流程1：主动触发系统

```
用户行为                    系统响应                    数据记录
────────────────────────────────────────────────────────────────────

1. 学生开始学习
   点击 JOIN CALL
                     →  建立 WebSocket 连接
                         加载 proactive_checks 配置
                         视频开始播放

2. 视频播放中
   currentTime: 125.5s
                     →  VideoPlayer.onTimeUpdate()
                         传递 currentTime 给
                         ProactiveTriggerController

3. 到达触发点
   currentTime: 130.0s
                     →  检测到 trigger_time = 130.0
                         暂停视频
                         弹出检查题界面
                         "刚才讲的 ax²+bx+c=0,
                          a、b、c 分别是什么？"

4. 学生选择答案
   点击选项 A
   (响应时间: 8.5s)
                     →  记录响应到后端
                         POST /api/v2/proactive_check/response
                                               ↓
                                    proactive_check_responses 表
                                    ├─ session_id
                                    ├─ check_id: kp001_check1
                                    ├─ selected_option: A
                                    ├─ is_correct: true
                                    ├─ response_time: 8.5
                                    └─ next_action: continue

5. 显示反馈
   "对的！特别注意，
    a必须≠0"
   (2秒后自动关闭)

6. 执行后续动作
   next_action: continue
                     →  恢复视频播放
                         更新 student_state_snapshots
                         └─ comprehension_level: 1.0
```

---

### 流程2：学生主动提问 (明确问题)

```
用户行为                    系统响应                    数据记录
────────────────────────────────────────────────────────────────────

1. 学生说话
   "为什么a不能等于0？"
                     →  VAD检测 → vad_detected
                         自动暂停视频
                         ASR转文本
                         → transcript: "为什么a不能等于0？"

2. 进入判断引擎
                     →  TeacherJudgmentEngine.judge()

   第1层：知识边界判断
                     →  check_knowledge_boundary()
                         判断：属于课程范围内 ✓
                         继续下一层

   第2层：话题相关性
                     →  check_topic_relevance()
                         判断：与当前主题相关 ✓
                         继续下一层

   第3层：意图分类
                     →  classify_intent()
                         判断：understand_why (理解原理)

   第4层：困惑点定位
                     →  identify_confusion_point()
                         RAG检索相关知识
                         判断：concept_unclear
                         严重程度：moderate

   第5层：回应深度判断
                     →  determine_response_depth()
                         intent: understand_why
                         severity: moderate
                         → 决策：partial_explain (部分解释)

   第6层：学习状态评估
                     →  should_intervene()
                         检查学生状态
                         → 干预：none

   综合判断生成回应
                     →  _synthesize_judgment()
                         构建提示词
                         调用 GPT-4 生成回答
                         → "好问题！我们先想想，
                             如果a=0会发生什么？
                             ax²这一项会变成什么？
                             (给学生思考空间)
                             对，会变成0。那这个方程
                             还是二次方程吗？..."
                                               ↓
                                    conversation_history 表
                                    ├─ role: user
                                    ├─ content: "为什么a不能等于0？"
                                    ├─ judgment_type: partial
                                    ├─ intent: understand_why
                                    ├─ confusion_type: concept_unclear
                                    └─ response_depth: partial_explain

3. TTS播放回答
   豆包语音服务
                     →  生成语音
                         流式返回音频chunk
                         前端播放

4. AI回答完毕
                     →  视频保持暂停
                         等待学生说"继续"
```

---

### 流程3：学生主动提问 (模糊表达)

```
用户行为                    系统响应                    数据记录
────────────────────────────────────────────────────────────────────

1. 学生说话
   "我有点懵"
                     →  VAD检测 → vad_detected
                         自动暂停视频
                         ASR转文本
                         → transcript: "我有点懵"

2. 检测困惑关键词
                     →  VoiceChat.tsx
                         confusionKeywords = ['懵', '不懂', ...]
                         检测到：isConfusionExpression ✓
                         文本长度 < 15 ✓

                         → 触发 onShowConfusionLocator()

3. 弹出困惑定位器
   显示4大类选项：
   📖 概念理解
   🔢 步骤推导
   🎯 条件理解
   🤔 整体理解

4. 学生选择类别
   点击 "📖 概念理解"
                     →  进入第二级选择
                         显示子类型：
                         - 定义不清楚
                         - 不知道是什么意思
                         - 不知道为什么

5. 学生选择子类型
   点击 "不知道为什么"
                     →  构建困惑数据
                         POST /api/v2/confusion/identify
                         {
                           category: "concept",
                           sub_type: "why",
                           prompt: "不明白为什么要这样定义",
                           concept: "一元二次方程的一般形式",
                           timestamp: 130.0
                         }
                                               ↓
                                    confusion_records 表
                                    ├─ session_id
                                    ├─ video_id
                                    ├─ timestamp: 130.0
                                    ├─ concept: "一元二次方程..."
                                    ├─ category: concept
                                    ├─ sub_type: why
                                    └─ prompt: "不明白为什么..."

6. 后端生成解释
                     →  RAG检索相关知识
                         generate_targeted_explanation()
                         使用专门的提示词模板：
                         "学生对'一元二次方程的一般形式'
                          为什么要这样定义不理解...
                          请解释背后的原因..."

                         GPT-4生成针对性解释

7. 返回解释+选项
   显示解释内容
   + 后续选项：
   A. 明白了，继续
   B. 还是有点不清楚
   C. 能举个例子吗

8. 学生确认理解
   点击 "明白了，继续"
                     →  关闭困惑定位器
                         恢复视频播放
```

---

### 流程4：课后报告生成

```
系统行为                    分析过程                    数据源
────────────────────────────────────────────────────────────────────

1. 学生学习结束
   访问 /report/[sessionId]
                     →  检查是否已有报告
                         SELECT * FROM learning_reports
                         WHERE session_id = ?

2. 如果没有报告
                     →  触发 Deep Research Engine
                         generate_learning_report()

3. 收集会话数据
                     →  collect_session_data()
                                               ↓
                         proactive_check_responses    - 8条记录
                         confusion_records             - 3条记录
                         conversation_history          - 12条记录
                         learning_behaviors            - 45条记录
                         student_state_snapshots       - 15条记录

4. 分析维度1：知识掌握
                     →  analyze_knowledge_mastery()

                         kp001: 正确率 87.5%, 响应时间 10.2s
                         → 熟练掌握

                         kp002: 正确率 62.5%, 响应时间 18.5s
                         → 基本掌握

                         kp003: 正确率 37.5%, 响应时间 25.3s
                         → 部分掌握

5. 分析维度2：困惑模式
                     →  analyze_confusion_patterns()

                         category_distribution:
                         - concept: 5次 (最多)
                         - step: 3次
                         - overall: 2次

                         confusion_hotspots:
                         - "为什么a≠0": 3次困惑 (热点)
                         - "判别式的作用": 2次困惑

6. 分析维度3：学习行为
                     →  analyze_learning_behavior()

                         pause_count: 12
                         replay_count: 8 (高)
                         skip_count: 0

                         → 行为模式：反复回看型
                           "学习认真，会主动复习不懂的部分"

7. 分析维度4：互动质量
                     →  analyze_interaction_quality()

                         total_interactions: 12
                         high_quality_questions: 9
                         lazy_questions: 1

                         → 互动质量分数：0.75 (良好)

8. 分析维度5：理解度趋势
                     →  analyze_comprehension_trend()

                         initial: 0.45
                         final: 0.78

                         → 趋势：上升 (理解度逐渐提高)

9. LLM生成自然语言报告
                     →  synthesize_report()

                         将所有分析数据打包
                         构建提示词：
                         "你是一位经验丰富的数学老师，
                          需要根据学生的学习数据生成
                          课后学习报告..."

                         GPT-4生成：
                         - 学习总结 (100字)
                         - 知识掌握情况 (150字)
                         - 困惑点分析 (150字)
                         - 学习建议 (200字)
                         - 鼓励的话 (50字)

10. 保存报告
                     →  save_report()
                                               ↓
                         learning_reports 表
                         ├─ session_id (UNIQUE)
                         └─ report_data (JSON)
                              {
                                "report_text": {
                                  "summary": "...",
                                  "knowledge_status": "...",
                                  ...
                                },
                                "detailed_analysis": {...},
                                "statistics": {...}
                              }

11. 前端展示报告
   /report/[sessionId]
                     →  ReportPage.tsx

                         渲染卡片：
                         ┌─────────┬─────────┬─────────┬─────────┐
                         │ 8个     │ 75%     │ 3个     │ 45分钟  │
                         │ 检查点  │ 正确率  │ 困惑点  │ 学习时长│
                         └─────────┴─────────┴─────────┴─────────┘

                         + 学习总结
                         + 知识掌握情况（颜色标记）
                         + 困惑点分析（热点高亮）
                         + 学习建议
                         + 鼓励的话
```

---

## 🏗️ 技术栈详解

### 前端技术栈

```
Next.js 14 (App Router)
├─ React 18
├─ TypeScript
├─ Tailwind CSS
└─ 核心库
   ├─ @anthropic-ai/sdk (未使用，备用)
   └─ WebSocket (原生，用于豆包语音)

组件结构：
src/
├─ app/
│  ├─ page.tsx                        - 首页（视频列表）
│  ├─ video/[id]/page.tsx             - 视频播放页 ⭐
│  └─ report/[sessionId]/page.tsx     - 学习报告页 ⭐
├─ components/
│  ├─ VideoPlayer.tsx                 - 视频播放器
│  ├─ VoiceChat.tsx                   - 语音交互 ⭐
│  ├─ ProactiveTriggerController.tsx  - 主动触发 ⭐ (V2.0)
│  └─ ConfusionLocator.tsx            - 困惑定位 ⭐ (V2.0)
└─ lib/
   ├─ api.ts                          - API封装
   ├─ doubao-voice-client.ts          - 豆包语音客户端 ⭐
   └─ confusion-taxonomy.ts           - 困惑分类体系 ⭐ (V2.0)
```

### 后端技术栈

```
Python 3.10+
├─ FastAPI (Web框架)
├─ Uvicorn (ASGI服务器)
├─ WebSocket (实时通信)
└─ 核心库
   ├─ openai                   - GPT-4 调用
   ├─ langchain                - LLM编排
   ├─ chromadb                 - 向量数据库
   ├─ psycopg2                 - PostgreSQL驱动
   └─ volcengine-python-sdk    - 豆包语音服务

架构结构：
backend/
├─ main.py                              - 主服务 + API路由
├─ teacher_judgment_engine.py           - 6层判断引擎 ⭐
├─ deep_research_engine_v2.py           - Deep Research ⭐ (V2.0)
├─ agents/
│  ├─ concept_explainer.py              - 概念解释Agent
│  ├─ step_by_step_guide.py             - 步骤引导Agent
│  ├─ misconception_corrector.py        - 误区纠正Agent
│  ├─ pattern_recognition.py            - 规律发现Agent
│  ├─ example_generator.py              - 例题生成Agent
│  ├─ prerequisite_checker.py           - 前置知识检查Agent
│  └─ motivation.py                     - 学习动机激发Agent
├─ rag_engine.py                        - RAG检索引擎
├─ intent_classifier.py                 - 意图分类器
├─ doubao_voice.py                      - 豆包语音集成
└─ migrations/
   ├─ 001_init_schema.sql               - V1.0 表结构
   └─ 002_add_v2_tables.sql             - V2.0 表结构 ⭐
```

---

## 📁 关键文件说明

### 核心配置文件

**knowledge_points.json** (知识点配置)
```json
{
  "video_id": "video_001",
  "title": "一元二次方程的定义",
  "knowledge_points": [
    {
      "concept_name": "一元二次方程的一般形式",
      "timestamp": 125.5,
      "content": "...",
      "proactive_checks": [...]  // ⭐ V2.0新增
    }
  ]
}
```

作用：
- 定义视频中的知识点切片
- 配置主动检查点（trigger_time, question, options）
- RAG检索的数据源

---

### 数据库Schema核心表

**V1.0 表**：
```
conversation_history        - 对话记录
├─ id (自增)
├─ session_id              - 会话ID
├─ role                    - user/assistant
├─ content                 - 对话内容
├─ timestamp               - 时间戳
├─ judgment_type           - 判断类型 (V2.0新增字段)
├─ intent                  - 意图分类 (V2.0新增字段)
├─ confusion_type          - 困惑类型 (V2.0新增字段)
└─ response_depth          - 回应深度 (V2.0新增字段)

student_state_snapshots    - 学生状态快照
├─ id
├─ session_id
├─ timestamp
├─ comprehension_level     - 理解度 (0-1)
├─ confusion_level         - 困惑度 (0-1)
└─ created_at

learning_behaviors         - 学习行为轨迹
├─ id
├─ session_id
├─ action                  - pause/replay/skip
├─ timestamp
└─ created_at
```

**V2.0 新增表**：
```
proactive_check_responses  - 主动检查响应记录 ⭐
├─ id
├─ session_id
├─ video_id
├─ check_id               - kp001_check1
├─ check_type             - critical_concept/prerequisite
├─ selected_option        - A/B/C
├─ is_correct             - true/false
├─ is_timeout             - 是否超时
├─ response_time          - 响应时长(秒)
├─ next_action            - continue/reteach/defer
├─ timestamp              - 视频时间戳
└─ created_at

confusion_records          - 困惑记录 ⭐
├─ id
├─ session_id
├─ video_id
├─ timestamp
├─ concept                - 当前知识点
├─ category               - concept/step/condition/overall
├─ sub_type               - definition/logic/identify等
├─ prompt                 - "不明白为什么要这样定义"
├─ resolution_method      - guided/whiteboard/reteach
└─ created_at

learning_reports           - 学习报告 ⭐
├─ id
├─ session_id (UNIQUE)
├─ report_data (JSON)     - 完整报告数据
└─ created_at
```

---

## 🎨 用户体验流程

### 完整学习旅程

```
第1步：进入学习
┌──────────────────────────────────────────┐
│  浏览器访问：http://localhost:3000       │
│  选择视频：点击"一元二次方程的定义"      │
│  进入页面：/video/001                    │
└──────────────────────────────────────────┘
                    ↓
第2步：建立连接
┌──────────────────────────────────────────┐
│  全屏视频界面                             │
│  中央显示：JOIN CALL 按钮                │
│  ────────────────────────────────────    │
│  点击按钮 → 请求麦克风权限               │
│            → 建立WebSocket连接           │
│            → 视频自动开始播放            │
└──────────────────────────────────────────┘
                    ↓
第3步：视频学习中
┌──────────────────────────────────────────┐
│  [视频画面：沈老师讲解]                  │
│  "一元二次方程的一般形式是 ax²+bx+c=0"  │
│                                          │
│  底部控制条：                             │
│  🎤 随时说话即可提问                     │
│  💬 说"继续"来继续播放                   │
│  ❌ END CALL 结束通话                    │
└──────────────────────────────────────────┘
                    ↓
第4步：主动检查点触发 (130秒处)
┌──────────────────────────────────────────┐
│  [视频自动暂停]                          │
│                                          │
│  ┌────────────────────────────────────┐ │
│  │  🎯 关键检查点        ⏱️ 30秒       │ │
│  │                                    │ │
│  │  刚才讲的 ax²+bx+c=0，             │ │
│  │  a、b、c 分别是什么？              │ │
│  │                                    │ │
│  │  [ ] A. a是二次项系数，b是一次项   │ │
│  │         系数，c是常数项            │ │
│  │  [ ] B. 都是未知数                 │ │
│  │  [ ] C. 不太清楚，能再讲一遍吗     │ │
│  └────────────────────────────────────┘ │
└──────────────────────────────────────────┘
        学生点击选项A (8.5秒后)
                    ↓
第5步：反馈显示
┌──────────────────────────────────────────┐
│  [选项A高亮为蓝色]                       │
│                                          │
│  ┌────────────────────────────────────┐ │
│  │  ✓ 对的！特别注意，a必须≠0，       │ │
│  │    否则就不是二次方程了。          │ │
│  └────────────────────────────────────┘ │
│                                          │
│  (2秒后自动关闭，视频继续播放)          │
└──────────────────────────────────────────┘
                    ↓
第6步：学生主动提问
┌──────────────────────────────────────────┐
│  [学生对着麦克风说话]                    │
│  学生："为什么a不能等于0？"              │
│                                          │
│  [视频自动暂停]                          │
│  底部控制条显示：                         │
│  🔵 正在听你说话...                      │
└──────────────────────────────────────────┘
                    ↓
第7步：AI思考 + 回答
┌──────────────────────────────────────────┐
│  [视频保持暂停]                          │
│                                          │
│  底部控制条显示：                         │
│  🟣 沈老师正在回答... ● ● ●             │
│                                          │
│  [语音播放AI回答]                        │
│  AI："好问题！我们先想想，如果a=0会     │
│      发生什么？ax²这一项会变成什么？     │
│      ...（苏格拉底式引导）"              │
└──────────────────────────────────────────┘
                    ↓
第8步：困惑表达 (模糊)
┌──────────────────────────────────────────┐
│  [学生说话]                              │
│  学生："我有点懵"                        │
│                                          │
│  [检测到困惑关键词]                      │
│  ↓                                       │
│  [自动弹出困惑定位器]                    │
│                                          │
│  ┌────────────────────────────────────┐ │
│  │  你在哪方面有疑问？            ✕  │ │
│  │                                    │ │
│  │  ┌───────┐  ┌───────┐            │ │
│  │  │ 📖    │  │ 🔢    │            │ │
│  │  │概念理 │  │步骤推 │            │ │
│  │  │解     │  │导     │            │ │
│  │  └───────┘  └───────┘            │ │
│  │                                    │ │
│  │  ┌───────┐  ┌───────┐            │ │
│  │  │ 🎯    │  │ 🤔    │            │ │
│  │  │条件理 │  │整体理 │            │ │
│  │  │解     │  │解     │            │ │
│  │  └───────┘  └───────┘            │ │
│  │                                    │ │
│  │  💬 我的问题不在这里，想直接说     │ │
│  └────────────────────────────────────┘ │
└──────────────────────────────────────────┘
        学生点击 "📖 概念理解"
                    ↓
第9步：困惑细化定位
┌──────────────────────────────────────────┐
│  ┌────────────────────────────────────┐ │
│  │  ← 返回  概念理解 - 具体是？       │ │
│  │                                    │ │
│  │  ┌──────────────────────────────┐ │ │
│  │  │ 定义不清楚                    │ │ │
│  │  │ "这个概念的定义我还不太明白"  │ │ │
│  │  └──────────────────────────────┘ │ │
│  │                                    │ │
│  │  ┌──────────────────────────────┐ │ │
│  │  │ 不知道是什么意思              │ │ │
│  │  │ "不太理解这个词/符号的含义"   │ │ │
│  │  └──────────────────────────────┘ │ │
│  │                                    │ │
│  │  ┌──────────────────────────────┐ │ │
│  │  │ 不知道为什么                  │ │ │
│  │  │ "不明白为什么要这样定义"      │ │ │
│  │  └──────────────────────────────┘ │ │
│  └────────────────────────────────────┘ │
└──────────────────────────────────────────┘
        学生点击 "不知道为什么"
                    ↓
第10步：针对性解释
┌──────────────────────────────────────────┐
│  [困惑定位器关闭]                        │
│  [语音播放针对性解释]                    │
│                                          │
│  AI："关于为什么要这样定义一元二次方程， │
│      这背后有数学历史的原因...           │
│      (详细解释概念背后的'为什么')"       │
│                                          │
│  [显示后续选项]                          │
│  A. 明白了，继续                         │
│  B. 还是有点不清楚                       │
│  C. 能举个例子吗                         │
└──────────────────────────────────────────┘
        学生选择 "明白了，继续"
                    ↓
第11步：继续学习
┌──────────────────────────────────────────┐
│  [视频恢复播放]                          │
│  继续学习后续内容...                     │
│                                          │
│  (整个学习过程中，所有交互数据都在       │
│   后台静默记录到数据库)                  │
└──────────────────────────────────────────┘
                    ↓
第12步：学习结束，查看报告
┌──────────────────────────────────────────┐
│  访问：/report/session_xxx               │
│                                          │
│  ┌────────────────────────────────────┐ │
│  │  📊 课后学习报告                   │ │
│  │                                    │ │
│  │  [统计卡片]                        │ │
│  │  8个检查点 | 75%正确率              │ │
│  │  3个困惑点 | 45分钟学习时长         │ │
│  │                                    │ │
│  │  📝 学习总结                       │ │
│  │  今天你在一元二次方程的定义部分... │ │
│  │                                    │ │
│  │  🎯 知识掌握情况                   │ │
│  │  ✅ 一般形式定义 - 熟练掌握         │ │
│  │  🟡 系数的作用 - 基本掌握           │ │
│  │  🔴 a≠0的原因 - 需要巩固            │ │
│  │                                    │ │
│  │  💭 困惑点分析                     │ │
│  │  主要困惑在"为什么a≠0"这个概念上... │ │
│  │                                    │ │
│  │  💡 学习建议                       │ │
│  │  建议重点复习...                   │ │
│  │                                    │ │
│  │  🌟 鼓励的话                       │ │
│  │  "你的提问质量很高，说明你在认真   │ │
│  │   思考！继续保持这种学习态度！"    │ │
│  │                   —— 沈老师        │ │
│  └────────────────────────────────────┘ │
└──────────────────────────────────────────┘
```

---

## 🔑 核心差异化能力

### 1. 主动触发 vs 被动问答

**传统录播课**：
```
学生看视频 → 有问题 → 自己思考要不要问 → 组织语言 → 提问
                   ↓ (大部分情况)
                 不问了
```

**Skylow**：
```
视频播放 → 系统检测到关键时间点 → 自动暂停 → 强制检查
                                              ↓
                                    学生必须回应
                                              ↓
                              根据回答决定：继续 or 重讲
```

**价值**：
- 不依赖学生的主动性
- 确保关键知识点必须被检查
- 类似真实课堂的"老师盯着你"的感觉

---

### 2. 6层判断 vs 直接回答

**传统AI问答**：
```
学生问题 → LLM直接生成答案 → 返回
```

**Skylow 6层判断**：
```
学生问题
    ↓
第1层：这个问题超纲吗？（知识边界）
    ↓ 不超纲
第2层：和当前讲的内容相关吗？（话题相关性）
    ↓ 相关
第3层：学生想要什么？（意图分类）
    ↓ 理解原理
第4层：具体困惑在哪里？（困惑定位）
    ↓ 概念不清，中等严重
第5层：应该回答到什么程度？（回应深度）
    ↓ 部分解释（不直接给答案）
第6层：需要特殊干预吗？（学习状态评估）
    ↓ 不需要
综合判断 → 生成苏格拉底式引导回答
```

**价值**：
- 不是"更快给答案"，而是"引导思考"
- 懒惰提问 → 反问
- 严重困惑 → 完整解释
- 符合教学原理

---

### 3. Deep Research vs 简单统计

**传统学习平台**：
```
统计数据：
- 观看时长：45分钟
- 完成率：80%
- 正确率：75%
```

**Skylow Deep Research**：
```
收集全量交互数据：
├─ 8次主动检查（每次的选择+响应时间）
├─ 3次困惑定位（具体困惑类型）
├─ 12次对话（每次的判断结果）
├─ 45次行为（暂停/回看/跳过）
└─ 15个状态快照（理解度变化）

5维度分析：
├─ 知识掌握：哪些懂/哪些不懂/掌握程度
├─ 困惑模式：什么类型困惑/困惑热点
├─ 学习行为：反复回看型/频繁暂停型
├─ 互动质量：提问质量/互动频率
└─ 理解度趋势：上升/下降/稳定

LLM生成自然语言报告：
"今天你在'为什么a≠0'这个点上反复回看了3次，
 说明这是你的困惑热点。建议重点复习二次方程
 的定义部分..."
```

**价值**：
- 真正理解学生的学习过程
- 个性化的学习建议
- 不是冷冰冰的数字，是温暖的老师点评

---

## 💡 技术创新点

### 1. 豆包语音 + WebSocket实时通信

```
传统方案：OpenAI Realtime API
问题：贵、不稳定、国内访问困难

Skylow方案：豆包语音 + 自建WebSocket
优势：
├─ 成本更低（豆包语音比OpenAI便宜）
├─ 更稳定（国内服务，延迟低）
├─ 可控性强（完全掌握数据流）
└─ 支持VAD（端点检测）自动暂停视频
```

### 2. 主动触发 + 被动问答双模式

```
两种模式无缝切换：

模式1：主动触发（系统控制）
  - 到达关键时间点
  - 系统主动暂停
  - 弹出预设检查题
  - 强制学生回应

模式2：被动问答（学生控制）
  - 学生随时说话
  - 系统自动暂停
  - 进入6层判断
  - 引导式回答

价值：既有控制感，又有灵活性
```

### 3. 困惑定位 + 开放提问混合

```
降低提问门槛：

学生说"我有点懵"
    ↓
系统：你具体是哪方面懵？（选择式）
    ├─ 概念理解
    ├─ 步骤推导
    ├─ 条件理解
    └─ 💬 我的问题不在这里，想直接说（保留开放）

价值：
- 不会提问的学生 → 通过选择定位
- 会提问的学生 → 可以直接说
```

---

## 📈 数据流转全景

```
用户操作               前端状态              后端处理              数据存储
─────────────────────────────────────────────────────────────────────────

[学生点击JOIN CALL]
                  → isConnected=true
                                    → WebSocket连接建立
                                    → 加载knowledge_points.json
                                                        → (无)

[视频播放到130秒]
                  → currentTime=130.0
                  → ProactiveTriggerController检测
                  → 匹配到trigger_time
                  → 暂停视频
                  → 显示检查题界面

[学生选择选项A]
                  → selectedOption="A"
                  → POST请求
                                    → 记录响应
                                    → 更新student_state
                                                        → proactive_check_responses表
                                                        → student_state_snapshots表

[学生说"为什么a≠0"]
                  → VAD检测
                  → 暂停视频
                  → 发送音频
                                    → ASR转文本
                                    → 进入6层判断引擎
                                    → Layer1: 知识边界 ✓
                                    → Layer2: 话题相关 ✓
                                    → Layer3: 意图=understand_why
                                    → Layer4: 困惑=concept_unclear
                                    → Layer5: 深度=partial_explain
                                    → Layer6: 干预=none
                                    → 综合判断
                                    → GPT-4生成回答
                                    → TTS生成语音
                                                        → conversation_history表
                                                           (含judgment_type等字段)

[学生说"我有点懵"]
                  → 检测困惑关键词
                  → 弹出ConfusionLocator
[选择:概念理解→为什么]
                  → POST请求
                                    → RAG检索
                                    → 生成针对性解释
                                                        → confusion_records表

[学习结束，访问/report]
                  → 加载中...
                                    → 检查learning_reports
                                    → 如果没有 → 触发Deep Research
                                    → collect_session_data()
                                    → analyze_all_dimensions()
                                    → synthesize_report()
                                    → save_report()
                                                        → learning_reports表
                  → 显示报告内容
```

---

## 🎓 教育理念体现

### 苏格拉底式引导

**不直接给答案，而是引导思考**

```python
# determine_response_depth() 的设计哲学

if intent == "lazy_question":
    return "counter_question"  # 懒惰提问 → 反问

if intent == "find_pattern":
    return "counter_question"  # 寻找规律 → 反问（不直接给）

if confusion_severity == "severe":
    return "full_explain"      # 严重困惑 → 完整解释（避免挫败）

if confusion_severity == "moderate":
    return "partial_explain"   # 中等困惑 → 部分解释（引导完成）

if confusion_severity == "mild":
    return "hint_only"         # 轻微困惑 → 只给提示
```

**体现**：
- 不是"更快给答案"
- 而是"让学生自己想通"
- 符合学习科学原理

---

### 主动干预机制

**不等学生卡住，提前预判**

```python
# should_intervene() 的设计哲学

if student_state["comprehension_trend"] == "declining":
    return {
        "type": "slow_down",
        "message": "我注意到最近几个知识点你都有疑问。
                   是不是讲得有点快了？要不要我们放慢一点？"
    }

if confusion["confusion_type"] == "prerequisite_missing":
    return {
        "type": "review",
        "message": "看起来这个问题涉及到之前的内容。
                   你对[前置知识点]还熟悉吗？"
    }
```

**体现**：
- 类似真实老师的"眼神观察"
- 提前发现问题
- 主动提供帮助

---

### 个性化学习路径

**根据学生状态动态调整**

```
学生A：反复回看型
  → 行为：replay_count > 5
  → 解读：学习认真，会主动复习
  → 建议：保持这种学习习惯，可以适当加快进度

学生B：频繁暂停型
  → 行为：pause_count > 10
  → 解读：有思考习惯，但可能跟不上节奏
  → 建议：建议放慢速度，确保每个知识点都理解

学生C：快速跳过型
  → 行为：skip_count > 3
  → 解读：可能觉得太简单，或者太难放弃了
  → 建议：需要进一步分析困惑模式判断原因
```

---

## 🚀 未来扩展方向

### 已实现 ✅
- [x] 主动触发系统
- [x] 6层判断引擎
- [x] 困惑定位系统
- [x] Deep Research分析
- [x] 学习报告生成
- [x] 豆包语音集成

### 可扩展 🔮

**1. 画板系统（PRD已设计）**
```
- 数学公式渲染（KaTeX）
- 推导步骤展示（逐步动画）
- 错误示范对比
- 条件标注可视化
```

**2. 多模态输入**
```
- 支持学生手写公式识别
- 拍照提问（OCR识别题目）
- 画板协同（学生和AI共同在画板上推导）
```

**3. 社交学习**
```
- 学习进度排行榜
- 困惑点讨论区（相同困惑的学生互相帮助）
- 学习小组模式
```

**4. 家长端**
```
- 学习报告推送（每节课后）
- 学习轨迹可视化（一周/一月/一学期）
- 知识图谱（哪些掌握/哪些薄弱）
```

**5. 教师端**
```
- 批量学生分析（识别共同困惑点）
- 教学优化建议（哪些讲解需要改进）
- 自动生成针对性练习题
```

---

## 📖 总结

### 项目本质

```
Skylow不是一个"带AI的录播课"
而是一个"AI驱动的智能课堂系统"

传统录播课：
  视频 + 能问问题的AI = 高级视频播放器

Skylow：
  主动控制节奏的AI老师 + 深度学习分析 = 智能课堂

核心差异：
  "谁控制课堂节奏？"

  传统：学生控制（随时快进、跳过）
  Skylow：AI老师控制（该停就停、该讲就讲）
```

### 技术亮点

1. **主动触发机制** - 系统掌握"什么时候停"的判断权
2. **6层判断引擎** - 不直接给答案，苏格拉底式引导
3. **困惑定位系统** - 降低提问门槛，选择式交互
4. **Deep Research** - 基于全量数据的深度学习分析
5. **豆包语音集成** - 低延迟、高稳定性的实时语音交互

### 教育价值

- **从"更快给答案"到"更慢训思维"**
- **从"被动观看"到"主动互动"**
- **从"冷冰冰数字"到"温暖的老师点评"**

---

**这就是Skylow！一个真正懂教育、懂学生、懂技术的AI课堂系统。** 🎉
