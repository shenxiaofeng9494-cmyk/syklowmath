// Excalidraw element skeleton types for AI-generated drawings
export interface ExcalidrawElementSkeleton {
  type: "rectangle" | "ellipse" | "diamond" | "line" | "arrow" | "text";
  x: number;
  y: number;
  width?: number;
  height?: number;
  // For line/arrow: array of [x, y] offsets from origin
  points?: Array<[number, number]>;
  // For text elements
  text?: string;
  fontSize?: number;
  // Styling
  strokeColor?: string;
  backgroundColor?: string;
  fillStyle?: "hachure" | "solid" | "cross-hatch";
  strokeWidth?: number;
  // Label inside shapes (rectangle, ellipse, diamond)
  label?: { text: string };
}

export interface DrawingData {
  elements: ExcalidrawElementSkeleton[];
  title?: string;
}

export type ViewType = "video" | "drawing" | "code";

// Code demo data for IDE view
export interface CodeDemoData {
  code: string;
  language?: string;
  title?: string;
  explanation?: string;
}

// Execution result for bidirectional communication
export interface CodeExecutionResult {
  success: boolean;
  output: string;
  error?: string;
  variables?: Record<string, string>;
}
