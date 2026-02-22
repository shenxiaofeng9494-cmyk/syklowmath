export const DIMENSION_LABELS: Record<string, string> = {
  conceptUnderstanding: "概念理解",
  procedureExecution: "程序执行",
  reasoning: "推理能力",
  transfer: "知识迁移",
  selfExplanation: "自我解释",
};

export function getScoreColor(score: number): string {
  if (score >= 70) return "#4ade80"; // green
  if (score >= 40) return "#facc15"; // yellow
  return "#f87171"; // red
}

export function getScoreBarBg(score: number): string {
  if (score >= 70) return "bg-green-500/20";
  if (score >= 40) return "bg-yellow-500/20";
  return "bg-red-500/20";
}

export function getScoreBarFill(score: number): string {
  if (score >= 70) return "bg-green-500";
  if (score >= 40) return "bg-yellow-500";
  return "bg-red-500";
}

export const TAG_COLORS: Record<string, string> = {
  "假懂": "bg-red-500/20 text-red-300 border-red-500/30",
  "条件遗漏": "bg-orange-500/20 text-orange-300 border-orange-500/30",
  "易走神": "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  "超纲倾向": "bg-purple-500/20 text-purple-300 border-purple-500/30",
  "计算失误": "bg-blue-500/20 text-blue-300 border-blue-500/30",
  "表达困难": "bg-pink-500/20 text-pink-300 border-pink-500/30",
};
