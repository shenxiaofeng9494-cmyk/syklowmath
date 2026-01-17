"use client";

import { Whiteboard } from "@/components/whiteboard/Whiteboard";

export default function TestGraphPage() {
  return (
    <div className="min-h-screen bg-gray-900 p-8">
      <h1 className="text-2xl font-bold text-white mb-8">函数图像测试页面</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* 一次函数 */}
        <div className="bg-gray-800 rounded-lg p-4">
          <h2 className="text-white font-medium mb-4">一次函数</h2>
          <Whiteboard
            type="graph"
            content="y = 2x + 1"
          />
        </div>

        {/* 二次函数 */}
        <div className="bg-gray-800 rounded-lg p-4">
          <h2 className="text-white font-medium mb-4">二次函数</h2>
          <Whiteboard
            type="graph"
            content="y = x^2"
            graphConfig={{
              yRange: [-2, 10],
              points: [{ x: 0, y: 0, label: "顶点" }],
            }}
          />
        </div>

        {/* 带系数的二次函数 */}
        <div className="bg-gray-800 rounded-lg p-4">
          <h2 className="text-white font-medium mb-4">y = -x² + 4</h2>
          <Whiteboard
            type="graph"
            content="y = -x^2 + 4"
            graphConfig={{
              yRange: [-5, 6],
              points: [
                { x: 0, y: 4, label: "顶点" },
                { x: -2, y: 0, label: "零点" },
                { x: 2, y: 0, label: "零点" },
              ],
            }}
          />
        </div>

        {/* 正弦函数 */}
        <div className="bg-gray-800 rounded-lg p-4">
          <h2 className="text-white font-medium mb-4">正弦函数</h2>
          <Whiteboard
            type="graph"
            content="y = sin(x)"
            graphConfig={{
              xRange: [-6.28, 6.28],
              yRange: [-2, 2],
            }}
          />
        </div>

        {/* 绝对值函数 */}
        <div className="bg-gray-800 rounded-lg p-4">
          <h2 className="text-white font-medium mb-4">绝对值函数</h2>
          <Whiteboard
            type="graph"
            content="y = abs(x)"
            graphConfig={{
              yRange: [-1, 6],
            }}
          />
        </div>

        {/* 平方根函数 */}
        <div className="bg-gray-800 rounded-lg p-4">
          <h2 className="text-white font-medium mb-4">平方根函数</h2>
          <Whiteboard
            type="graph"
            content="y = sqrt(x)"
            graphConfig={{
              xRange: [0, 10],
              yRange: [-1, 4],
            }}
          />
        </div>

        {/* 公式类型测试 */}
        <div className="bg-gray-800 rounded-lg p-4">
          <h2 className="text-white font-medium mb-4">公式展示</h2>
          <Whiteboard
            type="formula"
            content="ax^2 + bx + c = 0"
          />
        </div>

        {/* 分步推导测试 */}
        <div className="bg-gray-800 rounded-lg p-4">
          <h2 className="text-white font-medium mb-4">分步推导</h2>
          <Whiteboard
            type="formula"
            content=""
            steps={[
              "x^2 + 4x + 4 = 0",
              "(x + 2)^2 = 0",
              "x = -2",
            ]}
          />
        </div>
      </div>
    </div>
  );
}
