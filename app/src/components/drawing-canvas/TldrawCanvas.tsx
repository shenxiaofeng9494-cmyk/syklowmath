"use client";

import { useRef, useImperativeHandle, forwardRef, useCallback } from "react";
import {
  Tldraw,
  Editor,
  TLShapeId,
  createShapeId,
  DefaultColorStyle,
  getIndexAbove,
  IndexKey,
  toRichText,
} from "tldraw";
import { b64Vecs } from "@tldraw/tlschema";
import "tldraw/tldraw.css";

// Shape types supported by the drawing board
export type DrawingShapeType =
  // Basic geo shapes
  | "rectangle"
  | "ellipse"
  | "triangle"
  | "diamond"
  // Polygons
  | "pentagon"
  | "hexagon"
  | "octagon"
  // Special shapes
  | "star"
  | "rhombus"
  | "rhombus-2"
  | "oval"
  | "trapezoid"
  // Directional arrows
  | "arrow-right"
  | "arrow-left"
  | "arrow-up"
  | "arrow-down"
  // Checkbox shapes
  | "x-box"
  | "check-box"
  // Decorative shapes
  | "cloud"
  | "heart"
  // Original types
  | "line"
  | "arrow"
  | "text"
  | "freehand";

// Shape definition for AI drawing commands
export interface DrawingShape {
  type: DrawingShapeType;
  x: number;
  y: number;
  width?: number;
  height?: number;
  points?: Array<{ x: number; y: number }>;
  text?: string;
  color?: string;
}

// API exposed to parent components
export interface TldrawCanvasHandle {
  drawShapes: (shapes: DrawingShape[]) => void;
  clear: () => void;
  getEditor: () => Editor | null;
}

interface TldrawCanvasProps {
  darkMode?: boolean;
}

// Map color names to tldraw color values
const colorMap: Record<string, (typeof DefaultColorStyle.values)[number]> = {
  red: "red",
  blue: "blue",
  green: "green",
  yellow: "yellow",
  orange: "orange",
  violet: "violet",
  black: "black",
  white: "white",
  grey: "grey",
  "light-red": "light-red",
  "light-blue": "light-blue",
  "light-green": "light-green",
  "light-violet": "light-violet",
};

function getTldrawColor(
  color?: string
): (typeof DefaultColorStyle.values)[number] {
  if (!color) return "black";
  const lowerColor = color.toLowerCase();
  return colorMap[lowerColor] || "black";
}

export const TldrawCanvas = forwardRef<TldrawCanvasHandle, TldrawCanvasProps>(
  function TldrawCanvas({ darkMode = true }, ref) {
    const editorRef = useRef<Editor | null>(null);

    // Draw shapes programmatically
    const drawShapes = useCallback((shapes: DrawingShape[]) => {
      const editor = editorRef.current;
      if (!editor) {
        console.warn("TldrawCanvas: Editor not ready");
        return;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tldrawShapes: any[] = [];

      for (const shape of shapes) {
        const id: TLShapeId = createShapeId();
        const color = getTldrawColor(shape.color);

        switch (shape.type) {
          case "rectangle":
            tldrawShapes.push({
              id,
              type: "geo",
              x: shape.x,
              y: shape.y,
              props: {
                geo: "rectangle",
                w: shape.width ?? 100,
                h: shape.height ?? 100,
                color,
              },
            });
            break;

          case "ellipse":
            tldrawShapes.push({
              id,
              type: "geo",
              x: shape.x,
              y: shape.y,
              props: {
                geo: "ellipse",
                w: shape.width ?? 100,
                h: shape.height ?? 100,
                color,
              },
            });
            break;

          // All tldraw geo shapes
          case "triangle":
          case "diamond":
          case "pentagon":
          case "hexagon":
          case "octagon":
          case "star":
          case "rhombus":
          case "rhombus-2":
          case "oval":
          case "trapezoid":
          case "arrow-right":
          case "arrow-left":
          case "arrow-up":
          case "arrow-down":
          case "x-box":
          case "check-box":
          case "cloud":
          case "heart":
            tldrawShapes.push({
              id,
              type: "geo",
              x: shape.x,
              y: shape.y,
              props: {
                geo: shape.type,
                w: shape.width ?? 100,
                h: shape.height ?? 100,
                color,
              },
            });
            break;

          case "line":
            if (shape.points && shape.points.length >= 2) {
              // Generate proper index keys for tldraw line points
              const pointsObj: Record<string, { id: string; index: IndexKey; x: number; y: number }> = {};
              let lastIndex: IndexKey = "a1" as IndexKey;

              shape.points.forEach((pt, idx) => {
                const pointId = `p${idx}`;
                if (idx === 0) {
                  lastIndex = "a1" as IndexKey;
                } else {
                  lastIndex = getIndexAbove(lastIndex);
                }
                pointsObj[pointId] = { id: pointId, index: lastIndex, x: pt.x, y: pt.y };
              });

              tldrawShapes.push({
                id,
                type: "line",
                x: shape.x,
                y: shape.y,
                props: {
                  color,
                  points: pointsObj,
                },
              });
            }
            break;

          case "arrow":
            tldrawShapes.push({
              id,
              type: "arrow",
              x: shape.x,
              y: shape.y,
              props: {
                color,
                start: { x: 0, y: 0 },
                end: { x: shape.width ?? 100, y: shape.height ?? 0 },
              },
            });
            break;

          case "text":
            tldrawShapes.push({
              id,
              type: "text",
              x: shape.x,
              y: shape.y,
              props: {
                richText: toRichText(shape.text || ""),
                color,
                size: "m",
              },
            });
            break;

          case "freehand":
            if (shape.points && shape.points.length >= 2) {
              // Convert points to VecModel format with z coordinate
              const vecPoints = shape.points.map((pt) => ({
                x: pt.x,
                y: pt.y,
                z: 0.5,
              }));
              // Encode points to base64 path format required by tldraw 4.x
              const path = b64Vecs.encodePoints(vecPoints);

              tldrawShapes.push({
                id,
                type: "draw",
                x: shape.x,
                y: shape.y,
                props: {
                  color,
                  segments: [
                    {
                      type: "free",
                      path,
                    },
                  ],
                },
              });
            }
            break;
        }
      }

      if (tldrawShapes.length > 0) {
        editor.createShapes(tldrawShapes);
      }
    }, []);

    // Clear all shapes
    const clear = useCallback(() => {
      const editor = editorRef.current;
      if (!editor) return;

      const allShapeIds = editor.getCurrentPageShapeIds();
      if (allShapeIds.size > 0) {
        editor.deleteShapes([...allShapeIds]);
      }
    }, []);

    // Expose API to parent
    useImperativeHandle(
      ref,
      () => ({
        drawShapes,
        clear,
        getEditor: () => editorRef.current,
      }),
      [drawShapes, clear]
    );

    const handleMount = useCallback((editor: Editor) => {
      editorRef.current = editor;
    }, []);

    return (
      <div className="w-full h-full">
        <Tldraw
          onMount={handleMount}
          forceMobile={false}
          inferDarkMode={darkMode}
        />
      </div>
    );
  }
);

TldrawCanvas.displayName = "TldrawCanvas";
