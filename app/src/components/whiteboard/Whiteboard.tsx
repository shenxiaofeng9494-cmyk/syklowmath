"use client";

import { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import katex from "katex";
import "katex/dist/katex.min.css";
import { Mafs, Coordinates, Plot, Point, Text, Line, Theme } from "mafs";
import "mafs/core.css";

interface WhiteboardProps {
  type: "formula" | "graph";
  content: string;
  steps?: string[];
  // 图形相关配置
  graphConfig?: {
    xRange?: [number, number];
    yRange?: [number, number];
    points?: Array<{ x: number; y: number; label?: string }>;
  };
}

export function Whiteboard({ type, content, steps, graphConfig }: WhiteboardProps) {
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
      />
    );
  }

  return null;
}

// 解析数学表达式为 JavaScript 函数
function parseExpression(expr: string): ((x: number) => number) | null {
  try {
    // 移除 "y =" 或 "f(x) =" 前缀
    let cleanExpr = expr
      .replace(/^[yf]\s*\(?x?\)?\s*=\s*/i, "")
      .trim();

    // 替换数学符号为 JavaScript
    cleanExpr = cleanExpr
      // 先处理数学函数
      .replace(/sqrt/gi, "Math.sqrt")
      .replace(/sin/gi, "Math.sin")
      .replace(/cos/gi, "Math.cos")
      .replace(/tan/gi, "Math.tan")
      .replace(/abs/gi, "Math.abs")
      .replace(/log/gi, "Math.log")
      .replace(/ln/gi, "Math.log")
      .replace(/exp/gi, "Math.exp")
      .replace(/pi/gi, "Math.PI")
      .replace(/e(?![xp])/gi, "Math.E")
      // 处理乘法省略
      .replace(/(\d)([x])/g, "$1*$2")          // 2x -> 2*x
      .replace(/([x])(\d)/g, "$1*$2")          // x2 -> x*2
      .replace(/\)(\d)/g, ")*$1")              // )2 -> )*2
      .replace(/(\d)\(/g, "$1*(")              // 2( -> 2*(
      .replace(/\)\(/g, ")*(")                 // )( -> )*(
      .replace(/([x])\(/g, "$1*(")             // x( -> x*(
      .replace(/\)([x])/g, ")*$1")             // )x -> )*x
      // 处理幂运算 - 用括号包裹底数避免优先级问题
      .replace(/(-?)([x])\^(\d+)/g, "(($1$2)**$3)")  // -x^2 -> ((-x)**2)
      .replace(/(-?\d+)\^(\d+)/g, "(($1)**$2)")      // -2^2 -> ((-2)**2)
      .replace(/\^/g, "**");                         // 其他情况

    // 创建函数
    const fn = new Function("x", `return ${cleanExpr}`);

    // 测试函数是否有效
    const testResult = fn(1);
    if (typeof testResult !== "number" || !isFinite(testResult)) {
      // 如果 x=1 不行，尝试 x=0.5
      const testResult2 = fn(0.5);
      if (typeof testResult2 !== "number") {
        return null;
      }
    }

    return fn as (x: number) => number;
  } catch (e) {
    console.error("Failed to parse expression:", expr, e);
    return null;
  }
}

// 函数图像显示
function GraphDisplay({
  expression,
  xRange = [-5, 5],
  yRange = [-5, 5],
  points = [],
}: {
  expression: string;
  xRange?: [number, number];
  yRange?: [number, number];
  points?: Array<{ x: number; y: number; label?: string }>;
}) {
  const fn = useMemo(() => parseExpression(expression), [expression]);

  // 如果解析失败，显示错误
  if (!fn) {
    return (
      <div className="bg-red-900/50 border border-red-500 rounded-lg p-4 text-red-300">
        无法解析函数: {expression}
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-white rounded-lg p-2 overflow-hidden"
    >
      {/* 显示函数表达式 */}
      <div className="text-center text-gray-600 text-sm mb-2 font-mono">
        {expression}
      </div>

      {/* Mafs 图形 */}
      <div className="aspect-square max-w-[300px] mx-auto">
        <Mafs
          viewBox={{ x: xRange, y: yRange }}
          preserveAspectRatio={false}
        >
          <Coordinates.Cartesian
            xAxis={{ lines: 1, labels: (x) => (x % 2 === 0 ? x : "") }}
            yAxis={{ lines: 1, labels: (y) => (y % 2 === 0 ? y : "") }}
          />
          <Plot.OfX
            y={fn}
            color={Theme.blue}
            weight={2}
          />
          {/* 渲染特殊点 */}
          {points.map((point, index) => (
            <Point
              key={index}
              x={point.x}
              y={point.y}
              color={Theme.red}
            />
          ))}
          {/* 渲染点的标签 */}
          {points.filter(p => p.label).map((point, index) => (
            <Text
              key={`label-${index}`}
              x={point.x + 0.3}
              y={point.y + 0.3}
              size={12}
            >
              {point.label}
            </Text>
          ))}
        </Mafs>
      </div>
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
      console.error("KaTeX error:", e);
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
