"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import katex from "katex";
import "katex/dist/katex.min.css";
import * as math from "mathjs";

// Plotly 类型定义
type PlotlyType = typeof import("plotly.js-dist-min");
let Plotly: PlotlyType | null = null;

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

// 常见的参数变量名及其默认值
const COMMON_PARAMS: Record<string, { value: number; min: number; max: number; step: number }> = {
  k: { value: 1, min: -5, max: 5, step: 0.5 },
  a: { value: 1, min: -5, max: 5, step: 0.5 },
  b: { value: 0, min: -5, max: 5, step: 0.5 },
  c: { value: 0, min: -5, max: 5, step: 0.5 },
  m: { value: 1, min: -5, max: 5, step: 0.5 },
  n: { value: 0, min: -5, max: 5, step: 0.5 },
};

// 数学函数名，不应被识别为参数
const MATH_FUNCTIONS = new Set([
  "sin", "cos", "tan", "asin", "acos", "atan", "atan2",
  "sinh", "cosh", "tanh", "asinh", "acosh", "atanh",
  "sqrt", "cbrt", "abs", "sign", "floor", "ceil", "round",
  "exp", "log", "log10", "log2", "ln",
  "pow", "mod", "min", "max",
]);

// 从表达式中提取未声明的参数变量
function extractParams(expr: string, declaredParams: string[]): Array<{ name: string; value: number; min: number; max: number; step: number }> {
  try {
    let cleanExpr = expr.replace(/^[yf]\s*\(?x?\)?\s*=\s*/i, "").trim();
    cleanExpr = preprocessExpression(cleanExpr);
    const node = math.parse(cleanExpr);
    const foundParams: Array<{ name: string; value: number; min: number; max: number; step: number }> = [];

    node.traverse((n) => {
      if (n.type === "SymbolNode") {
        const name = (n as math.SymbolNode).name;
        if (
          name !== "x" &&
          name !== "t" &&
          name !== "pi" &&
          name !== "e" &&
          !MATH_FUNCTIONS.has(name) &&
          !declaredParams.includes(name) &&
          !foundParams.some((p) => p.name === name)
        ) {
          // 使用常见参数的默认值，或者使用通用默认值
          const defaults = COMMON_PARAMS[name] || { value: 1, min: -5, max: 5, step: 0.5 };
          foundParams.push({ name, ...defaults });
        }
      }
    });

    return foundParams;
  } catch {
    return [];
  }
}

