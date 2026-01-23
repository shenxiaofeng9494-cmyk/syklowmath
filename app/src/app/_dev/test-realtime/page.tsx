"use client";

/**
 * Doubao Realtime Voice Test Page
 */

import { useState, useCallback } from "react";
import { useDoubaoRealtimeVoice } from "@/hooks/voice/useDoubaoRealtimeVoice";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Phone, PhoneOff, Send } from "lucide-react";

export default function TestRealtimePage() {
  const [status, setStatus] = useState<string>("disconnected");
  const [transcript, setTranscript] = useState<string>("");
  const [answer, setAnswer] = useState<string>("");
  const [messages, setMessages] = useState<Array<{ role: string; text: string }>>([]);
  const [textInput, setTextInput] = useState("");
  const [toolCalls, setToolCalls] = useState<Array<{ name: string; args: string }>>([]);

  const voice = useDoubaoRealtimeVoice({
    videoContext: "这是一个测试页面，用于测试豆包实时语音功能。",
    onSpeechStart: () => {
      console.log("Speech started");
      setStatus("user_speaking");
      setTranscript("");
    },
    onSpeechEnd: () => {
      console.log("Speech ended");
      setStatus("thinking");
    },
    onTranscript: (text, isFinal) => {
      console.log("Transcript:", text, "isFinal:", isFinal);
      setTranscript(text);
      if (isFinal && text) {
        setMessages(prev => [...prev, { role: "user", text }]);
        setTranscript("");
      }
    },
    onAnswer: (text) => {
      console.log("Answer chunk:", text);
      setAnswer(prev => prev + text);
      setStatus("speaking");
    },
    onAnswerComplete: (text) => {
      console.log("Answer complete:", text);
      if (text) {
        setMessages(prev => [...prev, { role: "assistant", text }]);
      }
      setAnswer("");
    },
    onToolCall: (name, args) => {
      console.log("Tool call:", name, args);
      setToolCalls(prev => [...prev, { name, args: JSON.stringify(args) }]);
    },
    onComplete: () => {
      console.log("Complete");
      setStatus("listening");
      setAnswer("");
    },
    onResumeVideo: () => {
      console.log("Resume video requested");
    },
    onJumpToTime: (time) => {
      console.log("Jump to time:", time);
    },
  });

  const handleConnect = useCallback(async () => {
    try {
      setStatus("connecting");
      await voice.connect();
      setStatus("connected");
    } catch (error) {
      console.error("Connect error:", error);
      setStatus("error");
    }
  }, [voice]);

  const handleDisconnect = useCallback(() => {
    voice.disconnect();
    setStatus("disconnected");
    setMessages([]);
    setToolCalls([]);
  }, [voice]);

  const handleStartListening = useCallback(async () => {
    try {
      await voice.startListening();
      setStatus("listening");
    } catch (error) {
      console.error("Start listening error:", error);
    }
  }, [voice]);

  const handleStopListening = useCallback(() => {
    voice.stopListening();
    setStatus("connected");
  }, [voice]);

  const handleSendText = useCallback(() => {
    if (!textInput.trim()) return;
    voice.sendTextMessage(textInput);
    setMessages(prev => [...prev, { role: "user", text: textInput }]);
    setTextInput("");
    setStatus("thinking");
  }, [voice, textInput]);

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <h1 className="text-2xl font-bold mb-6">豆包 Realtime 语音测试</h1>

      {/* Status */}
      <div className="mb-6 p-4 bg-gray-800 rounded-lg">
        <div className="flex items-center gap-4">
          <span className="text-gray-400">状态:</span>
          <span className={`font-medium ${
            status === "listening" ? "text-green-400" :
            status === "speaking" ? "text-purple-400" :
            status === "thinking" ? "text-blue-400" :
            status === "user_speaking" ? "text-red-400" :
            status === "connected" ? "text-yellow-400" :
            status === "error" ? "text-red-500" :
            "text-gray-400"
          }`}>
            {status}
          </span>
          <span className="text-gray-400 ml-4">连接:</span>
          <span className={voice.isConnected ? "text-green-400" : "text-red-400"}>
            {voice.isConnected ? "已连接" : "未连接"}
          </span>
          <span className="text-gray-400 ml-4">监听:</span>
          <span className={voice.isListening ? "text-green-400" : "text-gray-400"}>
            {voice.isListening ? "是" : "否"}
          </span>
        </div>
      </div>

      {/* Controls */}
      <div className="mb-6 flex gap-4">
        {!voice.isConnected ? (
          <Button onClick={handleConnect} className="bg-green-600 hover:bg-green-700">
            <Phone className="w-4 h-4 mr-2" />
            连接
          </Button>
        ) : (
          <Button onClick={handleDisconnect} variant="destructive">
            <PhoneOff className="w-4 h-4 mr-2" />
            断开
          </Button>
        )}

        {voice.isConnected && !voice.isListening && (
          <Button onClick={handleStartListening} className="bg-blue-600 hover:bg-blue-700">
            <Mic className="w-4 h-4 mr-2" />
            开始录音
          </Button>
        )}

        {voice.isListening && (
          <Button onClick={handleStopListening} variant="secondary">
            <MicOff className="w-4 h-4 mr-2" />
            停止录音
          </Button>
        )}
      </div>

      {/* Text Input */}
      {voice.isConnected && (
        <div className="mb-6 flex gap-2">
          <input
            type="text"
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSendText()}
            placeholder="输入文字消息..."
            className="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500"
          />
          <Button onClick={handleSendText} disabled={!textInput.trim()}>
            <Send className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* Current Transcript */}
      {transcript && (
        <div className="mb-4 p-3 bg-blue-900/50 rounded-lg border border-blue-700">
          <span className="text-blue-300">正在识别: </span>
          <span>{transcript}</span>
        </div>
      )}

      {/* Current Answer */}
      {answer && (
        <div className="mb-4 p-3 bg-purple-900/50 rounded-lg border border-purple-700">
          <span className="text-purple-300">AI 回答中: </span>
          <span>{answer}</span>
        </div>
      )}

      {/* Messages */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-3">对话历史</h2>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {messages.length === 0 ? (
            <p className="text-gray-500">暂无消息</p>
          ) : (
            messages.map((msg, i) => (
              <div
                key={i}
                className={`p-3 rounded-lg ${
                  msg.role === "user"
                    ? "bg-blue-800 ml-12"
                    : "bg-gray-800 mr-12"
                }`}
              >
                <span className="text-xs text-gray-400 block mb-1">
                  {msg.role === "user" ? "用户" : "AI"}
                </span>
                {msg.text}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Tool Calls */}
      {toolCalls.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-3">工具调用</h2>
          <div className="space-y-2">
            {toolCalls.map((call, i) => (
              <div key={i} className="p-3 bg-yellow-900/30 rounded-lg border border-yellow-700">
                <span className="text-yellow-300 font-medium">{call.name}</span>
                <pre className="text-xs text-gray-400 mt-1 overflow-x-auto">{call.args}</pre>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
