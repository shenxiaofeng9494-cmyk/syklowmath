"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import katex from "katex";
import "katex/dist/katex.min.css";
// @ts-expect-error - plotly.js-dist-min has no type declarations
import Plotly from "plotly.js-dist-min";
import * as math from "mathjs";

interface WhiteboardProps {
  type: "formula" | "graph";
  content: string;
  steps?: string[];
  // 图形相关配置
  graphConfig?: {
    xRange?: [number, number];
    yRange?: [number, number];
    points?: Array<{ x: number; y: number; label?: string }>;
    params?: Array<{
      name: string;
      value: number;
      min?: number;
      max?: number;
      step?: number;
      label?: string;
    }>;
  };
}

export function Whiteboard({ type, content, steps, graphConfig }: WhiteboardProps) {
  useEffect(() => {
    console.log("Render Whiteboard", { type, content, steps, graphConfig });
  }, [type, content, steps, graphConfig]);

  if (type === "formula") {
    return steps ? (
      <StepByStepFormula steps={steps} />
    ) : (
      <FormulaDisplay latex={content} />
    );
  }

  if (type === "graph") {
    return (
      <GraphDisplay
        expression={content}
        xRange={graphConfig?.xRange}
        yRange={graphConfig?.yRange}
        points={graphConfig?.points}
        graphParams={graphConfig?.params || []}
      />
    );
  }

  return null;
}

// 解析数学表达式为 JavaScript 函数
function parseExpression(expr: string, params: Array<{ name: string; value: number }> = []): ((x: number) => number) | null {
  try {
    // 移除 "y =" 或 "f(x) =" 前缀
    const cleanExpr = expr
      .replace(/^[yf]\s*\(?x?\)?\s*=\s*/i, "")
      .trim();

    const node = math.parse(cleanExpr);

    const paramNames = params.map((p) => p.name);

    // 收集符号，排除自变量 x/t 和已声明参数
    const symbols = new Set<string>();
    node.traverse((n) => {
      if (n.type === "SymbolNode") {
        const name = (n as math.SymbolNode).name;
        if (
          name !== "x" &&
          name !== "t" &&
          name !== "pi" &&
          name !== "e" &&
          !paramNames.includes(name)
        ) {
          symbols.add(name);
        }
      }
    });

    // 如果存在除 x/t 以外的符号，视为非数值表达式，直接放弃
    if (symbols.size > 0) {
      console.warn("Expression contains symbolic parameters, skip:", expr);
      return null;
    }

    const compiled = node.compile();

    const evaluate = (x: number) => {
      const scope: Record<string, number> = {
        x,
        t: x,
        pi: Math.PI,
        e: Math.E,
      };
      params.forEach((p) => {
        scope[p.name] = p.value;
      });
      const value = compiled.evaluate(scope);
      return typeof value === "number" ? value : NaN;
    };

    // 测试函数是否有效
    const testResult = evaluate(1);
    if (!Number.isFinite(testResult)) {
      const testResult2 = evaluate(0.5);
      if (!Number.isFinite(testResult2)) {
        return null;
      }
    }

    return evaluate;
  } catch (e) {
    console.error("Failed to parse expression:", expr, e);
    return null;
  }
}

