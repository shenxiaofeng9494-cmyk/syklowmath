/**
 * Drawing Layout Helper Functions
 *
 * Provides layout algorithms for flowcharts, mind maps, and other diagram types.
 * These functions help AI generate well-positioned shapes.
 */

import type { DrawingShape } from "@/components/drawing-canvas/TldrawCanvas";

// Canvas dimensions
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const PADDING = 50;

// Default shape sizes
const DEFAULT_NODE_WIDTH = 120;
const DEFAULT_NODE_HEIGHT = 60;
const DEFAULT_SPACING_X = 40;
const DEFAULT_SPACING_Y = 60;

export interface FlowchartNode {
  id: string;
  label: string;
  type: "start" | "end" | "process" | "decision";
  next?: string[];
}

export interface MindmapNode {
  id: string;
  label: string;
  children?: MindmapNode[];
}

export interface LayoutOptions {
  startX?: number;
  startY?: number;
  nodeWidth?: number;
  nodeHeight?: number;
  spacingX?: number;
  spacingY?: number;
}

/**
 * Calculate flowchart layout positions
 * Arranges nodes vertically with proper spacing
 */
export function calculateFlowchartLayout(
  nodes: FlowchartNode[],
  options: LayoutOptions = {}
): DrawingShape[] {
  const {
    startX = CANVAS_WIDTH / 2 - DEFAULT_NODE_WIDTH / 2,
    startY = PADDING,
    nodeWidth = DEFAULT_NODE_WIDTH,
    nodeHeight = DEFAULT_NODE_HEIGHT,
    spacingY = DEFAULT_SPACING_Y,
  } = options;

  const shapes: DrawingShape[] = [];
  let currentY = startY;

  for (const node of nodes) {
    // Determine shape type based on node type
    let shapeType: DrawingShape["type"];
    let color: string;

    switch (node.type) {
      case "start":
        shapeType = "ellipse";
        color = "green";
        break;
      case "end":
        shapeType = "ellipse";
        color = "red";
        break;
      case "decision":
        shapeType = "diamond";
        color = "orange";
        break;
      case "process":
      default:
        shapeType = "rectangle";
        color = "blue";
        break;
    }

    // Add the shape
    shapes.push({
      type: shapeType,
      x: startX,
      y: currentY,
      width: nodeWidth,
      height: node.type === "decision" ? nodeHeight * 1.2 : nodeHeight,
      color,
    });

    // Add label
    shapes.push({
      type: "text",
      x: startX + nodeWidth / 4,
      y: currentY + nodeHeight / 3,
      text: node.label,
      color: "black",
    });

    // Add arrow to next node (if not the last)
    const nextY = currentY + nodeHeight + spacingY;
    if (nodes.indexOf(node) < nodes.length - 1) {
      shapes.push({
        type: "arrow",
        x: startX + nodeWidth / 2,
        y: currentY + nodeHeight,
        width: 0,
        height: spacingY - 10,
        color: "black",
      });
    }

    currentY = nextY;
  }

  return shapes;
}

/**
 * Calculate mind map layout positions
 * Arranges nodes in a radial pattern around the center
 */
export function calculateMindmapLayout(
  root: MindmapNode,
  options: LayoutOptions = {}
): DrawingShape[] {
  const {
    startX = CANVAS_WIDTH / 2,
    startY = CANVAS_HEIGHT / 2,
    nodeWidth = DEFAULT_NODE_WIDTH,
    nodeHeight = DEFAULT_NODE_HEIGHT / 1.5,
    spacingX = DEFAULT_SPACING_X * 3,
    spacingY = DEFAULT_SPACING_Y,
  } = options;

  const shapes: DrawingShape[] = [];

  // Add center node
  const centerWidth = nodeWidth * 1.2;
  const centerHeight = nodeHeight * 1.3;
  shapes.push({
    type: "ellipse",
    x: startX - centerWidth / 2,
    y: startY - centerHeight / 2,
    width: centerWidth,
    height: centerHeight,
    color: "blue",
  });

  shapes.push({
    type: "text",
    x: startX - root.label.length * 6,
    y: startY - 8,
    text: root.label,
    color: "black",
  });

  // Add children in radial pattern
  const children = root.children || [];
  const childCount = children.length;

  if (childCount === 0) return shapes;

  // Calculate positions for children
  const angleStep = (2 * Math.PI) / childCount;
  const radius = spacingX + nodeWidth;

  children.forEach((child, index) => {
    const angle = -Math.PI / 2 + index * angleStep; // Start from top
    const childX = startX + Math.cos(angle) * radius;
    const childY = startY + Math.sin(angle) * radius;

    // Add connecting line
    shapes.push({
      type: "line",
      x: startX,
      y: startY,
      points: [
        { x: 0, y: 0 },
        { x: childX - startX, y: childY - startY },
      ],
      color: "grey",
    });

    // Add child node
    shapes.push({
      type: "rectangle",
      x: childX - nodeWidth / 2,
      y: childY - nodeHeight / 2,
      width: nodeWidth,
      height: nodeHeight,
      color: getColorByIndex(index),
    });

    // Add child label
    shapes.push({
      type: "text",
      x: childX - child.label.length * 5,
      y: childY - 6,
      text: child.label,
      color: "black",
    });
  });

  return shapes;
}

