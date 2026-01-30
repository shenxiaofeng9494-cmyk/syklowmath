/**
 * Scope Guard - 超纲提问检测模块
 * 纯函数模块，不依赖 React / 语音 SDK
 */

export type ScopeContext = {
  videoId: string;
  currentTimeSec: number;
  allowed: Array<{
    start: number;
    end: number;
    topic: string;
  }>;
};

export type ScopeCheckResult = {
  inScope: boolean;
  reason: string;
  hint: string;
  currentTopic?: string;
  currentSegment?: {
    start: number;
    end: number;
    topic: string;
  };
};

/**
 * 超前关键词列表（表示学生想问后面的内容）
 */
const FORWARD_KEYWORDS = [
  '后面', '下一个', '接下来', '之后', '第二个', '第三个', '第四个', '第五个',
  '下节', '下一节', '后续', '以后', '将来', '未来',
];

/**
 * 超后关键词列表（表示学生想问前面的内容）
 */
const BACKWARD_KEYWORDS = [
  '前面', '上一个', '之前', '刚才', '刚刚', '上节', '上一节',
];

/**
 * 找到当前时间所在的允许段
 */
function findCurrentSegment(ctx: ScopeContext) {
  return ctx.allowed.find(
    (seg) => ctx.currentTimeSec >= seg.start && ctx.currentTimeSec < seg.end
  );
}

/**
 * 检查问题是否包含超前/超后关键词
 */
function hasForwardKeywords(text: string): boolean {
  return FORWARD_KEYWORDS.some((kw) => text.includes(kw));
}

function hasBackwardKeywords(text: string): boolean {
  return BACKWARD_KEYWORDS.some((kw) => text.includes(kw));
}

/**
 * 检查问题是否与当前段的主题相关
 * 简化版：只检查主题关键词是否出现在问题中
 */
function isRelatedToCurrentTopic(text: string, topic: string): boolean {
  // 提取主题中的关键词（去掉"的"、"和"等连接词）
  const topicKeywords = topic
    .replace(/的|和|与|或|及/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1);

  // 检查是否有关键词匹配
  return topicKeywords.some((kw) => text.includes(kw));
}

/**
 * 核心判断函数：检查问题是否在允许范围内
 */
export function classifyQuestionScope(
  questionText: string,
  ctx: ScopeContext
): ScopeCheckResult {
  // 1. 找到当前时间所在的段
  const currentSegment = findCurrentSegment(ctx);

  if (!currentSegment) {
    // 当前时间不在任何允许段内（可能在视频开头或结尾）
    return {
      inScope: false,
      reason: '当前时间不在任何知识点段内',
      hint: '请先播放到具体的知识点段落',
    };
  }

  // 2. 检查是否包含超前关键词
  if (hasForwardKeywords(questionText)) {
    return {
      inScope: false,
      reason: '问题涉及后续内容',
      hint: `我们现在在讲【${currentSegment.topic}】，先把这部分理解透彻吧`,
      currentTopic: currentSegment.topic,
      currentSegment,
    };
  }

  // 3. 检查是否包含超后关键词
  if (hasBackwardKeywords(questionText)) {
    return {
      inScope: false,
      reason: '问题涉及之前的内容',
      hint: `我们现在在讲【${currentSegment.topic}】，如果想复习前面的内容，可以拖动进度条回到那个位置`,
      currentTopic: currentSegment.topic,
      currentSegment,
    };
  }

  // 4. 检查问题是否与当前主题相关
  const isRelated = isRelatedToCurrentTopic(questionText, currentSegment.topic);

  if (!isRelated) {
    // 问题可能超出当前段的范围
    return {
      inScope: false,
      reason: '问题与当前主题不太相关',
      hint: `我们现在在讲【${currentSegment.topic}】，你的问题可能不在这个范围内`,
      currentTopic: currentSegment.topic,
      currentSegment,
    };
  }

  // 5. 问题在范围内
  return {
    inScope: true,
    reason: '问题在当前范围内',
    hint: '',
    currentTopic: currentSegment.topic,
    currentSegment,
  };
}

/**
 * 生成拒答话术
 */
export function generateGuardrailResponse(
  result: ScopeCheckResult,
  ctx: ScopeContext
): string {
  if (result.inScope) {
    return ''; // 不需要拒答话术
  }

  const segment = result.currentSegment;
  if (!segment) {
    return '我们先从视频的具体内容开始吧。请播放到某个知识点段落，然后再提问。';
  }

  const startMin = Math.floor(segment.start / 60);
  const startSec = segment.start % 60;
  const endMin = Math.floor(segment.end / 60);
  const endSec = segment.end % 60;

  const timeRange = `${startMin}:${startSec.toString().padStart(2, '0')} - ${endMin}:${endSec.toString().padStart(2, '0')}`;

  // 根据不同的原因生成不同的话术
  if (result.reason === '问题涉及后续内容') {
    return `这个问题问得很好！不过我们现在先聚焦在【${segment.topic}】这一段（约在 ${timeRange}）。你可以先想想：这部分内容你理解了吗？有什么不清楚的地方吗？如果你想继续往下看，就说"继续"。`;
  }

  if (result.reason === '问题涉及之前的内容') {
    return `你提到的是前面的内容。我们现在在讲【${segment.topic}】（约在 ${timeRange}）。如果你想复习前面的内容，可以拖动进度条回到那个位置。现在我们先把当前这部分搞清楚，好吗？`;
  }

  // 默认话术（问题与当前主题不太相关）
  return `这个问题很有意思，但我们现在先聚焦在【${segment.topic}】这一段（约在 ${timeRange}）。关于这部分内容，你有什么疑问吗？比如：这个概念你理解了吗？需要我举个例子吗？如果你想继续看下去，就说"继续"。`;
}
