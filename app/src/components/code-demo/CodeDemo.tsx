"use client";

import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import CodeMirror from "@uiw/react-codemirror";
import { python } from "@codemirror/lang-python";
import { usePyodide } from "@/hooks/usePyodide";
import type { CodeDemoData, CodeExecutionResult } from "@/types/excalidraw";
import { Play, Loader2, CheckCircle, XCircle, ChevronDown, ChevronUp } from "lucide-react";

interface CodeDemoProps {
  data: CodeDemoData;
  onExecutionResult?: (result: CodeExecutionResult) => void;
  className?: string;
}

export function CodeDemoInner({ data, onExecutionResult, className }: CodeDemoProps) {
  const [code, setCode] = useState(data.code);
  const [result, setResult] = useState<CodeExecutionResult | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [showVariables, setShowVariables] = useState(true);

  const { isLoading, isReady, loadProgress, runCode, preload } = usePyodide();

  // Preload Pyodide when component mounts
  useEffect(() => {
    preload();
  }, [preload]);

  // Update code when data changes
  useEffect(() => {
    setCode(data.code);
    setResult(null);
  }, [data.code]);

  const handleRunCode = useCallback(async () => {
    setIsExecuting(true);
    setResult(null);

    try {
      const executionResult = await runCode(code);
      setResult(executionResult);
      onExecutionResult?.(executionResult);
    } catch (error) {
      const errorResult: CodeExecutionResult = {
        success: false,
        output: "",
        error: error instanceof Error ? error.message : "执行失败",
      };
      setResult(errorResult);
      onExecutionResult?.(errorResult);
    } finally {
      setIsExecuting(false);
    }
  }, [code, runCode, onExecutionResult]);

  const variableEntries = result?.variables ? Object.entries(result.variables) : [];

  return (
    <div className={`flex flex-col h-full bg-gray-900 ${className}`}>
      {/* Header - 简化，只显示标题 */}
      <div className="flex items-center px-4 py-2 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <div className="w-3 h-3 rounded-full bg-yellow-500" />
            <div className="w-3 h-3 rounded-full bg-green-500" />
          </div>
          <span className="text-gray-300 font-medium text-sm">
            {data.title || "Python 代码演示"}
          </span>
        </div>
      </div>

      {/* Explanation */}
      {data.explanation && (
        <div className="px-4 py-2 bg-blue-900/30 border-b border-gray-700">
          <p className="text-blue-300 text-sm">{data.explanation}</p>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Code editor + Run button */}
        <div className="flex-1 flex flex-col border-r border-gray-700">
          <div className="flex-1 overflow-auto">
            <CodeMirror
              value={code}
              height="100%"
              theme="dark"
              extensions={[python()]}
              onChange={setCode}
              className="h-full text-sm"
              basicSetup={{
                lineNumbers: true,
                highlightActiveLineGutter: true,
                highlightActiveLine: true,
                foldGutter: true,
              }}
            />
          </div>
          {/* Run button toolbar */}
          <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-t border-gray-700">
            <span className="text-gray-500 text-xs">Python 3.11 (Pyodide)</span>
            <button
              onClick={handleRunCode}
              disabled={isExecuting || isLoading}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white rounded-lg transition-colors text-sm"
            >
              {isExecuting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  运行中...
                </>
              ) : isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  加载 Python ({loadProgress}%)
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  运行代码
                </>
              )}
            </button>
          </div>
        </div>

        {/* Output panel */}
        <div className="w-full md:w-80 flex flex-col bg-gray-950 overflow-hidden">
          {/* Output */}
          <div className="flex-1 p-4 overflow-auto">
            <h3 className="text-gray-400 text-xs font-semibold uppercase mb-2">输出</h3>
            <AnimatePresence mode="wait">
              {result ? (
                <motion.div
                  key="result"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="font-mono text-sm"
                >
                  {result.success ? (
                    <div className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                      <pre className="text-green-400 whitespace-pre-wrap break-all">
                        {result.output}
                      </pre>
                    </div>
                  ) : (
                    <div className="flex items-start gap-2">
                      <XCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                      <pre className="text-red-400 whitespace-pre-wrap break-all">
                        {result.error || "执行错误"}
                      </pre>
                    </div>
                  )}
                </motion.div>
              ) : isExecuting ? (
                <motion.div
                  key="executing"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center gap-2 text-gray-400"
                >
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>执行中...</span>
                </motion.div>
              ) : (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-gray-500 text-sm"
                >
                  点击"运行"按钮执行代码
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Variables */}
          {variableEntries.length > 0 && (
            <div className="border-t border-gray-800">
              <button
                onClick={() => setShowVariables(!showVariables)}
                className="w-full flex items-center justify-between px-4 py-2 text-gray-400 hover:bg-gray-800/50"
              >
                <span className="text-xs font-semibold uppercase">
                  变量 ({variableEntries.length})
                </span>
                {showVariables ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </button>
              <AnimatePresence>
                {showVariables && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 pb-4 space-y-1 max-h-32 overflow-auto">
                      {variableEntries.map(([name, value]) => (
                        <div
                          key={name}
                          className="flex items-center justify-between text-sm font-mono"
                        >
                          <span className="text-purple-400">{name}</span>
                          <span className="text-gray-300 truncate ml-2 max-w-[150px]">
                            {value}
                          </span>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>

      {/* Loading overlay */}
      <AnimatePresence>
        {isLoading && !isReady && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-gray-900/80 flex flex-col items-center justify-center"
          >
            <Loader2 className="w-12 h-12 text-blue-500 animate-spin mb-4" />
            <p className="text-white text-lg mb-2">正在加载 Python 环境</p>
            <div className="w-48 h-2 bg-gray-700 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-blue-500"
                initial={{ width: 0 }}
                animate={{ width: `${loadProgress}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
            <p className="text-gray-400 text-sm mt-2">{loadProgress}%</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
