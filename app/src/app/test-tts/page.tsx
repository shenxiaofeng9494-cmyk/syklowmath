"use client";

import { useState, useRef } from "react";
import { useDoubaoTTS } from "@/hooks/voice/useDoubaoTTS";
import { useAudioPlayback } from "@/hooks/voice/useAudioPlayback";

export default function TestTTSPage() {
  const [text, setText] = useState("你好，这是一个TTS测试。");
  const [status, setStatus] = useState<string>("未连接");
  const [error, setError] = useState<string>("");
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, `[${timestamp}] ${message}`]);
  };

  // 音频播放
  const audioPlayback = useAudioPlayback({
    onPlaybackStart: () => {
      addLog("🔊 开始播放音频");
      setStatus("播放中");
    },
    onPlaybackEnd: () => {
      addLog("✅ 音频播放完成");
      setStatus("已连接");
    },
  });

  // TTS Hook
  const tts = useDoubaoTTS({
    onAudio: (audioData) => {
      addLog(`📦 收到音频数据: ${audioData.byteLength} bytes`);
      audioPlayback.enqueue(audioData);
    },
    onSpeakStart: () => {
      addLog("🎤 TTS 开始生成语音");
      setStatus("生成中");
    },
    onSpeakEnd: () => {
      addLog("✅ TTS 生成完成");
    },
    onError: (err) => {
      addLog(`❌ 错误: ${err.message}`);
      setError(err.message);
      setStatus("错误");
    },
    onConnected: () => {
      addLog("✅ TTS 连接成功");
      setStatus("已连接");
    },
    onDisconnected: () => {
      addLog("🔌 TTS 已断开");
      setStatus("未连接");
    },
  });

  const handleConnect = async () => {
    try {
      addLog("🔄 正在连接 TTS...");
      setStatus("连接中");
      setError("");
      await tts.connect();
    } catch (err) {
      const message = err instanceof Error ? err.message : "连接失败";
      addLog(`❌ 连接失败: ${message}`);
      setError(message);
      setStatus("错误");
    }
  };

  const handleDisconnect = () => {
    addLog("🔌 断开连接");
    tts.disconnect();
  };

  const handleSpeak = () => {
    if (!text.trim()) {
      setError("请输入要合成的文字");
      return;
    }
    addLog(`📝 发送文本: ${text}`);
    setError("");
    tts.speak(text);
  };

  const handleCancel = () => {
    addLog("⏹️ 取消播放");
    tts.cancel();
    audioPlayback.clear();
  };

  const clearLogs = () => {
    setLogs([]);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Doubao TTS 测试</h1>
        <p className="text-gray-400 mb-8">测试豆包文字转语音功能</p>

        {/* 状态显示 */}
        <div className="bg-gray-800 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-gray-400">状态: </span>
              <span className={`font-semibold ${
                status === "已连接" ? "text-green-400" :
                status === "错误" ? "text-red-400" :
                status === "播放中" || status === "生成中" ? "text-blue-400" :
                "text-gray-400"
              }`}>
                {status}
              </span>
            </div>
            <div className="flex gap-2">
              {!tts.isConnected ? (
                <button
                  onClick={handleConnect}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
                >
                  连接 TTS
                </button>
              ) : (
                <button
                  onClick={handleDisconnect}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
                >
                  断开连接
                </button>
              )}
            </div>
          </div>
          {error && (
            <div className="mt-3 p-3 bg-red-900/50 border border-red-500 rounded text-red-200">
              {error}
            </div>
          )}
        </div>

        {/* 配置信息 */}
        <div className="bg-gray-800 rounded-lg p-4 mb-6">
          <h2 className="text-lg font-semibold mb-3">配置信息</h2>
          <div className="space-y-2 text-sm">
            <div className="flex">
              <span className="text-gray-400 w-40">Resource ID:</span>
              <span className="text-green-400">seed-tts-2.0</span>
            </div>
            <div className="flex">
              <span className="text-gray-400 w-40">Voice:</span>
              <span className="text-green-400">zh_female_vv_uranus_bigtts</span>
            </div>
            <div className="flex">
              <span className="text-gray-400 w-40">App ID:</span>
              <span className="text-green-400">9658677083</span>
            </div>
          </div>
        </div>

        {/* 文本输入 */}
        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <label className="block text-sm font-medium mb-2">
            输入要合成的文字:
          </label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="w-full h-32 bg-gray-700 border border-gray-600 rounded-lg p-3 text-white resize-none focus:outline-none focus:border-blue-500"
            placeholder="输入要转换为语音的文字..."
          />
          <div className="flex gap-3 mt-4">
            <button
              onClick={handleSpeak}
              disabled={!tts.isConnected || tts.isSpeaking}
              className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-semibold transition-colors"
            >
              {tts.isSpeaking ? "生成中..." : "🔊 合成语音"}
            </button>
            <button
              onClick={handleCancel}
              disabled={!tts.isSpeaking}
              className="px-6 py-3 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-semibold transition-colors"
            >
              ⏹️ 取消
            </button>
          </div>
        </div>

        {/* 日志显示 */}
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">运行日志</h2>
            <button
              onClick={clearLogs}
              className="px-3 py-1 text-sm bg-gray-700 hover:bg-gray-600 rounded transition-colors"
            >
              清空日志
            </button>
          </div>
          <div className="bg-gray-900 rounded p-4 h-64 overflow-y-auto font-mono text-sm">
            {logs.length === 0 ? (
              <div className="text-gray-500 text-center py-8">暂无日志</div>
            ) : (
              logs.map((log, index) => (
                <div key={index} className="mb-1 text-gray-300">
                  {log}
                </div>
              ))
            )}
          </div>
        </div>

        {/* 使用说明 */}
        <div className="mt-6 bg-blue-900/30 border border-blue-500/50 rounded-lg p-4">
          <h3 className="font-semibold mb-2">📖 使用说明</h3>
          <ol className="text-sm text-gray-300 space-y-1 list-decimal list-inside">
            <li>点击"连接 TTS"按钮建立连接</li>
            <li>在文本框中输入要合成的文字</li>
            <li>点击"合成语音"按钮生成并播放语音</li>
            <li>查看日志了解详细的运行过程</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
