# VoiceInteraction 介入模式实现说明

## 需要实现的功能

当 `interventionConfig` prop 存在时，VoiceInteraction 应该进入"介入模式"：

1. 使用介入模式的 system prompt（从 `interventionConfig.systemPrompt`）
2. 连接成功后，立即发送一个消息让 AI 开始说话
3. AI 说完后，等待学生回答
4. 对话结束后调用 `onEndIntervention()`

## 实现方案（简化版）

由于 VoiceInteraction 组件使用了多个语音后端（OpenAI Realtime, Doubao Realtime, Doubao ASR+LLM+TTS），完整实现比较复杂。

**简化方案：**
在介入模式下，自动在消息列表中添加一条 AI 消息，显示介入问题，然后让学生通过语音回答。

## 具体步骤

1. 检测 `interventionConfig` 存在
2. 在组件加载时，自动添加一条 assistant 消息显示问题
3. 使用 TTS 播放问题（如果可用）
4. 等待学生语音回答
5. 学生回答后，判断答案并可能追问
6. 完成后调用 `onEndIntervention()`

## 代码位置

- 在 `useEffect` 中检测 `interventionConfig` 变化
- 添加消息到 `messages` 状态
- 调用 TTS 播放问题
- 监听学生回答
- 完成后调用回调

## 注意事项

- 介入模式应该优先级最高
- 不要与正常对话模式冲突
- 确保 TTS 正常工作
- 学生回答后要有反馈
