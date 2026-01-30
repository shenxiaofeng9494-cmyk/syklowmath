# 介入模式 TTS 实现说明

## ✅ 已完成的修改

### 1. 环境变量配置

**文件位置：** `app/.env.local`

**添加的配置：**
```bash
# TTS 配置（用于介入模式）✅ 已配置
DOUBAO_TTS_RESOURCE_ID=seed-tts-2.0
DOUBAO_TTS_VOICE=zh_female_vv_uranus_bigtts
```

**说明：**
- 使用你提供的 Volcengine TTS 配置
- `DOUBAO_APP_ID` 和 `DOUBAO_ACCESS_KEY` 已经存在，无需修改
- TTS API 会自动使用这些环境变量

---

### 2. VoiceInteraction 组件修改

**文件位置：** `app/src/components/voice-interaction/VoiceInteraction.tsx`

#### 2.1 添加导入
```typescript
import { useDoubaoTTS } from "@/hooks/voice/useDoubaoTTS";
import { useAudioPlayback } from "@/hooks/voice/useAudioPlayback";
```

#### 2.2 添加 TTS 和音频播放 hooks
```typescript
// TTS for intervention mode - 用于播放 AI 的介入问题
const interventionAudioPlayback = useAudioPlayback({
  onPlaybackStart: () => {
    console.log('[VoiceInteraction] TTS 开始播放介入问题');
    setStatus("speaking");
  },
  onPlaybackEnd: () => {
    console.log('[VoiceInteraction] TTS 播放完成，等待学生回答');
    setStatus("listening");
  },
});

const interventionTTS = useDoubaoTTS({
  onAudio: (audioData) => {
    interventionAudioPlayback.enqueue(audioData);
  },
  onSpeakStart: () => {
    console.log('[VoiceInteraction] TTS 开始生成语音');
  },
  onSpeakEnd: () => {
    console.log('[VoiceInteraction] TTS 生成完成');
  },
  onError: (error) => {
    console.error('[VoiceInteraction] TTS 错误:', error);
    setStatus("error");
    setConnectionError(error.message);
  },
});
```

#### 2.3 替换介入模式处理逻辑
**删除了：** 使用 `sendTextMessage` 的错误实现（学生问 AI 答）

**新增了：** 使用 TTS 播放 AI 问题的正确实现（AI 问学生答）

```typescript
useEffect(() => {
  if (interventionConfig && interventionConfig.checkpoint && isConnected) {
    console.log('[VoiceInteraction] 进入介入模式:', interventionConfig.checkpoint);

    const timer = setTimeout(async () => {
      console.log('[VoiceInteraction] 使用 TTS 播放 AI 问题');

      // 构造 AI 的问题文本
      const intro = interventionConfig.checkpoint.intervention?.intro || "";
      const question = interventionConfig.checkpoint.intervention?.question || "";
      const questionText = intro && question && intro !== question
        ? `${intro}\n\n${question}`
        : (question || intro);

      try {
        // 连接 TTS（如果还没连接）
        if (!interventionTTS.isConnected) {
          await interventionTTS.connect();
        }

        // 播放问题
        interventionTTS.speak(questionText);
      } catch (error) {
        console.error('[VoiceInteraction] TTS 播放异常:', error);
        setStatus("error");
        setConnectionError(error instanceof Error ? error.message : "TTS 播放失败");
      }
    }, 1500);

    return () => clearTimeout(timer);
  }
}, [interventionConfig, isConnected, interventionTTS]);
```

---

## 🎯 工作流程

1. **视频播放到必停点节点结束**
   - `useCheckpointIntervention` hook 检测到节点结束（最后 0.5 秒）
   - 触发 `onIntervention` 回调

2. **触发介入**
   - VideoPlayer 暂停视频
   - 调用 `handleCheckpointIntervention`
   - 自动开启对话模式
   - 自动启动麦克风（`setAutoStartMic(true)`）

