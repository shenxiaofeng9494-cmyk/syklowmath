"use client";

import { useEffect, useState, useRef } from "react";
import type { DrawingData } from "@/types/excalidraw";

// Excalidraw API type (simplified for our use case)
interface ExcalidrawAPI {
  updateScene: (scene: { elements: unknown[] }) => void;
  scrollToContent: (elements: unknown[], options?: { fitToViewport?: boolean; viewportZoomFactor?: number }) => void;
}

interface ExcalidrawCanvasProps {
  drawingData: DrawingData | null;
  className?: string;
}

// Inner component that actually renders Excalidraw
function ExcalidrawCanvasInner({ drawingData, className }: ExcalidrawCanvasProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [ExcalidrawComponent, setExcalidrawComponent] = useState<React.ComponentType<any> | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [convertFn, setConvertFn] = useState<any>(null);
  const apiRef = useRef<ExcalidrawAPI | null>(null);
  const [isReady, setIsReady] = useState(false);

  // Dynamically import Excalidraw (client-side only)
  useEffect(() => {
    async function loadExcalidraw() {
      try {
        const excalidrawModule = await import("@excalidraw/excalidraw");
        console.log("Excalidraw loaded successfully");
        setExcalidrawComponent(() => excalidrawModule.Excalidraw);
        setConvertFn(() => excalidrawModule.convertToExcalidrawElements);
        setIsReady(true);
      } catch (error) {
        console.error("Failed to load Excalidraw:", error);
      }
    }
    loadExcalidraw();
  }, []);

  // Update scene when drawingData changes
  useEffect(() => {
    if (!apiRef.current || !drawingData || !convertFn || !isReady) return;

    try {
      console.log("Drawing data received:", drawingData);
      console.log("Elements to convert:", drawingData.elements);
      const elements = convertFn(drawingData.elements);
      console.log("Converted elements:", elements);
      apiRef.current.updateScene({ elements });
      // Auto-fit to viewport
      setTimeout(() => {
        apiRef.current?.scrollToContent(elements, {
          fitToViewport: true,
          viewportZoomFactor: 0.9,
        });
      }, 100);
    } catch (error) {
      console.error("Failed to update Excalidraw scene:", error);
    }
  }, [drawingData, convertFn, isReady]);

  // Loading state
  if (!ExcalidrawComponent || !isReady) {
    return (
      <div className={`flex items-center justify-center bg-white ${className}`}>
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
          <span className="text-gray-500">加载画板中...</span>
        </div>
      </div>
    );
  }

  // Prepare initial elements
  let initialElements: unknown[] = [];
  if (drawingData && convertFn) {
    try {
      console.log("Preparing initial elements from:", drawingData.elements);
      initialElements = convertFn(drawingData.elements);
      console.log("Initial elements prepared:", initialElements);
    } catch (error) {
      console.error("Failed to convert initial elements:", error);
    }
  }

  return (
    <div className={`relative ${className}`} style={{ minHeight: "400px" }}>
      {/* Title overlay */}
      {drawingData?.title && (
        <div className="absolute top-4 left-4 z-10 bg-black/60 text-white px-4 py-2 rounded-lg font-medium">
          {drawingData.title}
        </div>
      )}

      {/* Excalidraw canvas - needs explicit height */}
      <div className="absolute inset-0">
          <ExcalidrawComponent
          excalidrawAPI={(api: ExcalidrawAPI) => {
            apiRef.current = api;
            console.log("Excalidraw API ready");
            // Auto-fit on initial load
            if (initialElements.length > 0) {
              setTimeout(() => {
                api.scrollToContent(initialElements, {
                  fitToViewport: true,
                  viewportZoomFactor: 0.9,
                });
              }, 100);
            }
          }}
          initialData={{ elements: initialElements }}
          viewModeEnabled={true}
          zenModeEnabled={true}
          theme="light"
          UIOptions={{
            canvasActions: {
              export: false,
              loadScene: false,
              saveToActiveFile: false,
              toggleTheme: false,
            },
            tools: {
              image: false,
            },
          }}
        />
      </div>
    </div>
  );
}

// Export with dynamic import wrapper for Next.js SSR compatibility
import dynamic from "next/dynamic";

export const ExcalidrawCanvas = dynamic(
  () => Promise.resolve(ExcalidrawCanvasInner),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-full bg-white">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
          <span className="text-gray-500">加载画板中...</span>
        </div>
      </div>
    ),
  }
);
