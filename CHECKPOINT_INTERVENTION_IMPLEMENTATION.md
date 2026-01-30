# 必停点介入功能实现说明

## 📋 实现概述

实现了 **AI 主动提问 → 学生回答** 的必停点介入模式。

## 🔧 修改的文件

### 1. `useCheckpointIntervention.ts`
**修改内容：**
- 移除了沉默计时器逻辑
- 改为节点结束时立即触发介入（最后 0.5 秒）
- 不再等待学生沉默，直接暂停视频并触发 AI 提问

**关键代码：**
```typescript
// 检查是否接近节点结束（最后0.5秒）
const timeUntilEnd = currentNode.end_time - currentTime
if (timeUntilEnd > 0.5) {
  return
}

// 立即触发介入（不等待沉默）
setState({
  isIntervening: true,
  currentCheckpoint: currentNode,
  silenceTimer: null
})

onIntervention(currentNode)
```

### 2. `watch/[id]/page.tsx`
**修改内容：**
- 添加 `interventionConfig` 状态存储介入会话配置
- 修改 `handleCheckpointIntervention` 自动开启对话模式
- 修改 `initInterventionSession` 保存介入配置并传递给语音组件
- 将 `interventionConfig` 和 `onEndIntervention` 传递给 ChatPanel

**关键代码：**
```typescript
// 处理必停点介入
const handleCheckpointIntervention = useCallback((checkpoint: any) => {
  console.log('[WatchPage] 必停点介入:', checkpoint.title);
  setIsCheckpointIntervening(true);
  setCurrentCheckpoint(checkpoint);

  // 自动开启对话模式
  setIsInConversation(true);

  // 设置自动启动麦克风（让学生可以回答）
  setAutoStartMic(true);

  // 初始化介入会话
  initInterventionSession(checkpoint);
}, []);

// 初始化介入会话
const initInterventionSession = async (checkpoint: any) => {
  // ... 调用 API ...

  // 保存介入配置，传递给 VoiceInteraction
  setInterventionConfig({
    sessionId: data.sessionId,
    systemPrompt: data.systemPrompt,
    checkpoint: data.checkpoint,
    // AI 首轮消息：让 AI 立即开始提问
    initialMessage: `请开始提问`
  });
};
```

### 3. `ChatPanel.tsx`
**修改内容：**
- 添加 `interventionConfig` 和 `onEndIntervention` props
- 将这些 props 传递给 VoiceInteraction 组件

## 🎯 工作流程

1. **视频播放到必停点节点结束**
   - `useCheckpointIntervention` hook 检测到节点结束（最后 0.5 秒）
   - 立即触发 `onIntervention` 回调

2. **触发介入**
   - VideoPlayer 暂停视频
   - 调用 `handleCheckpointIntervention`
   - 自动开启对话模式 (`setIsInConversation(true)`)
   - 自动启动麦克风 (`setAutoStartMic(true)`)

3. **初始化介入会话**
   - 调用 `/api/voice/intervention` API
   - 获取介入模式的 system prompt
   - 保存介入配置到 `interventionConfig` 状态

4. **传递配置到语音组件**
   - `interventionConfig` 通过 ChatPanel 传递给 VoiceInteraction
   - VoiceInteraction 需要使用这个配置来：
     - 使用介入模式的 system prompt
     - 发送 `initialMessage` 让 AI 立即开始提问

5. **AI 开始提问**
   - VoiceInteraction 连接语音系统
   - 发送 `initialMessage` 触发 AI 回复
   - AI 根据 system prompt 中的指令开始提问

6. **学生回答**
   - 麦克风已自动开启
   - 学生可以直接回答
   - AI 判断答案并可能追问

7. **结束介入**
   - 调用 `onEndIntervention`
   - 清除介入状态
   - 恢复视频播放

## ⚠️ 待完成

**VoiceInteraction 组件需要支持介入模式：**

1. 接收 `interventionConfig` prop
2. 检测到介入模式时：
   - 使用 `interventionConfig.systemPrompt` 而不是默认 prompt
   - 连接后立即发送 `interventionConfig.initialMessage`
   - 让 AI 先说话

3. 对话结束后调用 `onEndIntervention`

## 📝 测试步骤

1. 启动项目：`npm run dev`
2. 访问 demo 视频：http://localhost:3000/watch/demo
3. 播放视频到第一个节点结束（60秒）
4. 应该看到：
   - 视频自动暂停
   - 对话面板自动打开
   - AI 自动开始语音提问："我只问一句：用一次方程，能不能解 x(x+3)=18？回答：能 / 不能。"
5. 学生回答后，AI 判断并结束介入
6. 视频自动恢复播放

## 🎨 视频节点配置

在 `video-nodes.ts` 中已配置 4 个必停点：

- **demo-node-0** (0-60s): 动机段 - "为什么要学一元二次方程"
- **demo-node-2** (120-210s): 定义段 - "最高次数陷阱"
- **demo-node-3** (210-300s): 例题段 - "化简后再判断"
- **demo-node-4** (300-367s): 总结段 - "收尾终检"