// 预处理表达式：处理隐式乘法和特殊字符
function preprocessExpression(expr: string): string {
  let result = expr;

  // 1. 转换上标符号为 ^ 形式
  result = result
    .replace(/²/g, "^2")
    .replace(/³/g, "^3")
    .replace(/⁴/g, "^4")
    .replace(/⁻¹/g, "^(-1)")
    .replace(/⁻²/g, "^(-2)");

  // 2. 处理字母之间的隐式乘法（如 kx -> k*x, ax -> a*x）
  // 匹配：字母后面紧跟字母（但不是函数名的一部分）
  // 排除常见函数名：sin, cos, tan, log, exp, sqrt, abs, ln 等
  const funcPattern = /\b(sin|cos|tan|asin|acos|atan|sinh|cosh|tanh|sqrt|cbrt|abs|sign|floor|ceil|round|exp|log|log10|log2|ln|pow|mod|min|max|pi)\b/gi;

  // 先保护函数名，用不含字母的占位符替换
  const placeholders: string[] = [];
  result = result.replace(funcPattern, (match) => {
    placeholders.push(match);
    return `§${placeholders.length - 1}§`;
  });

  // 处理隐式乘法：
  // - 字母后紧跟字母：ab -> a*b
  // - 数字后紧跟字母：2x -> 2*x（mathjs 已支持，但为了一致性也处理）
  // - 字母后紧跟数字：x2 -> x*2（不常见，但处理）
  // - 右括号后紧跟字母或左括号：)x -> )*x, )( -> )*(
  // - 字母或数字后紧跟左括号：x( -> x*(, 2( -> 2*(

  // 字母后紧跟字母（单字母变量之间）
  result = result.replace(/([a-zA-Z])([a-zA-Z])/g, "$1*$2");
  // 可能需要多次处理（如 abc -> a*b*c）
  result = result.replace(/([a-zA-Z])([a-zA-Z])/g, "$1*$2");

  // 字母后紧跟左括号
  result = result.replace(/([a-zA-Z])\(/g, "$1*(");

  // 右括号后紧跟字母或左括号
  result = result.replace(/\)([a-zA-Z])/g, ")*$1");
  result = result.replace(/\)\(/g, ")*(");

  // 数字后紧跟左括号
  result = result.replace(/(\d)\(/g, "$1*(");

  // 恢复函数名
  result = result.replace(/§(\d+)§/g, (_, idx) => placeholders[parseInt(idx)]);

  return result;
}

// 解析数学表达式为 JavaScript 函数
function parseExpression(expr: string, params: Array<{ name: string; value: number }> = []): ((x: number) => number) | null {
  try {
    // 移除 "y =" 或 "f(x) =" 前缀
    let cleanExpr = expr
      .replace(/^[yf]\s*\(?x?\)?\s*=\s*/i, "")
      .trim();

    // 预处理表达式
    cleanExpr = preprocessExpression(cleanExpr);

    const node = math.parse(cleanExpr);
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
  const [plotlyLoaded, setPlotlyLoaded] = useState(false);
  const plotRef = useRef<HTMLDivElement>(null);

  // 动态加载 Plotly（仅在客户端）
  useEffect(() => {
    if (typeof window !== "undefined" && !Plotly) {
      import("plotly.js-dist-min").then((module) => {
        Plotly = module.default;
        setPlotlyLoaded(true);
      });
    } else if (Plotly) {
      setPlotlyLoaded(true);
    }
  }, []);

  // 支持多个函数：用英文/中文逗号、分号或换行分隔
  const expressionList = useMemo(() => {
    return expression
      .split(/[,，;；\n]+/)
      .map((exp) => exp.trim())
      .filter(Boolean);
  }, [expression]);

  // 自动提取表达式中的参数变量，合并用户提供的参数
  const allParams = useMemo(() => {
    const declaredNames = graphParams.map((p) => p.name);
    const autoParams: Array<{ name: string; value: number; min: number; max: number; step: number; label?: string }> = [];

    for (const exp of expressionList) {
      const extracted = extractParams(exp, declaredNames);
      for (const p of extracted) {
        if (!autoParams.some((ap) => ap.name === p.name)) {
          autoParams.push(p);
        }
      }
    }

    // 合并：用户提供的参数优先
    const merged = [
      ...graphParams.map((p) => ({
        name: p.name,
        value: p.value,
        min: p.min ?? -5,
        max: p.max ?? 5,
        step: p.step ?? 0.5,
        label: p.label,
      })),
      ...autoParams,
    ];

    return merged;
  }, [expressionList, graphParams]);

  const [paramValues, setParamValues] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    allParams.forEach((p) => {
      initial[p.name] = p.value ?? 0;
    });
    return initial;
  });

  useEffect(() => {
    const initial: Record<string, number> = {};
    allParams.forEach((p) => {
      initial[p.name] = p.value ?? 0;
    });
    setParamValues(initial);
  }, [allParams]);

  useEffect(() => {
    if (!plotRef.current || !plotlyLoaded || !Plotly) return;
    if (expressionList.length === 0) {
      setError("未提供函数表达式，无法绘制图像");
      return;
    }

    // 等待参数初始化完成
    if (allParams.length > 0 && Object.keys(paramValues).length === 0) {
      return; // 参数还未初始化，等待下一次渲染
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const traces: any[] = [];
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
  }, [expressionList, xRange, yRange, points, paramValues, plotlyLoaded, allParams]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-gray-800 rounded-2xl p-3 overflow-hidden shadow-lg border border-gray-700"
    >
      <div className="text-center text-gray-300 text-sm mb-2 font-mono whitespace-pre-wrap">
        {expressionList.join("\n")}
      </div>
      {allParams.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
          {allParams.map((p) => {
            const min = p.min ?? -5;
            const max = p.max ?? 5;
            const step = p.step ?? 0.1;
            const value = paramValues[p.name] ?? p.value ?? 0;
            return (
              <div key={p.name} className="flex items-center gap-2 text-sm text-gray-300">
                <span className="w-12 text-right text-gray-400">{p.label || p.name}:</span>
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
                  className="w-16 border border-gray-600 bg-gray-700 rounded px-1 py-0.5 text-gray-200"
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
      // 处理包含 $...$ 的混合内容
      // 如果内容包含 $，则提取 $ 之间的 LaTeX 代码
      let cleanLatex = latex;

      // 检查是否包含 $...$ 格式
      const dollarMatch = latex.match(/\$([^$]+)\$/);
      if (dollarMatch) {
        // 提取第一个 $...$ 之间的内容
        cleanLatex = dollarMatch[1];
      }

      // 去掉可能的前后空格
      cleanLatex = cleanLatex.trim();

      console.log("FormulaDisplay rendering:", { original: latex, cleaned: cleanLatex });

      const rendered = katex.renderToString(cleanLatex, {
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
      className="bg-gray-800 border border-[#4ECDC4]/30 rounded-2xl p-4 shadow-lg"
    >
      <div
        className="text-center text-xl overflow-x-auto text-gray-100"
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
    <div className="bg-[#242640] border border-[#4ECDC4]/30 rounded-2xl p-4 space-y-3 shadow-lg">
      <div className="flex items-center gap-2 text-[#4ECDC4] text-sm">
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