3. **初始化介入会话**
   - 调用 `/api/voice/intervention` API
   - 获取介入配置并保存到 `interventionConfig`

4. **AI 使用 TTS 提问**
   - VoiceInteraction 检测到 `interventionConfig`
   - 连接 TTS 服务
   - 使用 TTS 播放 AI 的问题（intro + question）
   - 音频通过 `useAudioPlayback` 播放

5. **学生回答**
   - 麦克风已自动开启（autoStart）
   - 学生可以直接语音回答
   - 语音识别系统捕获学生回答
   - AI 判断答案并可能追问

6. **结束介入**
   - 调用 `onEndIntervention`
   - 清除介入状态
   - 恢复视频播放

---

## 📝 测试步骤

1. 启动项目：
   ```bash
   cd app
   npm run dev
   ```

2. 访问 demo 视频：http://localhost:3000/watch/demo

3. 播放视频到第一个节点结束（60秒）

4. 应该看到：
   - ✅ 视频自动暂停
   - ✅ 对话面板自动打开
   - ✅ AI 自动使用 TTS 语音提问："我停一下。你现在如果只是觉得'二次方程更厉害'，后面你会不知道它到底解决了什么问题。我只问一句：用一次方程，能不能解 x(x+3)=18？回答：能 / 不能。"
   - ✅ 麦克风自动开启，等待学生回答
   - ✅ 学生回答后，AI 判断并结束介入
   - ✅ 视频自动恢复播放

---

## 🔧 技术细节

### TTS 工作原理
1. **useDoubaoTTS** - 管理 TTS WebSocket 连接
   - 创建 TTS 会话
   - 发送文本进行语音合成
   - 接收音频数据块

2. **useAudioPlayback** - 管理音频播放队列
   - 接收 PCM 16-bit @ 24kHz 音频数据
   - 转换为 Float32 格式
   - 使用 Web Audio API 播放
   - 支持队列和中断

3. **数据流**
   ```
   interventionTTS.speak(text)
   → TTS API 生成音频
   → onAudio(audioData)
   → interventionAudioPlayback.enqueue(audioData)
   → 播放音频
   → onPlaybackEnd()
   → 状态变为 "listening"
   ```

### 与 Doubao Realtime 的区别
- **Doubao Realtime (S2S)**: 端到端语音对话，AI 是被动响应（学生说话 → AI 回答）
- **TTS 介入模式**: AI 主动提问（TTS 播放问题 → 学生回答）

---

## ⚠️ 注意事项

1. **环境变量必须正确配置**
   - `DOUBAO_APP_ID=9658677083`
   - `DOUBAO_ACCESS_KEY=F5ASL96FANDTBrOHgQLp1V04XL8KnwW6`
   - `DOUBAO_TTS_RESOURCE_ID=seed-tts-2.0`
   - `DOUBAO_TTS_VOICE=zh_female_vv_uranus_bigtts`

2. **TTS 连接需要时间**
   - 首次连接可能需要 1-2 秒
   - 已添加 1.5 秒延迟确保连接建立

3. **音频播放是异步的**
   - TTS 生成音频后立即返回
   - 音频通过队列逐块播放
   - `onPlaybackEnd` 在所有音频播放完成后触发

4. **麦克风自动开启**
   - `autoStartMic=true` 在介入触发时设置
   - 确保学生可以在 TTS 播放完成后立即回答

---

## 📂 修改的文件总结

1. **app/.env.local** - 添加 TTS 配置
2. **app/src/components/voice-interaction/VoiceInteraction.tsx** - 实现 TTS 介入模式

**新建文件：** 无

**删除代码：** 删除了使用 `sendTextMessage` 的错误实现

---

## 🎉 完成状态

✅ 环境变量配置完成
✅ TTS hooks 集成完成
✅ 介入模式实现完成
✅ 删除错误的 sendTextMessage 实现
✅ 文档编写完成

**可以开始测试了！**
