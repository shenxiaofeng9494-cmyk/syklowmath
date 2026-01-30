/**
 * 方案1 Demo：介入点播放按钮自动切换模式
 *
 * 这个demo展示了如何在用户按播放按钮时，
 * 自动从精准模式切换回实时模式
 */

import { useCallback } from 'react';

// ============================================
// 1. VideoPlayer 组件的修改（核心逻辑）
// ============================================

interface VideoPlayerProps {
  // ... 其他现有的props
  interventionConfig?: any;  // 新增：介入配置
  onExitIntervention?: () => void;  // 新增：退出介入回调
}

function VideoPlayerDemo({
  interventionConfig,
  onExitIntervention
}: VideoPlayerProps) {

  // 原有的 togglePlay 函数
  const togglePlay = useCallback(() => {
    const videoRef = { current: { play: () => {}, pause: () => {} } }; // 模拟
    const isPlaying = false; // 模拟

    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        // ✨ 核心修改：播放前检查是否在介入模式
        if (interventionConfig && onExitIntervention) {
          console.log('[VideoPlayer] 检测到介入模式，先退出介入再播放');
          onExitIntervention();
        }
        videoRef.current.play();
      }
    }
  }, [interventionConfig, onExitIntervention]);

  return null; // demo不需要实际渲染
}

// ============================================
// 2. Page 组件的修改（父组件逻辑）
// ============================================

function WatchPageDemo() {
  // 模拟状态
  const interventionConfig = { checkpoint: { title: '二次函数定义' } };

  // ✨ 新增：处理用户手动播放时退出介入
  const handleExitInterventionAndPlay = useCallback(() => {
    console.log('[WatchPage] 用户手动播放，退出介入模式');

    // 1. 清除介入状态
    // setIsCheckpointIntervening(false);
    // setCurrentCheckpoint(null);
    // setInterventionConfig(null);

    // 2. 切换回实时模式
    // setVoiceBackend("doubao_realtime");

    console.log('[WatchPage] ✅ 已切换回实时模式');
  }, []);

  // 使用示例
  return (
    <VideoPlayerDemo
      interventionConfig={interventionConfig}
      onExitIntervention={handleExitInterventionAndPlay}
    />
  );
}

// ============================================
// 3. 完整流程演示
// ============================================

console.log('\n=== 方案1实现流程演示 ===\n');

// 场景1：正常播放（无介入）
console.log('场景1：正常播放');
console.log('- interventionConfig: null');
console.log('- 用户点击播放按钮');
console.log('- 结果：直接播放视频');
console.log('');

// 场景2：介入模式下播放（核心场景）
console.log('场景2：介入模式下播放 ⭐');
console.log('- interventionConfig: { checkpoint: {...} }');
console.log('- 用户点击播放按钮');
console.log('- 检测到介入模式');
console.log('- 调用 onExitIntervention()');
console.log('  └─ 清除介入状态');
console.log('  └─ 切换到实时模式 (doubao_realtime)');
console.log('- 播放视频');
console.log('- 结果：✅ 成功切换并播放');
console.log('');

// ============================================
// 4. 代码改动统计
// ============================================

console.log('=== 代码改动统计 ===\n');
console.log('VideoPlayer.tsx:');
console.log('  - 添加 2 个 props (interventionConfig, onExitIntervention)');
console.log('  - 修改 togglePlay 函数 (添加 4 行代码)');
console.log('');
console.log('page.tsx:');
console.log('  - 添加 handleExitInterventionAndPlay 函数 (8 行代码)');
console.log('  - 传递 2 个 props 给 VideoPlayer (2 处，各 2 行)');
console.log('');
console.log('总计：约 20 行代码');
console.log('难度：⭐⭐ (简单)');
console.log('');

// ============================================
// 5. 优缺点分析
// ============================================

console.log('=== 优缺点分析 ===\n');
console.log('✅ 优点:');
console.log('  1. 代码改动少，逻辑清晰');
console.log('  2. 不影响现有的 AI 问答流程');
console.log('  3. 职责分离明确（VideoPlayer 负责检测，Page 负责处理）');
console.log('  4. 易于测试和维护');
console.log('');
console.log('⚠️  注意事项:');
console.log('  1. 状态更新是异步的，但影响很小');
console.log('  2. 需要在两处传递 props（全屏和非全屏模式）');
console.log('');

// ============================================
// 6. 与现有流程的对比
// ============================================

console.log('=== 与现有流程的对比 ===\n');
console.log('现有流程（AI 调用 resume_video）:');
console.log('  AI 工具调用 → handleResumeVideo → 检查介入状态 → 切换模式 → 播放');
console.log('');
console.log('新增流程（用户手动播放）:');
console.log('  用户点击播放 → togglePlay → 检查介入状态 → onExitIntervention → 播放');
console.log('');
console.log('✅ 两个流程完全独立，互不影响');
console.log('');

export { VideoPlayerDemo, WatchPageDemo };
