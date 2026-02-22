"use client";

/**
 * useDoubaoLLM Hook
 *
 * Doubao LLM client with streaming and function calling support.
 * Communicates through the /api/voice/chat proxy endpoint.
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { LLM_DEFAULTS } from "./constants";
import type { ChatMessage, ToolCall, LLMConfig } from "./types";

interface UseDoubaoLLMOptions {
  config: LLMConfig;
  onContent?: (text: string) => void;
  onToolCall?: (toolCall: { id: string; name: string; arguments: string }) => void;
  onComplete?: () => void;
  onError?: (error: Error) => void;
}

interface UseDoubaoLLMReturn {
  isProcessing: boolean;
  send: (userMessage: string) => Promise<void>;
  sendWithHistory: (messages: ChatMessage[]) => Promise<void>;
  abort: () => void;
  addToolResult: (callId: string, result: string) => void;
  clearHistory: () => void;
  history: ChatMessage[];
}

// Parse SSE data line
function parseSSEData(line: string): unknown | null {
  if (!line.startsWith("data: ")) {
    return null;
  }

  const data = line.slice(6).trim();

  if (data === "[DONE]") {
    return { done: true };
  }

  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

export function useDoubaoLLM(options: UseDoubaoLLMOptions): UseDoubaoLLMReturn {
  const [isProcessing, setIsProcessing] = useState(false);
  const [history, setHistory] = useState<ChatMessage[]>([]);

  const abortControllerRef = useRef<AbortController | null>(null);
  const optionsRef = useRef(options);
  const pendingToolCallsRef = useRef<Map<string, { name: string; arguments: string }>>(new Map());
  // Use ref for isProcessing to avoid stale closure in sendWithHistory
  const isProcessingRef = useRef(false);
  // Use ref for history to avoid calling sendWithHistory inside state updaters
  const historyRef = useRef<ChatMessage[]>([]);

  // Keep refs in sync
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  useEffect(() => {
    historyRef.current = history;
  }, [history]);

  // Initialize / re-initialize history when system prompt changes
  const prevSystemPromptRef = useRef("");
  useEffect(() => {
    const { config } = optionsRef.current;
    const sp = config.systemPrompt || "";
    if (sp && sp !== prevSystemPromptRef.current) {
      console.log("[DoubaoLLM] System prompt updated, reinitializing history. Length:", sp.length);
      prevSystemPromptRef.current = sp;
      const initial = [{ role: "system" as const, content: sp }];
      historyRef.current = initial;
      setHistory(initial);
      pendingToolCallsRef.current.clear();
    }
  }, [options.config.systemPrompt]);

  const processStream = async (response: Response) => {
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("No response body");
    }

    const decoder = new TextDecoder();
    let buffer = "";
    let currentContent = "";
    const currentToolCalls: ToolCall[] = [];
    const toolCallArgsBuffer: Map<number, string> = new Map();

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });

        // Process complete lines
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";  // Keep incomplete line in buffer

        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine) continue;

          const parsed = parseSSEData(trimmedLine);
          if (!parsed) continue;

          // Check for done signal
          if ((parsed as { done?: boolean }).done) {
            continue;
          }

          // Process delta
          const choices = (parsed as { choices?: Array<{
            delta?: {
              content?: string;
              tool_calls?: Array<{
                index: number;
                id?: string;
                function?: {
                  name?: string;
                  arguments?: string;
                };
              }>;
            };
            finish_reason?: string;
          }> }).choices;

          if (!choices || choices.length === 0) continue;

          const delta = choices[0].delta;
          const finishReason = choices[0].finish_reason;

          // Handle content delta
          if (delta?.content) {
            currentContent += delta.content;
            optionsRef.current.onContent?.(delta.content);
          }

          // Handle tool calls delta
          if (delta?.tool_calls) {
            for (const tc of delta.tool_calls) {
              const index = tc.index;

              // Initialize tool call if we have an id
              if (tc.id && tc.function?.name) {
                currentToolCalls[index] = {
                  id: tc.id,
                  type: "function",
                  function: {
                    name: tc.function.name,
                    arguments: "",
                  },
                };
                toolCallArgsBuffer.set(index, "");
              }

              // Accumulate arguments
              if (tc.function?.arguments) {
                const current = toolCallArgsBuffer.get(index) || "";
                toolCallArgsBuffer.set(index, current + tc.function.arguments);
              }
            }
          }

          // Check for completion
          if (finishReason === "tool_calls") {
            // Finalize tool calls
            for (let i = 0; i < currentToolCalls.length; i++) {
              if (currentToolCalls[i]) {
                const args = toolCallArgsBuffer.get(i) || "";
                currentToolCalls[i].function.arguments = args;

                // Store pending tool call
                pendingToolCallsRef.current.set(currentToolCalls[i].id, {
                  name: currentToolCalls[i].function.name,
                  arguments: args,
                });

                // Notify about tool call
                optionsRef.current.onToolCall?.({
                  id: currentToolCalls[i].id,
                  name: currentToolCalls[i].function.name,
                  arguments: args,
                });
              }
            }
          }
        }
      }

      // Add assistant message to history
      if (currentContent || currentToolCalls.length > 0) {
        const assistantMessage: ChatMessage = {
          role: "assistant",
          content: currentContent,
        };

        if (currentToolCalls.length > 0) {
          assistantMessage.tool_calls = currentToolCalls.filter(Boolean);
        }

        const newHistory = [...historyRef.current, assistantMessage];
        historyRef.current = newHistory;
        setHistory(newHistory);
      }

      optionsRef.current.onComplete?.();
    } finally {
      reader.releaseLock();
    }
  };

  const sendWithHistory = useCallback(async (messages: ChatMessage[]) => {
    // Use ref to check processing state (avoids stale closure issues)
    if (isProcessingRef.current) {
      console.warn("LLM already processing");
      return;
    }

    isProcessingRef.current = true;
    setIsProcessing(true);
    abortControllerRef.current = new AbortController();

    try {
      const { config } = optionsRef.current;

      const response = await fetch("/api/voice/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages,
          tools: config.tools,
          stream: true,
          model: LLM_DEFAULTS.MODEL,
          max_tokens: LLM_DEFAULTS.MAX_TOKENS,
          temperature: LLM_DEFAULTS.TEMPERATURE,
          top_p: LLM_DEFAULTS.TOP_P,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`LLM API error: ${response.status} - ${errorText}`);
      }

      await processStream(response);
    } catch (error) {
      if ((error as Error).name === "AbortError") {
        console.log("LLM request aborted");
      } else {
        console.error("LLM error:", error);
        optionsRef.current.onError?.(
          error instanceof Error ? error : new Error("LLM error")
        );
      }
    } finally {
      isProcessingRef.current = false;
      setIsProcessing(false);
      abortControllerRef.current = null;
    }
  }, []);

  const send = useCallback(async (userMessage: string) => {
    const newMessage: ChatMessage = {
      role: "user",
      content: userMessage,
    };

    // Build new history from ref (avoid calling sendWithHistory inside state updater
    // which React Strict Mode double-invokes, causing duplicate LLM calls)
    const newHistory = [...historyRef.current, newMessage];
    historyRef.current = newHistory;
    setHistory(newHistory);
    sendWithHistory(newHistory);
  }, [sendWithHistory]);

  const abort = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    isProcessingRef.current = false;
    setIsProcessing(false);
  }, []);

  const addToolResult = useCallback((callId: string, result: string) => {
    const toolCall = pendingToolCallsRef.current.get(callId);
    if (!toolCall) {
      console.warn("Tool call not found:", callId);
      return;
    }

    const toolMessage: ChatMessage = {
      role: "tool",
      content: result,
      tool_call_id: callId,
      name: toolCall.name,
    };

    // Build new history from ref (avoid side effects inside state updater)
    const newHistory = [...historyRef.current, toolMessage];
    historyRef.current = newHistory;
    setHistory(newHistory);

    // Check if all pending tool calls have results
    const pendingCount = pendingToolCallsRef.current.size;
    pendingToolCallsRef.current.delete(callId);

    if (pendingToolCallsRef.current.size === 0 && pendingCount > 0) {
      sendWithHistory(newHistory);
    }
  }, [sendWithHistory]);

  const clearHistory = useCallback(() => {
    const { config } = optionsRef.current;
    const initial: ChatMessage[] = config.systemPrompt ? [{ role: "system", content: config.systemPrompt }] : [];
    historyRef.current = initial;
    setHistory(initial);
    pendingToolCallsRef.current.clear();
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abort();
    };
  }, [abort]);

  return {
    isProcessing,
    send,
    sendWithHistory,
    abort,
    addToolResult,
    clearHistory,
    history,
  };
}
