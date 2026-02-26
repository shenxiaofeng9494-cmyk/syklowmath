"use client";

import { useEffect } from "react";

export default function WatchError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[WatchPage] Client error:", error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-black">
      <div className="text-center max-w-md px-6">
        <div className="text-red-400 text-5xl mb-4">!</div>
        <h2 className="text-white text-xl font-semibold mb-2">页面出错了</h2>
        <p className="text-gray-400 text-sm mb-6">
          遇到了一个临时问题，请重试
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2.5 rounded-lg transition-colors"
          >
            重试
          </button>
          <a
            href="/"
            className="bg-white/10 hover:bg-white/20 text-white px-6 py-2.5 rounded-lg transition-colors"
          >
            返回首页
          </a>
        </div>
      </div>
    </div>
  );
}
