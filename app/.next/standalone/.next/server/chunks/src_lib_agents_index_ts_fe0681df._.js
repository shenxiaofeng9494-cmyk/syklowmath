module.exports=[415986,229234,409509,e=>{"use strict";var n=e.i(818720);e.i(889228);var t=e.i(91601);let o=process.env.DEEPSEEK_API_KEY?new t.default({apiKey:process.env.DEEPSEEK_API_KEY,baseURL:"https://api.deepseek.com"}):null;function r(){return null!==o}async function i(e){if(!o)throw Error("DeepSeek client not available. Please set DEEPSEEK_API_KEY.");let{messages:n,temperature:t=.7,maxTokens:r=2048,jsonMode:i=!1}=e,a=await o.chat.completions.create({model:"deepseek-chat",messages:n,temperature:t,max_tokens:r,...i&&{response_format:{type:"json_object"}}});return a.choices[0]?.message?.content||""}async function a(e){let n=await i({...e,jsonMode:!0});try{return JSON.parse(n)}catch(e){throw console.error("[DeepSeek] Failed to parse JSON response:",n),Error("Failed to parse JSON response from DeepSeek")}}async function s(e,n,t=!1){let o=[];return n&&o.push({role:"system",content:n}),o.push({role:"user",content:e}),i({messages:o,jsonMode:t})}async function l(e,n){let t=[];return n&&t.push({role:"system",content:n}),t.push({role:"user",content:e}),a({messages:t})}let c={chat:i,chatJSON:a,chatStream:async function*(e){if(!o)throw Error("DeepSeek client not available. Please set DEEPSEEK_API_KEY.");let{messages:n,temperature:t=.7,maxTokens:r=2048}=e;for await(let e of(await o.chat.completions.create({model:"deepseek-chat",messages:n,temperature:t,max_tokens:r,stream:!0}))){let n=e.choices[0]?.delta?.content;n&&(yield n)}},ask:s,askJSON:l,isDeepSeekAvailable:r};e.s(["default",0,c,"isDeepSeekAvailable",()=>r],229234);let d=`# 角色
你是学习分析专家，负责分析学生的数学学习表现。

# 输入
你会收到：
1. 学生与AI老师的对话日志
2. 检查点问答记录（如果有）
3. 当前视频的知识点信息

# 分析维度

## 掌握度评估 (0-100)
根据以下因素综合判断：
- 回答正确率：答对多少问题
- 回答质量：是否能解释原因，而不只是给答案
- 回答速度：太快（<3秒）可能假懂，太慢（>30秒）可能不会
- 主动性：是否主动提问，还是只被动回答

## 各维度能力 (0-100)
- conceptUnderstanding: 概念理解能力
- procedureExecution: 计算/操作执行能力
- reasoning: 推理能力
- transfer: 迁移应用能力
- selfExplanation: 自我解释能力

## 问题标签（最多选2个）
从以下选项中选择最符合的：
- 假懂：回答快但理由错误/模糊，或者只会套公式不理解
- 条件遗漏：漏掉前提条件，忽略适用范围
- 易走神：沉默多、被动、答非所问、需要多次提醒
- 超纲倾向：问超出当前范围的问题，跳跃太大
- 计算失误：概念理解对但计算出错
- 表达困难：会做但说不清楚，语言组织能力弱

## 推荐提问风格
根据问题标签推荐最适合的提问方式：
- 假懂 → "判断+理由"（让学生解释为什么）
- 条件遗漏 → "条件核对"（确认前提）
- 易走神 → "参与感选择"（简单的A/B选择）
- 表达困难 → "一句话复述"（练习表达）
- 无明显问题 → "迁移应用"（提高挑战）
- 超纲倾向 → "条件核对"（拉回当前范围）

## 下次策略
- introQuestionCount: 开头问几题（1或2）
- midpointQuestion: 中途是否需要固定点提问
- difficulty: 推荐难度（1-10）
- focusAreas: 需要重点关注的领域

# 输出格式
必须返回以下JSON结构（不要有其他内容）：
{
  "overallLevel": 75,
  "dimensions": {
    "conceptUnderstanding": 80,
    "procedureExecution": 70,
    "reasoning": 75,
    "transfer": 60,
    "selfExplanation": 65
  },
  "problemTags": ["假懂"],
  "preferredQuestionStyle": "判断+理由",
  "nextStrategy": {
    "introQuestionCount": 2,
    "midpointQuestion": true,
    "difficulty": 6,
    "focusAreas": ["概念理解", "条件判断"]
  },
  "keyObservations": [
    "学生对公式记忆准确，但对适用条件理解不清",
    "回答速度快，但理由解释模糊"
  ],
  "shouldSaveEpisode": true,
  "episodeEvent": "学生在一次函数斜率概念上出现假懂现象"
}

# 注意事项
1. 如果对话很少，保守评估，不要过度推断
2. keyObservations 要具体，不要空泛
3. episodeEvent 只有当发生重要事件时才填写
4. 各维度分数要有区分度，不要全是50
5. problemTags 最多2个，选最明显的`,u=`# 视频信息
标题: {{videoTitle}}
知识点: {{videoNodes}}

# 对话日志
{{conversationLog}}

# 检查点回答
{{checkpointResponses}}

请分析这位学生的学习状态，返回JSON格式的分析结果。`;async function p(e){let{conversationLog:n,checkpointResponses:t=[],videoTitle:o="未知视频",videoNodes:r=[]}=e,i=(l=n)&&0!==l.length?l.map(e=>{let n="user"===e.role?"学生":"AI老师",t=e.timestamp?new Date(e.timestamp).toLocaleTimeString("zh-CN"):"";return`[${t}] ${n}: ${e.content}`}).join("\n"):"",a=(p=t)&&0!==p.length?p.map((e,n)=>{let t=void 0!==e.isCorrect?e.isCorrect?"✓正确":"✗错误":"未判断",o=e.responseTimeMs?`(${(e.responseTimeMs/1e3).toFixed(1)}秒)`:"";return`${n+1}. 问题: ${e.question}
   回答: ${e.answer} ${t} ${o}`}).join("\n\n"):"",s=u.replace("{{videoTitle}}",o).replace("{{videoNodes}}",r.join(", ")||"无").replace("{{conversationLog}}",i||"无对话记录").replace("{{checkpointResponses}}",a||"无");try{var l,p,f=await c.chatJSON({messages:[{role:"system",content:d},{role:"user",content:s}],temperature:.3,maxTokens:1500});if(f.overallLevel=Math.max(0,Math.min(100,f.overallLevel||50)),f.dimensions)for(let e of Object.keys(f.dimensions))f.dimensions[e]=Math.max(0,Math.min(100,f.dimensions[e]||50));else f.dimensions={conceptUnderstanding:50,procedureExecution:50,reasoning:50,transfer:50,selfExplanation:50};return Array.isArray(f.problemTags)||(f.problemTags=[]),f.problemTags=f.problemTags.slice(0,2),f.nextStrategy||(f.nextStrategy={introQuestionCount:1,midpointQuestion:!0,difficulty:5,focusAreas:[]}),Array.isArray(f.keyObservations)||(f.keyObservations=[]),f}catch(e){return console.error("[LearningAnalyzer] Analysis failed:",e),{overallLevel:50,dimensions:{conceptUnderstanding:50,procedureExecution:50,reasoning:50,transfer:50,selfExplanation:50},problemTags:[],preferredQuestionStyle:"参与感选择",nextStrategy:{introQuestionCount:1,midpointQuestion:!0,difficulty:5,focusAreas:[]},keyObservations:["分析数据不足，使用默认评估"],shouldSaveEpisode:!1}}}let f=`# 角色
你是数学教学问题设计专家，根据学生情况生成个性化的提问。

# 核心原则

## 1. 难度匹配
- 学生水平 > 70：问迁移应用、辨析型问题，不能问太简单的定义题
- 学生水平 40-70：混合各种类型，循序渐进
- 学生水平 < 40：问参与感选择、条件核对型，降低压力，建立信心

## 2. 风格匹配
根据学生偏好的风格设计问题：
- 条件核对："...的前提条件是什么？" / "什么情况下...才成立？"
- 判断+理由："...对不对？为什么？" / "你同意...吗？说说理由"
- 参与感选择："你觉得是A还是B？" / "选一个你更确定的"
- 一句话复述："用一句话说说..." / "用自己的话解释一下..."
- 迁移应用："如果换成...会怎样？" / "能举一个类似的例子吗？"
- 反例举证："能举一个不满足的例子吗？" / "什么情况下这个结论不成立？"

## 3. 场景适配
- intro（开头定档）：1-2个简短问题，确认前置知识，快速定档
- midpoint（中途固定点）：1个问题，检验当前理解，拉回注意力
- ending（结尾追问）：1个总结性问题，为下次铺垫

## 4. 语言要求
- 口语化，像老师在说话
- 不要过于书面化或学术化
- 问题要具体，指向明确的知识点
- 简洁，不要绕弯子

# 输出格式
必须返回以下JSON结构：
{
  "questions": [
    {
      "content": "问题内容（口语化）",
      "style": "判断+理由",
      "difficulty": 6,
      "expectedAnswerType": "yes_no" | "short_answer" | "multiple_choice" | "open_ended",
      "followUp": "如果回答错误的追问（可选）",
      "targetConcept": "针对的知识点",
      "hints": ["提示1", "提示2"]
    }
  ],
  "reasoning": "为什么这样设计问题"
}

# 示例

## 示例1：高水平学生 + 迁移应用
学生水平: 82
视频: 一次函数
风格: 迁移应用

输出:
{
  "questions": [{
    "content": "如果把 y=2x+1 的斜率变成负数，图像会怎么变？",
    "style": "迁移应用",
    "difficulty": 7,
    "expectedAnswerType": "short_answer",
    "followUp": "能画一下大概的样子吗？",
    "targetConcept": "斜率对图像的影响"
  }],
  "reasoning": "学生水平高，直接问迁移应用型问题，检验对斜率本质的理解"
}

## 示例2：中等水平 + 假懂问题
学生水平: 55
问题标签: 假懂
风格: 判断+理由

输出:
{
  "questions": [{
    "content": "y=2x+1 是一次函数，y=2x\xb2+1 也是一次函数吗？为什么？",
    "style": "判断+理由",
    "difficulty": 5,
    "expectedAnswerType": "yes_no",
    "followUp": "那一次函数的定义是什么？",
    "targetConcept": "一次函数定义"
  }],
  "reasoning": "学生有假懂倾向，用判断+理由型问题确认真实理解"
}`,y=`# 学生画像
- 整体水平: {{overallLevel}}/100
- 偏好风格: {{preferredStyle}}
- 近期趋势: {{recentTrend}}
- 问题标签: {{problemTags}}
- 薄弱点: {{knowledgeGaps}}

# 当前视频内容
- 标题: {{videoTitle}}
- 当前知识点: {{currentNodeTitle}}
- 知识点摘要: {{currentNodeSummary}}
- 关键概念: {{keyConcepts}}

# 提问场景
{{questionContext}}

# 约束条件
- 最低难度: {{minDifficulty}}
- 最高难度: {{maxDifficulty}}
- 生成问题数量: {{questionCount}}

请生成符合要求的问题，返回JSON格式。`;async function g(e){var n,t,o;let{studentProfile:r,videoTitle:i,currentNodeTitle:a,currentNodeSummary:s="",keyConcepts:l=[],questionContext:d,constraints:u={}}=e,p=r.overall_level>70?6:r.overall_level>40?4:2,g=r.overall_level>70?9:r.overall_level>40?7:5,m=u.minDifficulty??p,v=u.maxDifficulty??g,N="intro"===d?2:1,w=u.questionCount??N,h=y.replace("{{overallLevel}}",String(Math.round(r.overall_level))).replace("{{preferredStyle}}",r.preferred_style).replace("{{recentTrend}}",r.recent_trend).replace("{{problemTags}}",r.recent_problem_tags?.join(", ")||"无").replace("{{knowledgeGaps}}",r.knowledge_gaps?.join(", ")||"无明显薄弱点").replace("{{videoTitle}}",i).replace("{{currentNodeTitle}}",a).replace("{{currentNodeSummary}}",s||"无摘要").replace("{{keyConcepts}}",l.join(", ")||"无").replace("{{questionContext}}",{intro:"视频开头定档提问：确认学生对前置知识的掌握，快速定档，问题要简短",midpoint:"视频中途固定点提问：检验当前知识点的理解，拉回注意力，只问1个问题",ending:"视频结尾追问：总结性问题，为下次学习铺垫"}[d]).replace("{{minDifficulty}}",String(m)).replace("{{maxDifficulty}}",String(v)).replace("{{questionCount}}",String(w));try{return n=await c.chatJSON({messages:[{role:"system",content:f},{role:"user",content:h}],temperature:.7,maxTokens:1500}),n.questions&&Array.isArray(n.questions)||(n.questions=[]),n.questions=n.questions.map(e=>({content:e.content||"请回答这个问题",style:e.style||"参与感选择",difficulty:Math.max(1,Math.min(10,e.difficulty||5)),expectedAnswerType:e.expectedAnswerType||"short_answer",followUp:e.followUp,targetConcept:e.targetConcept,hints:e.hints||[]})),n.reasoning||(n.reasoning="根据学生画像生成"),n}catch(e){return console.error("[QuestionGenerator] Generation failed:",e),t=d,o=r.preferred_style,{questions:[{intro:{content:"在开始之前，你觉得自己对这个内容了解多少？选一个：完全不知道 / 听过但不太懂 / 比较熟悉",style:"参与感选择",difficulty:3,expectedAnswerType:"multiple_choice"},midpoint:{content:"到这里有没有什么不太明白的地方？",style:"参与感选择",difficulty:3,expectedAnswerType:"open_ended"},ending:{content:"用一句话说说，今天最重要的一个点是什么？",style:"一句话复述",difficulty:4,expectedAnswerType:"short_answer"}}[t]],reasoning:"使用默认问题（生成失败时的备选）"}}}let m=`# 任务
判断语音输入是否需要AI老师响应。你是一个过滤器，帮助判断学生是否在和系统说话。

# 输入
- asr_text: 语音识别文本
- dialog_state: 当前对话状态
  - "idle": AI没有主动提问，学生主动说话
  - "waiting_answer": AI刚问了问题，等待学生回答
  - "ai_speaking": AI正在说话
- last_ai_message: AI最近说的内容（如果有）

# 判断规则

## 应该响应 (RESPOND)
1. 明确的数学问题（包含疑问词：什么、怎么、为什么、吗、如何）
2. AI在等待回答(waiting_answer)，学生说了任何有意义的内容
3. 包含"老师"、"请问"等称呼词
4. 与当前学习内容明显相关（数学术语）
5. 明确的回答（是、对、不是、不对、A、B、C等）

## 应该忽略 (IGNORE)
1. 包含家庭成员称呼（妈妈、爸爸、姐姐、哥哥、爷爷、奶奶等）且不是在说学习内容
2. 明显是与他人对话（"你觉得呢"、"帮我看看"、"等一下"等）
3. 纯语气词（嗯、啊、哦、呃、额）且不是在回答问题
4. 与学习完全无关的内容（吃饭、睡觉、玩游戏等）
5. 太短且无明确意图（<2个字，且不是回答状态）
6. 背景电视/视频声音（通常语义不连贯或是广告语）

# 特别规则
- 当 dialog_state 是 "waiting_answer" 时，大幅降低忽略阈值
- 当 dialog_state 是 "idle" 时，需要更明确的信号才响应
- 宁可漏掉一些，也不要频繁误触发（误触发体验很差）

# 输出格式 (JSON)
{
  "action": "RESPOND" 或 "IGNORE",
  "confidence": 0.85,
  "reason": "判断理由（简短）",
  "intentType": "QUESTION" | "ANSWER" | "FEEDBACK" | "COMMAND" | "UNKNOWN"
}

# 示例

输入: "妈妈，我作业还没写完呢"
状态: idle
输出: {"action": "IGNORE", "confidence": 0.95, "reason": "与家人对话", "intentType": "UNKNOWN"}

输入: "这个公式怎么用"
状态: idle
输出: {"action": "RESPOND", "confidence": 0.9, "reason": "明确的数学问题", "intentType": "QUESTION"}

输入: "嗯"
状态: waiting_answer
输出: {"action": "RESPOND", "confidence": 0.7, "reason": "AI在等待回答，学生给出了反馈", "intentType": "FEEDBACK"}

输入: "嗯"
状态: idle
输出: {"action": "IGNORE", "confidence": 0.8, "reason": "纯语气词，无明确意图", "intentType": "UNKNOWN"}`;async function v(e){let{asrText:n,dialogState:t,lastAiMessage:o}=e,r=function(e,n){let t=e.trim();if(!t)return{action:"IGNORE",confidence:1,reason:"空文本",intentType:"UNKNOWN"};if(t.length<2&&"waiting_answer"!==n)return{action:"IGNORE",confidence:.9,reason:"文本太短",intentType:"UNKNOWN"};let o=/^(妈妈|爸爸|妈|爸|姐姐|哥哥|弟弟|妹妹|爷爷|奶奶|外公|外婆)/;return o.test(t)&&!N(t)?{action:"IGNORE",confidence:.95,reason:"与家人对话",intentType:"UNKNOWN"}:/^(老师|请问|麻烦)/.test(t)?{action:"RESPOND",confidence:.95,reason:"明确称呼老师",intentType:"QUESTION"}:"waiting_answer"===n&&t.length>=1?o.test(t)?null:{action:"RESPOND",confidence:.85,reason:"AI在等待回答",intentType:"ANSWER"}:/(什么|怎么|为什么|如何|是不是|对不对|能不能|会不会|可以吗|吗$|？$)/.test(t)&&N(t)?{action:"RESPOND",confidence:.9,reason:"数学问题",intentType:"QUESTION"}:/^(嗯|啊|哦|呃|额|好|行|OK|ok|噢)+$/i.test(t)&&"idle"===n?{action:"IGNORE",confidence:.85,reason:"纯语气词",intentType:"UNKNOWN"}:null}(n,t);if(r)return r;try{var i;let e=`输入: "${n}"
状态: ${t}
${o?`AI最近说的: "${o}"`:""}

请判断是否需要响应，返回JSON格式。`;return i=await c.chatJSON({messages:[{role:"system",content:m},{role:"user",content:e}],temperature:.1,maxTokens:200}),{action:"RESPOND"===i.action?"RESPOND":"IGNORE",confidence:Math.max(0,Math.min(1,i.confidence||.5)),reason:i.reason||"未知",intentType:i.intentType||"UNKNOWN"}}catch(e){return console.error("[IntentGateway] Classification failed:",e),{action:"waiting_answer"===t?"RESPOND":"IGNORE",confidence:.5,reason:"分类失败，使用默认规则",intentType:"UNKNOWN"}}}function N(e){return["函数","方程","公式","计算","等于","加","减","乘","除","平方","开方","根号","分数","小数","整数","负数","正数","斜率","截距","坐标","图像","直线","曲线","抛物线","一次","二次","x","y","变量","常数","系数","解","答案","结果","证明","推导","化简"].some(n=>e.includes(n))}var w=e.i(920067);async function h(e){let{intent:n,studentId:t,videoId:o,payload:r={}}=e;console.log(`[Orchestrator] Processing intent: ${n}, student: ${t}`);try{switch(n){case"enter_video":return await E(t,o,r);case"video_ended":return await O(t,o,r);case"checkpoint_reached":return await S(t,o,r);case"voice_input":return await _(t,o,r);default:return{action:"error",data:{reason:`Unknown intent: ${n}`}}}}catch(e){return console.error("[Orchestrator] Error:",e),{action:"error",data:{reason:e instanceof Error?e.message:"Unknown error"}}}}async function E(e,t,o){let r=await n.default.getOrCreateProfile(e),i=(0,w.unwrapOr)(r,k(e));r.ok||console.warn(`[Orchestrator] Profile fetch warning: ${r.error}, using fallback`),console.log(`[Orchestrator] Student profile loaded, level: ${i.overall_level}`);let a=o?.videoTitle||"数学视频",s=o?.currentNodeTitle||"知识点",l=o?.currentNodeSummary||"",c=o?.keyConcepts||[],d=await g({studentProfile:i,videoTitle:a,currentNodeTitle:s,currentNodeSummary:l,keyConcepts:c,questionContext:"intro"});return console.log(`[Orchestrator] Generated ${d.questions.length} intro questions`),{action:"ask_questions",data:{questions:d.questions},reasoning:d.reasoning}}async function O(e,t,o){let r=o?.conversationLog||[],i=o?.checkpointResponses||[];if(0===r.length&&0===i.length)return console.log("[Orchestrator] No conversation data, skipping analysis"),{action:"analysis_complete",data:{analysis:null},reasoning:"无对话数据，跳过分析"};let a=await p({conversationLog:r,checkpointResponses:i,videoTitle:o?.videoTitle,videoNodes:o?.videoNodes});console.log(`[Orchestrator] Analysis complete, level: ${a.overallLevel}`);let s=await n.default.saveSnapshot(e,t,a);s.ok||console.warn(`[Orchestrator] Snapshot save warning: ${s.error}`);let l=await n.default.updateProfile(e,a);if(l.ok||console.warn(`[Orchestrator] Profile update warning: ${l.error}`),a.shouldSaveEpisode&&a.episodeEvent){let o=await n.default.saveEpisode(e,a.episodeEvent,t);o.ok?console.log(`[Orchestrator] Saved episode: ${a.episodeEvent}`):console.warn(`[Orchestrator] Episode save warning: ${o.error}`)}if(r.length>0){let a=await n.default.saveConversationLog({studentId:e,videoId:t,sessionId:o?.sessionId||`session-${Date.now()}`,messages:r,checkpointResponses:i});a.ok||console.warn(`[Orchestrator] Conversation log save warning: ${a.error}`)}return{action:"analysis_complete",data:{analysis:a},reasoning:`分析完成，学生水平: ${a.overallLevel}，问题标签: ${a.problemTags.join(", ")||"无"}`}}async function S(e,t,o){let r=await n.default.getOrCreateProfile(e),i=(0,w.unwrapOr)(r,k(e)),a=await g({studentProfile:i,videoTitle:o?.videoTitle||"数学视频",currentNodeTitle:o?.checkpointNode?.title||"当前知识点",currentNodeSummary:o?.checkpointNode?.summary||"",keyConcepts:o?.checkpointNode?.keyConcepts||[],questionContext:"midpoint",constraints:{questionCount:1}});return{action:"ask_questions",data:{questions:a.questions},reasoning:a.reasoning}}async function _(e,n,t){let o=t?.asrText||"",r=t?.dialogState||"idle",i=t?.lastAiMessage,a=await v({asrText:o,dialogState:r,lastAiMessage:i});return(console.log(`[Orchestrator] Intent: ${a.action}, confidence: ${a.confidence}`),"IGNORE"===a.action)?{action:"ignore",data:{reason:a.reason},reasoning:`忽略原因: ${a.reason} (置信度: ${a.confidence})`}:{action:"respond",data:{intentType:a.intentType},reasoning:`需要响应: ${a.reason} (置信度: ${a.confidence})`}}async function T(e,n){let t=await v({asrText:e,dialogState:n});return{shouldRespond:"RESPOND"===t.action,reason:t.reason}}function k(e){return{student_id:e,overall_level:50,dimensions:{conceptUnderstanding:50,procedureExecution:50,reasoning:50,transfer:50,selfExplanation:50},preferred_style:"参与感选择",total_sessions:0,recent_trend:"stable",knowledge_gaps:[],recent_problem_tags:[],created_at:new Date().toISOString(),updated_at:new Date().toISOString()}}e.s(["orchestrate",()=>h,"quickIntentCheck",()=>T],409509),e.s([],415986)}];

//# sourceMappingURL=src_lib_agents_index_ts_fe0681df._.js.map