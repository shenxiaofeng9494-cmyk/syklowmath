"use client";

/**
 * Voice Test Page
 *
 * A simple interface to test ASR (speech recognition) and TTS (text-to-speech)
 * functionality independently.
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { useDoubaoASR } from "@/hooks/voice/useDoubaoASR";
import { useDoubaoTTS } from "@/hooks/voice/useDoubaoTTS";
import { useAudioPlayback } from "@/hooks/voice/useAudioPlayback";
import { useAudioCapture } from "@/hooks/voice/useAudioCapture";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Volume2, VolumeX, Loader2, RefreshCw } from "lucide-react";

interface TTSConfig {
  appId: string;
  accessKey: string;
  resourceId: string;
  voice?: string;
}

export default function TestVoicePage() {
  // ASR State
  const [asrStatus, setAsrStatus] = useState<"idle" | "connecting" | "connected" | "recording" | "error">("idle");
  const [asrResults, setAsrResults] = useState<Array<{ text: string; isFinal: boolean; timestamp: Date }>>([]);
  const [asrError, setAsrError] = useState<string | null>(null);

  // TTS State
  const [ttsStatus, setTtsStatus] = useState<"idle" | "connecting" | "connected" | "speaking" | "error">("idle");
  const [ttsText, setTtsText] = useState("你好，我是数学老师，有什么问题可以问我。");
  const [ttsError, setTtsError] = useState<string | null>(null);
  const [ttsConfig, setTtsConfig] = useState<TTSConfig | null>(null);

  // Audio Playback
  const playback = useAudioPlayback({
    onPlaybackStart: () => {
      console.log("Playback started");
    },
    onPlaybackEnd: () => {
      console.log("Playback ended");
      setTtsStatus("connected");
    },
    onError: (error) => {
      console.error("Playback error:", error);
    },
  });

  // ASR Hook
  const asr = useDoubaoASR({
    onResult: (text, isFinal) => {
      console.log("ASR Result:", { text, isFinal });
      setAsrResults((prev) => [
        ...prev,
        { text, isFinal, timestamp: new Date() },
      ]);
    },
    onConnected: () => {
      console.log("ASR Connected");
      setAsrStatus("connected");
      setAsrError(null);
    },
    onDisconnected: () => {
      console.log("ASR Disconnected");
      setAsrStatus("idle");
    },
    onError: (error) => {
      console.error("ASR Error:", error);
      setAsrError(error.message);
      setAsrStatus("error");
    },
  });

  // TTS Hook
  const tts = useDoubaoTTS({
    config: ttsConfig || { appId: "", accessKey: "", resourceId: "" },
    onAudio: (audioData) => {
      console.log("TTS Audio received:", audioData.byteLength, "bytes");
      playback.enqueue(audioData);
    },
    onSpeakStart: () => {
      console.log("TTS Speaking started");
      setTtsStatus("speaking");
    },
    onSpeakEnd: () => {
      console.log("TTS Speaking ended");
      // Status will be set to "connected" when playback ends
    },
    onConnected: () => {
      console.log("TTS Connected");
      setTtsStatus("connected");
      setTtsError(null);
    },
    onDisconnected: () => {
      console.log("TTS Disconnected");
      setTtsStatus("idle");
    },
    onError: (error) => {
      console.error("TTS Error:", error);
      setTtsError(error.message);
      setTtsStatus("error");
    },
  });

  // Audio Capture
  const capture = useAudioCapture({
    onAudioChunk: (chunk) => {
      if (asrStatus === "recording" && asr.isConnected) {
        asr.sendAudio(chunk);
      }
    },
    onError: (error) => {
      console.error("Capture error:", error);
      setAsrError(error.message);
    },
  });

  // Fetch TTS config on mount
  useEffect(() => {
    async function fetchConfig() {
      try {
        const response = await fetch("/api/voice/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ videoContext: "" }),
        });

        if (response.ok) {
          const data = await response.json();
          setTtsConfig({
            appId: data.doubaoAppId,
            accessKey: data.doubaoAccessKey,
            resourceId: data.ttsResourceId,
            voice: data.ttsVoice,
          });
        }
      } catch (error) {
        console.error("Failed to fetch config:", error);
      }
    }

    fetchConfig();
  }, []);

  // ASR Actions
  const handleConnectASR = useCallback(async () => {
    setAsrStatus("connecting");
    setAsrError(null);
    try {
      await asr.connect();
    } catch (error) {
      console.error("Failed to connect ASR:", error);
    }
  }, [asr]);

  const handleDisconnectASR = useCallback(() => {
    capture.stop();
    asr.disconnect();
    setAsrStatus("idle");
  }, [asr, capture]);

  const handleStartRecording = useCallback(async () => {
    try {
      await capture.start();
      setAsrStatus("recording");
    } catch (error) {
      console.error("Failed to start recording:", error);
      setAsrError(error instanceof Error ? error.message : "Failed to start recording");
    }
  }, [capture]);

  const handleStopRecording = useCallback(() => {
    capture.stop();
    asr.endAudio();
    setAsrStatus("connected");
  }, [capture, asr]);

  const handleClearASRResults = useCallback(() => {
    setAsrResults([]);
  }, []);

  // TTS Actions
  const handleConnectTTS = useCallback(async () => {
    if (!ttsConfig) {
      setTtsError("TTS config not loaded");
      return;
    }

    setTtsStatus("connecting");
    setTtsError(null);
    try {
      await tts.connect(ttsConfig);
    } catch (error) {
      console.error("Failed to connect TTS:", error);
    }
  }, [tts, ttsConfig]);

  const handleDisconnectTTS = useCallback(() => {
    tts.disconnect();
    playback.clear();
    setTtsStatus("idle");
  }, [tts, playback]);

  const handleSpeak = useCallback(() => {
    if (!ttsText.trim()) return;
    tts.speak(ttsText);
  }, [tts, ttsText]);

  const handleStopSpeaking = useCallback(() => {
    tts.cancel();
    playback.clear();
    setTtsStatus("connected");
  }, [tts, playback]);

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">语音功能测试</h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* ASR Test Panel */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Mic className="w-5 h-5" />
              语音识别 (ASR)
            </h2>

            {/* Status */}
            <div className="mb-4">
              <span className="text-sm text-gray-500">状态：</span>
              <span
                className={`ml-2 px-2 py-1 rounded text-sm font-medium ${
                  asrStatus === "idle"
                    ? "bg-gray-100 text-gray-600"
                    : asrStatus === "connecting"
                    ? "bg-yellow-100 text-yellow-700"
                    : asrStatus === "connected"
                    ? "bg-green-100 text-green-700"
                    : asrStatus === "recording"
                    ? "bg-red-100 text-red-700"
                    : "bg-red-100 text-red-700"
                }`}
              >
                {asrStatus === "idle" && "未连接"}
                {asrStatus === "connecting" && "连接中..."}
                {asrStatus === "connected" && "已连接"}
                {asrStatus === "recording" && "录音中..."}
                {asrStatus === "error" && "错误"}
              </span>
            </div>

            {/* Error */}
            {asrError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {asrError}
              </div>
            )}

            {/* Controls */}
            <div className="flex flex-wrap gap-2 mb-4">
              {asrStatus === "idle" || asrStatus === "error" ? (
                <Button onClick={handleConnectASR} disabled={asrStatus === "connecting"}>
                  {asrStatus === "connecting" ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : null}
                  连接
                </Button>
              ) : (
                <Button variant="outline" onClick={handleDisconnectASR}>
                  断开
                </Button>
              )}

              {asrStatus === "connected" && (
                <Button onClick={handleStartRecording} variant="default">
                  <Mic className="w-4 h-4 mr-2" />
                  开始录音
                </Button>
              )}

              {asrStatus === "recording" && (
                <Button onClick={handleStopRecording} variant="destructive">
                  <MicOff className="w-4 h-4 mr-2" />
                  停止录音
                </Button>
              )}

              {asrResults.length > 0 && (
                <Button variant="ghost" size="sm" onClick={handleClearASRResults}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  清空
                </Button>
              )}
            </div>

            {/* Results */}
            <div className="border rounded-lg p-4 min-h-[200px] max-h-[400px] overflow-y-auto bg-gray-50">
              {asrResults.length === 0 ? (
                <p className="text-gray-400 text-sm">识别结果将显示在这里...</p>
              ) : (
                <div className="space-y-2">
                  {asrResults.map((result, index) => (
                    <div
                      key={index}
                      className={`p-2 rounded ${
                        result.isFinal
                          ? "bg-green-50 border border-green-200"
                          : "bg-yellow-50 border border-yellow-200"
                      }`}
                    >
                      <p className="text-gray-800">{result.text}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        {result.isFinal ? "最终结果" : "临时结果"} ·{" "}
                        {result.timestamp.toLocaleTimeString()}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* TTS Test Panel */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Volume2 className="w-5 h-5" />
              语音合成 (TTS)
            </h2>

            {/* Status */}
            <div className="mb-4">
              <span className="text-sm text-gray-500">状态：</span>
              <span
                className={`ml-2 px-2 py-1 rounded text-sm font-medium ${
                  ttsStatus === "idle"
                    ? "bg-gray-100 text-gray-600"
                    : ttsStatus === "connecting"
                    ? "bg-yellow-100 text-yellow-700"
                    : ttsStatus === "connected"
                    ? "bg-green-100 text-green-700"
                    : ttsStatus === "speaking"
                    ? "bg-blue-100 text-blue-700"
                    : "bg-red-100 text-red-700"
                }`}
              >
                {ttsStatus === "idle" && "未连接"}
                {ttsStatus === "connecting" && "连接中..."}
                {ttsStatus === "connected" && "已连接"}
                {ttsStatus === "speaking" && "播放中..."}
                {ttsStatus === "error" && "错误"}
              </span>
              {playback.queueLength > 0 && (
                <span className="ml-2 text-xs text-gray-400">
                  队列: {playback.queueLength}
                </span>
              )}
            </div>

            {/* Config Status */}
            {!ttsConfig && (
              <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-700 text-sm">
                正在加载 TTS 配置...
              </div>
            )}

            {/* Error */}
            {ttsError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {ttsError}
              </div>
            )}

            {/* Controls */}
            <div className="flex flex-wrap gap-2 mb-4">
              {ttsStatus === "idle" || ttsStatus === "error" ? (
                <Button
                  onClick={handleConnectTTS}
                  disabled={ttsStatus === "connecting" || !ttsConfig}
                >
                  {ttsStatus === "connecting" ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : null}
                  连接
                </Button>
              ) : (
                <Button variant="outline" onClick={handleDisconnectTTS}>
                  断开
                </Button>
              )}

              {(ttsStatus === "connected" || ttsStatus === "speaking") && (
                <>
                  <Button
                    onClick={handleSpeak}
                    disabled={!ttsText.trim() || ttsStatus === "speaking"}
                  >
                    <Volume2 className="w-4 h-4 mr-2" />
                    播放
                  </Button>

                  {ttsStatus === "speaking" && (
                    <Button onClick={handleStopSpeaking} variant="destructive">
                      <VolumeX className="w-4 h-4 mr-2" />
                      停止
                    </Button>
                  )}
                </>
              )}
            </div>

            {/* Text Input */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                输入要合成的文本：
              </label>
              <textarea
                value={ttsText}
                onChange={(e) => setTtsText(e.target.value)}
                className="w-full p-3 border rounded-lg min-h-[150px] resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="输入要转换为语音的文字..."
                disabled={ttsStatus === "speaking"}
              />
            </div>

            {/* Preset Texts */}
            <div className="mt-4">
              <p className="text-sm text-gray-500 mb-2">快速测试：</p>
              <div className="flex flex-wrap gap-2">
                {[
                  "你好，我是数学老师。",
                  "一元二次方程的求根公式是 x 等于负 b 加减根号下 b 的平方减 4ac，再除以 2a。",
                  "让我们来看一个例子。",
                  "懂了吗？有什么问题可以问我。",
                ].map((text, index) => (
                  <button
                    key={index}
                    onClick={() => setTtsText(text)}
                    className="px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded-full text-gray-600 transition-colors"
                  >
                    {text.length > 15 ? text.substring(0, 15) + "..." : text}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="mt-8 bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">使用说明</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm text-gray-600">
            <div>
              <h3 className="font-medium text-gray-800 mb-2">ASR 测试步骤：</h3>
              <ol className="list-decimal list-inside space-y-1">
                <li>点击「连接」按钮建立 ASR 连接</li>
                <li>连接成功后，点击「开始录音」</li>
                <li>对着麦克风说话</li>
                <li>识别结果会实时显示</li>
                <li>点击「停止录音」结束</li>
              </ol>
            </div>
            <div>
              <h3 className="font-medium text-gray-800 mb-2">TTS 测试步骤：</h3>
              <ol className="list-decimal list-inside space-y-1">
                <li>点击「连接」按钮建立 TTS 连接</li>
                <li>在文本框中输入要合成的文字</li>
                <li>点击「播放」按钮</li>
                <li>等待语音合成并播放</li>
                <li>可随时点击「停止」中断播放</li>
              </ol>
            </div>
          </div>
        </div>

        {/* Environment Check */}
        <div className="mt-4 text-center text-sm text-gray-400">
          <p>
            ASR 后端代理：<code className="bg-gray-100 px-1 rounded">/api/voice/asr</code>
          </p>
          <p>
            TTS 直连：<code className="bg-gray-100 px-1 rounded">wss://sami.bytedance.com</code>
          </p>
        </div>
      </div>
    </div>
  );
}
