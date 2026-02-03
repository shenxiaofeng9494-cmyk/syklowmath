// ============================================================
// 意图识别网关
// 过滤背景噪声和无关对话，决定是否需要响应
// ============================================================

import deepseek from '../deepseek-client';
import type { IntentResult, DialogState } from '../types';

const INTENT_GATEWAY_SYSTEM_PROMPT = `# 任务
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
输出: {"action": "IGNORE", "confidence": 0.8, "reason": "纯语气词，无明确意图", "intentType": "UNKNOWN"}`;

export interface ClassifyParams {
  asrText: string;
  dialogState: DialogState;
  lastAiMessage?: string;
}

/**
 * 分类意图
 */
export async function classify(params: ClassifyParams): Promise<IntentResult> {
  const { asrText, dialogState, lastAiMessage } = params;

  // 快速规则判断（不调用 LLM）
  const quickResult = quickClassify(asrText, dialogState);
  if (quickResult) {
    return quickResult;
  }

  // 调用 LLM 判断
  try {
    const userPrompt = `输入: "${asrText}"
状态: ${dialogState}
${lastAiMessage ? `AI最近说的: "${lastAiMessage}"` : ''}

请判断是否需要响应，返回JSON格式。`;

    const result = await deepseek.chatJSON<IntentResult>({
      messages: [
        { role: 'system', content: INTENT_GATEWAY_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.1, // 判断任务用极低温度
      maxTokens: 200,
    });

    return validateResult(result);
  } catch (error) {
    console.error('[IntentGateway] Classification failed:', error);
    // 出错时保守处理：idle状态忽略，waiting_answer状态响应
    return {
      action: dialogState === 'waiting_answer' ? 'RESPOND' : 'IGNORE',
      confidence: 0.5,
      reason: '分类失败，使用默认规则',
      intentType: 'UNKNOWN',
    };
  }
}

/**
 * 快速规则判断（不调用 LLM，节省成本和时间）
 */
function quickClassify(text: string, state: DialogState): IntentResult | null {
  const trimmed = text.trim();

  // 空文本
  if (!trimmed) {
    return {
      action: 'IGNORE',
      confidence: 1,
      reason: '空文本',
      intentType: 'UNKNOWN',
    };
  }

  // 太短且不是回答状态
  if (trimmed.length < 2 && state !== 'waiting_answer') {
    return {
      action: 'IGNORE',
      confidence: 0.9,
      reason: '文本太短',
      intentType: 'UNKNOWN',
    };
  }

  // 明确的家庭成员称呼开头
  const familyPatterns = /^(妈妈|爸爸|妈|爸|姐姐|哥哥|弟弟|妹妹|爷爷|奶奶|外公|外婆)/;
  if (familyPatterns.test(trimmed) && !containsMathTerms(trimmed)) {
    return {
      action: 'IGNORE',
      confidence: 0.95,
      reason: '与家人对话',
      intentType: 'UNKNOWN',
    };
  }

  // 明确的老师称呼
  if (/^(老师|请问|麻烦)/.test(trimmed)) {
    return {
      action: 'RESPOND',
      confidence: 0.95,
      reason: '明确称呼老师',
      intentType: 'QUESTION',
    };
  }

  // AI在等待回答时，几乎任何回复都响应
  if (state === 'waiting_answer' && trimmed.length >= 1) {
    // 排除一些明显无关的
    if (familyPatterns.test(trimmed)) {
      return null; // 让 LLM 判断
    }
    return {
      action: 'RESPOND',
      confidence: 0.85,
      reason: 'AI在等待回答',
      intentType: 'ANSWER',
    };
  }

  // 明确的数学问题词
  const questionPatterns = /(什么|怎么|为什么|如何|是不是|对不对|能不能|会不会|可以吗|吗$|？$)/;
  if (questionPatterns.test(trimmed) && containsMathTerms(trimmed)) {
    return {
      action: 'RESPOND',
      confidence: 0.9,
      reason: '数学问题',
      intentType: 'QUESTION',
    };
  }

  // 纯语气词
  const pureInterjections = /^(嗯|啊|哦|呃|额|好|行|OK|ok|噢)+$/i;
  if (pureInterjections.test(trimmed) && state === 'idle') {
    return {
      action: 'IGNORE',
      confidence: 0.85,
      reason: '纯语气词',
      intentType: 'UNKNOWN',
    };
  }

  // 无法快速判断，交给 LLM
  return null;
}

/**
 * 检查是否包含数学术语
 */
function containsMathTerms(text: string): boolean {
  const mathTerms = [
    '函数', '方程', '公式', '计算', '等于', '加', '减', '乘', '除',
    '平方', '开方', '根号', '分数', '小数', '整数', '负数', '正数',
    '斜率', '截距', '坐标', '图像', '直线', '曲线', '抛物线',
    '一次', '二次', 'x', 'y', '变量', '常数', '系数',
    '解', '答案', '结果', '证明', '推导', '化简',
  ];
  return mathTerms.some(term => text.includes(term));
}

/**
 * 验证结果
 */
function validateResult(result: IntentResult): IntentResult {
  return {
    action: result.action === 'RESPOND' ? 'RESPOND' : 'IGNORE',
    confidence: Math.max(0, Math.min(1, result.confidence || 0.5)),
    reason: result.reason || '未知',
    intentType: result.intentType || 'UNKNOWN',
  };
}

export default { classify };