// 函数图像显示
function GraphDisplay({
  expression,
  xRange = [-5, 5],
  yRange,
  points = [],
  graphParams = [],
}: {
  expression: string;
  xRange?: [number, number];
  yRange?: [number, number];
  points?: Array<{ x: number; y: number; label?: string }>;
  graphParams?: Array<{
    name: string;
    value: number;
    min?: number;
    max?: number;
    step?: number;
    label?: string;
  }>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [paramValues, setParamValues] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    graphParams.forEach((p) => {
      initial[p.name] = p.value ?? 0;
    });
    return initial;
  });
  const plotRef = useRef<HTMLDivElement>(null);

  // 支持多个函数：用英文/中文逗号、分号或换行分隔
  const expressionList = useMemo(() => {
    return expression
      .split(/[,，;；\n]+/)
      .map((exp) => exp.trim())
      .filter(Boolean);
  }, [expression]);

  useEffect(() => {
    const initial: Record<string, number> = {};
    graphParams.forEach((p) => {
      initial[p.name] = p.value ?? 0;
    });
    setParamValues(initial);
  }, [graphParams]);

  useEffect(() => {
    if (!plotRef.current) return;
    if (expressionList.length === 0) {
      setError("未提供函数表达式，无法绘制图像");
      return;
    }

    const traces: Plotly.Data[] = [];
    const palette = ["#2563eb", "#f97316", "#10b981", "#ef4444", "#8b5cf6"];
    const [xmin, xmax] = xRange;
    const samples = 400;
    const step = (xmax - xmin) / samples;
    const yValues: number[] = [];

    for (let idx = 0; idx < expressionList.length; idx++) {
      const exp = expressionList[idx];
      const paramList = Object.entries(paramValues).map(([name, value]) => ({ name, value }));
      const fn = parseExpression(exp, paramList);
      if (!fn) continue;

      const xs: number[] = [];
      const ys: number[] = [];
      for (let i = 0; i <= samples; i++) {
        const x = xmin + i * step;
        const y = fn(x);
        if (Number.isFinite(y)) {
          xs.push(x);
          ys.push(y);
          yValues.push(y);
        }
      }

      if (xs.length > 1) {
        traces.push({
          x: xs,
          y: ys,
          type: "scatter",
          mode: "lines",
          name: exp,
          line: {
            color: palette[idx % palette.length],
            width: 2,
          },
        });
      }
    }

    // 渲染特殊点
    if (points.length > 0) {
      traces.push({
        x: points.map((p) => p.x),
        y: points.map((p) => p.y),
        mode: "markers+text",
        type: "scatter",
        name: "points",
        marker: { color: "#ef4444", size: 8 },
        text: points.map((p) => p.label || ""),
        textposition: "top center",
      });
    }

    if (traces.length === 0) {
      setError(`无法解析函数: ${expression}`);
      return;
    }

    // 如果未指定 yRange，则根据数据自动计算范围
    let finalYRange: [number, number] | undefined = yRange;
    if (!finalYRange && yValues.length > 0) {
      const minY = Math.min(...yValues);
      const maxY = Math.max(...yValues);
      const pad = (maxY - minY || 1) * 0.2;
      finalYRange = [minY - pad, maxY + pad];
    }

    setError(null);
    Plotly.react(
      plotRef.current,
      traces,
      {
        margin: { l: 40, r: 10, t: 30, b: 40 },
        xaxis: { range: xRange, zeroline: true },
        yaxis: { range: finalYRange, zeroline: true },
        paper_bgcolor: "rgba(0,0,0,0)",
        plot_bgcolor: "rgba(0,0,0,0)",
        legend: { orientation: "h" },
      },
      { responsive: true },
    );
  }, [expressionList, xRange, yRange, points, paramValues]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-white rounded-lg p-2 overflow-hidden"
    >
      <div className="text-center text-gray-600 text-sm mb-2 font-mono whitespace-pre-wrap">
        {expressionList.join("\n")}
      </div>
      {graphParams.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
          {graphParams.map((p) => {
            const min = p.min ?? -5;
            const max = p.max ?? 5;
            const step = p.step ?? 0.1;
            const value = paramValues[p.name] ?? p.value ?? 0;
            return (
              <div key={p.name} className="flex items-center gap-2 text-sm text-gray-700">
                <span className="w-12 text-right text-gray-600">{p.label || p.name}:</span>
                <input
                  type="range"
                  min={min}
                  max={max}
                  step={step}
                  value={value}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setParamValues((prev) => ({ ...prev, [p.name]: v }));
                  }}
                  className="flex-1"
                />
                <input
                  type="number"
                  min={min}
                  max={max}
                  step={step}
                  value={value}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setParamValues((prev) => ({ ...prev, [p.name]: v }));
                  }}
                  className="w-16 border border-gray-300 rounded px-1 py-0.5 text-gray-800"
                />
              </div>
            );
          })}
        </div>
      )}
      {error ? (
        <div className="bg-red-900/50 border border-red-500 rounded-lg p-4 text-red-300">
          {error}
        </div>
      ) : (
        <div ref={plotRef} className="w-full h-72" />
      )}
    </motion.div>
  );
}

// 单个公式显示
function FormulaDisplay({ latex }: { latex: string }) {
  const [html, setHtml] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const rendered = katex.renderToString(latex, {
        throwOnError: false,
        displayMode: true,
      });
      setHtml(rendered);
      setError(null);
    } catch (e) {
      setError("公式渲染失败");
      console.error("KaTeX error:", e, "latex:", latex);
    }
  }, [latex]);

  if (error) {
    return (
      <div className="bg-red-900/50 border border-red-500 rounded-lg p-4 text-red-300">
        {error}: {latex}
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-slate-100 border border-gray-300 rounded-lg p-4"
    >
      <div
        className="text-center text-xl overflow-x-auto text-gray-900"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </motion.div>
  );
}

// 分步骤公式显示
function StepByStepFormula({ steps }: { steps: string[] }) {
  const [visibleSteps, setVisibleSteps] = useState(0);

  useEffect(() => {
    // 逐步显示每一步
    const timer = setInterval(() => {
      setVisibleSteps((prev) => {
        if (prev >= steps.length) {
          clearInterval(timer);
          return prev;
        }
        return prev + 1;
      });
    }, 1500); // 每 1.5 秒显示一步

    return () => clearInterval(timer);
  }, [steps.length]);

  return (
    <div className="bg-gray-900 border border-gray-600 rounded-lg p-4 space-y-3">
      <div className="flex items-center gap-2 text-gray-400 text-sm">
        <span>📝</span>
        <span>推导过程</span>
      </div>

      <AnimatePresence>
        {steps.slice(0, visibleSteps).map((step, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <FormulaDisplay latex={step} />
          </motion.div>
        ))}
      </AnimatePresence>

      {visibleSteps < steps.length && (
        <div className="text-center text-gray-400">
          <span className="animate-pulse">正在书写...</span>
        </div>
      )}
    </div>
  );
}