/**
 * Calculate grid layout positions
 * Arranges items in a grid pattern
 */
export function calculateGridLayout(
  items: Array<{ label: string; type?: DrawingShape["type"] }>,
  columns: number = 3,
  options: LayoutOptions = {}
): DrawingShape[] {
  const {
    startX = PADDING,
    startY = PADDING,
    nodeWidth = DEFAULT_NODE_WIDTH,
    nodeHeight = DEFAULT_NODE_HEIGHT,
    spacingX = DEFAULT_SPACING_X,
    spacingY = DEFAULT_SPACING_Y,
  } = options;

  const shapes: DrawingShape[] = [];

  items.forEach((item, index) => {
    const col = index % columns;
    const row = Math.floor(index / columns);

    const x = startX + col * (nodeWidth + spacingX);
    const y = startY + row * (nodeHeight + spacingY);

    shapes.push({
      type: item.type || "rectangle",
      x,
      y,
      width: nodeWidth,
      height: nodeHeight,
      color: "blue",
    });

    shapes.push({
      type: "text",
      x: x + nodeWidth / 4,
      y: y + nodeHeight / 3,
      text: item.label,
      color: "black",
    });
  });

  return shapes;
}

/**
 * Connect two shapes with an arrow
 * Calculates the best connection points
 */
export function connectShapes(
  from: { x: number; y: number; width: number; height: number },
  to: { x: number; y: number; width: number; height: number },
  options: { color?: string; curved?: boolean } = {}
): DrawingShape {
  const { color = "black" } = options;

  // Calculate center points
  const fromCenterX = from.x + from.width / 2;
  const fromCenterY = from.y + from.height / 2;
  const toCenterX = to.x + to.width / 2;
  const toCenterY = to.y + to.height / 2;

  // Determine connection direction
  const dx = toCenterX - fromCenterX;
  const dy = toCenterY - fromCenterY;

  // Calculate edge points
  let startX: number, startY: number, endX: number, endY: number;

  if (Math.abs(dx) > Math.abs(dy)) {
    // Horizontal connection
    if (dx > 0) {
      startX = from.x + from.width;
      endX = to.x;
    } else {
      startX = from.x;
      endX = to.x + to.width;
    }
    startY = fromCenterY;
    endY = toCenterY;
  } else {
    // Vertical connection
    if (dy > 0) {
      startY = from.y + from.height;
      endY = to.y;
    } else {
      startY = from.y;
      endY = to.y + to.height;
    }
    startX = fromCenterX;
    endX = toCenterX;
  }

  return {
    type: "arrow",
    x: startX,
    y: startY,
    width: endX - startX,
    height: endY - startY,
    color,
  };
}

/**
 * Get a color from a predefined palette based on index
 */
function getColorByIndex(index: number): string {
  const colors = [
    "green",
    "orange",
    "violet",
    "red",
    "blue",
    "light-green",
    "light-blue",
    "light-violet",
  ];
  return colors[index % colors.length];
}

/**
 * Calculate the bounding box of a set of shapes
 */
export function calculateBoundingBox(shapes: DrawingShape[]): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
} {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const shape of shapes) {
    minX = Math.min(minX, shape.x);
    minY = Math.min(minY, shape.y);
    maxX = Math.max(maxX, shape.x + (shape.width || 0));
    maxY = Math.max(maxY, shape.y + (shape.height || 0));
  }

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

/**
 * Center shapes on the canvas
 */
export function centerShapes(shapes: DrawingShape[]): DrawingShape[] {
  const bbox = calculateBoundingBox(shapes);
  const offsetX = (CANVAS_WIDTH - bbox.width) / 2 - bbox.minX;
  const offsetY = (CANVAS_HEIGHT - bbox.height) / 2 - bbox.minY;

  return shapes.map((shape) => ({
    ...shape,
    x: shape.x + offsetX,
    y: shape.y + offsetY,
    points: shape.points?.map((p) => ({ x: p.x, y: p.y })),
  }));
}
