"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { CodeExecutionResult } from "@/types/excalidraw";

// Pyodide CDN URL
const PYODIDE_CDN = "https://cdn.jsdelivr.net/pyodide/v0.24.1/full/";

// Global Pyodide instance to avoid reloading
let globalPyodide: PyodideInterface | null = null;
let loadingPromise: Promise<PyodideInterface> | null = null;

// Pyodide interface (simplified)
interface PyodideInterface {
  runPythonAsync: (code: string) => Promise<unknown>;
  globals: {
    get: (name: string) => unknown;
    toJs: () => Map<string, unknown>;
  };
  loadPackagesFromImports: (code: string) => Promise<void>;
}

// Declare global loadPyodide function
declare global {
  interface Window {
    loadPyodide?: (config: { indexURL: string }) => Promise<PyodideInterface>;
  }
}

export function usePyodide() {
  const [isLoading, setIsLoading] = useState(false);
  const [isReady, setIsReady] = useState(!!globalPyodide);
  const [loadProgress, setLoadProgress] = useState(0);
  const outputRef = useRef<string[]>([]);

  // Load Pyodide script
  const loadPyodideScript = useCallback(async (): Promise<void> => {
    if (window.loadPyodide) return;

    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = `${PYODIDE_CDN}pyodide.js`;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Failed to load Pyodide script"));
      document.head.appendChild(script);
    });
  }, []);

  // Initialize Pyodide
  const initPyodide = useCallback(async (): Promise<PyodideInterface> => {
    if (globalPyodide) return globalPyodide;
    if (loadingPromise) return loadingPromise;

    setIsLoading(true);
    setLoadProgress(10);

    loadingPromise = (async () => {
      try {
        // Load script
        await loadPyodideScript();
        setLoadProgress(30);

        // Initialize Pyodide
        if (!window.loadPyodide) {
          throw new Error("loadPyodide not available");
        }

        const pyodide = await window.loadPyodide({
          indexURL: PYODIDE_CDN,
        });
        setLoadProgress(70);

        // Preload common packages
        await pyodide.loadPackagesFromImports("import numpy\nimport sympy");
        setLoadProgress(100);

        globalPyodide = pyodide;
        setIsReady(true);
        return pyodide;
      } finally {
        setIsLoading(false);
        loadingPromise = null;
      }
    })();

    return loadingPromise;
  }, [loadPyodideScript]);

  // Run Python code
  const runCode = useCallback(
    async (code: string): Promise<CodeExecutionResult> => {
      try {
        const pyodide = await initPyodide();

        // Clear previous output
        outputRef.current = [];

        // Setup stdout capture
        await pyodide.runPythonAsync(`
import sys
from io import StringIO
sys.stdout = StringIO()
sys.stderr = StringIO()
        `);

        // Try to load any required packages
        try {
          await pyodide.loadPackagesFromImports(code);
        } catch {
          // Ignore package loading errors
        }

        // Run user code
        await pyodide.runPythonAsync(code);

        // Capture output
        const stdout = await pyodide.runPythonAsync("sys.stdout.getvalue()");
        const stderr = await pyodide.runPythonAsync("sys.stderr.getvalue()");

        // Extract variables (exclude builtins and modules)
        const variables: Record<string, string> = {};
        const globals = pyodide.globals.toJs();

        for (const [key, value] of globals.entries()) {
          // Skip private, modules, and built-in names
          if (
            key.startsWith("_") ||
            key === "sys" ||
            key === "StringIO" ||
            typeof value === "function"
          ) {
            continue;
          }

          try {
            // Get string representation
            const repr = await pyodide.runPythonAsync(`repr(${key})`);
            if (typeof repr === "string" && repr.length < 100) {
              variables[key] = repr;
            }
          } catch {
            // Skip variables that can't be represented
          }
        }

        const output = String(stdout || "");
        const error = String(stderr || "");

        return {
          success: !error,
          output: output || "(无输出)",
          error: error || undefined,
          variables,
        };
      } catch (err) {
        return {
          success: false,
          output: "",
          error: err instanceof Error ? err.message : "执行错误",
        };
      }
    },
    [initPyodide]
  );

  // Preload Pyodide (call when entering conversation mode)
  const preload = useCallback(() => {
    if (!globalPyodide && !loadingPromise) {
      initPyodide().catch(console.error);
    }
  }, [initPyodide]);

  // Cleanup on unmount is not needed since we use global instance

  return {
    isLoading,
    isReady,
    loadProgress,
    runCode,
    preload,
  };
}
