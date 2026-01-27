"use client";

import { motion } from "framer-motion";

interface QuickIntentsProps {
  currentSubtitle: string;
  onSelect: (prompt: string) => void;
}

const QUICK_INTENTS = [
  { id: "explain", label: "解释一下", icon: "❓", template: '请解释一下"{subtitle}"是什么意思' },
  { id: "example", label: "举个例子", icon: "💡", template: '能举一个例子来解释"{subtitle}"吗' },
  { id: "formula", label: "写出公式", icon: "📐", template: "请把相关的公式写出来" },
  { id: "draw", label: "画图解释", icon: "🎨", template: "请画图来解释一下这个概念" },
];

export function QuickIntents({ currentSubtitle, onSelect }: QuickIntentsProps) {
  const handleSelect = (intent: typeof QUICK_INTENTS[0]) => {
    const prompt = intent.template.replace(
      "{subtitle}",
      currentSubtitle.slice(0, 30) || "刚才讲的内容"
    );
    onSelect(prompt);
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-400 text-center">不知道怎么问？试试这些：</p>
      <div className="flex flex-wrap gap-2 justify-center">
        {QUICK_INTENTS.map((intent, index) => (
          <motion.button
            key={intent.id}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.05 }}
            onClick={() => handleSelect(intent)}
            className="px-4 py-2 bg-gray-700 hover:bg-blue-600 rounded-full
                       text-sm text-white flex items-center gap-2 transition-colors"
          >
            <span>{intent.icon}</span>
            <span>{intent.label}</span>
          </motion.button>
        ))}
      </div>
    </div>
  );
}
