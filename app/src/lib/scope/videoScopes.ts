/**
 * Video Scopes - 视频允许范围数据
 * 硬编码的范围数据，后续可扩展为从 API 获取
 */

export interface VideoScope {
  start: number;
  end: number;
  topic: string;
}

/**
 * 获取指定视频的允许范围
 */
export function getScopeForVideo(videoId: string): VideoScope[] {
  const scopes: Record<string, VideoScope[]> = {
    // 视频 001: 一元一次方程
    '001': [
      { start: 0, end: 120, topic: '一元一次方程的定义' },
      { start: 120, end: 240, topic: '一元一次方程的解法步骤' },
      { start: 240, end: 360, topic: '移项和合并同类项' },
      { start: 360, end: 480, topic: '实际应用例题' },
      { start: 480, end: 600, topic: '练习题讲解' },
    ],

    // 视频 demo: 函数基础
    'demo': [
      { start: 0, end: 180, topic: '函数的基本概念' },
      { start: 180, end: 360, topic: '函数图像的绘制' },
      { start: 360, end: 540, topic: '函数的性质分析' },
    ],

    // 视频 video-1768911337055: 示例视频（根据实际情况调整）
    'video-1768911337055': [
      { start: 0, end: 120, topic: '课程介绍' },
      { start: 120, end: 300, topic: '核心概念讲解' },
      { start: 300, end: 480, topic: '例题演示' },
      { start: 480, end: 600, topic: '总结回顾' },
    ],
  };

  return scopes[videoId] || [];
}

/**
 * 检查视频是否有配置的范围数据
 */
export function hasVideoScope(videoId: string): boolean {
  return getScopeForVideo(videoId).length > 0;
}
