"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

// Loading component
function CodeDemoLoading() {
  return (
    <div className="flex flex-col items-center justify-center h-full bg-gray-900">
      <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-4" />
      <p className="text-gray-400">加载代码编辑器...</p>
    </div>
  );
}

// Dynamic import with SSR disabled
export const CodeDemo = dynamic(
  () => import("./CodeDemo").then((mod) => mod.CodeDemoInner),
  {
    ssr: false,
    loading: () => <CodeDemoLoading />,
  }
);

// Re-export types
export type { CodeDemoData, CodeExecutionResult } from "@/types/excalidraw";
