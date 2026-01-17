// Geometry Renderer - converts Diagram IR to Excalidraw elements
import { DiagramIR, DiagramNode, DiagramEdge, DiagramConstraint, DiagramAnnotation } from "@/types/diagram-ir";
import { ExcalidrawElementSkeleton } from "@/types/excalidraw";

interface RenderResult {
  elements: ExcalidrawElementSkeleton[];
  nodePositions: Map<string, { x: number; y: number }>;
}

// Default canvas configuration
const DEFAULT_CANVAS = {
  gridStep: 40,
  padding: 80,
  width: 600,
  height: 400,
  centerX: 300,
  centerY: 200,
};

interface CanvasConfig {
  gridStep?: number;
  padding?: number;
  centerX?: number;
  centerY?: number;
}

/**
 * Main entry point: renders Diagram IR to Excalidraw elements
 */
export function renderDiagramIR(ir: DiagramIR): RenderResult {
  // Merge user canvas config with defaults
  const canvas = {
    ...DEFAULT_CANVAS,
    ...(ir.canvas || {}),
  };

  const elements: ExcalidrawElementSkeleton[] = [];
  const nodePositions = new Map<string, { x: number; y: number }>();

  // 1. Calculate node positions based on constraints
  calculateNodePositions(ir, nodePositions, canvas);

  // 2. Render edges (line segments)
  for (const edge of ir.edges || []) {
    const edgeElements = renderEdge(edge, nodePositions);
    elements.push(...edgeElements);
  }

  // 3. Render node labels
  for (const node of ir.nodes) {
    if (node.label) {
      const labelElement = renderNodeLabel(node, nodePositions);
      if (labelElement) elements.push(labelElement);
    }
  }

  // 4. Render annotations
  for (const annotation of ir.annotations || []) {
    const annotationElement = renderAnnotation(annotation, nodePositions);
    if (annotationElement) elements.push(annotationElement);
  }

  return { elements, nodePositions };
}

/**
 * Calculate positions for all nodes based on geometric constraints
 */
function calculateNodePositions(
  ir: DiagramIR,
  positions: Map<string, { x: number; y: number }>,
  canvas: typeof DEFAULT_CANVAS
) {
  // Process each constraint
  for (const constraint of ir.constraints || []) {
    switch (constraint.type) {
      case "triangle":
        calculateTriangle(constraint.vertices, positions, canvas);
        break;
      case "isosceles":
        calculateIsoscelesTriangle(constraint, positions, canvas);
        break;
      case "equilateral":
        calculateEquilateralTriangle(constraint, positions, canvas);
        break;
      case "right_angle":
        calculateRightAngle(constraint, positions, canvas);
        break;
      case "circle":
      case "circle_through":
        calculateCircle(constraint, positions, canvas);
        break;
      case "rectangle":
      case "square":
      case "parallelogram":
        calculateQuadrilateral(constraint, positions, canvas);
        break;
      // Add more constraint types as needed
    }
  }
}

/**
 * Calculate positions for a regular triangle
 */
function calculateTriangle(
  vertices: [string, string, string],
  positions: Map<string, { x: number; y: number }>,
  canvas: typeof DEFAULT_CANVAS
) {
  const [a, b, c] = vertices;

  // Default triangle layout: base at bottom, apex at top
  positions.set(a, {
    x: roundToGrid(canvas.centerX - 100, canvas.gridStep),
    y: roundToGrid(canvas.centerY + 80, canvas.gridStep),
  });
  positions.set(b, {
    x: roundToGrid(canvas.centerX + 100, canvas.gridStep),
    y: roundToGrid(canvas.centerY + 80, canvas.gridStep),
  });
  positions.set(c, {
    x: roundToGrid(canvas.centerX, canvas.gridStep),
    y: roundToGrid(canvas.centerY - 80, canvas.gridStep),
  });
}

/**
 * Calculate positions for an isosceles triangle
 */
function calculateIsoscelesTriangle(
  constraint: { type: "isosceles"; apex: string; base: [string, string] },
  positions: Map<string, { x: number; y: number }>,
  canvas: typeof DEFAULT_CANVAS
) {
  const [baseLeft, baseRight] = constraint.base;
  const apex = constraint.apex;

  // Base width and height
  const baseWidth = 200;
  const height = 150;

  // Base center at canvas center, slightly below
  const baseCenterX = canvas.centerX;
  const baseCenterY = canvas.centerY + height / 3;

  // Set three vertices
  positions.set(baseLeft, {
    x: roundToGrid(baseCenterX - baseWidth / 2, canvas.gridStep),
    y: roundToGrid(baseCenterY, canvas.gridStep),
  });
  positions.set(baseRight, {
    x: roundToGrid(baseCenterX + baseWidth / 2, canvas.gridStep),
    y: roundToGrid(baseCenterY, canvas.gridStep),
  });
  positions.set(apex, {
    x: roundToGrid(baseCenterX, canvas.gridStep),
    y: roundToGrid(baseCenterY - height, canvas.gridStep),
  });
}

/**
 * Calculate positions for an equilateral triangle
 */
function calculateEquilateralTriangle(
  constraint: { type: "equilateral"; vertices: [string, string, string] },
  positions: Map<string, { x: number; y: number }>,
  canvas: typeof DEFAULT_CANVAS
) {
  const [a, b, c] = constraint.vertices;
  const sideLength = 180;
  const height = (sideLength * Math.sqrt(3)) / 2;

  const baseCenterX = canvas.centerX;
  const baseCenterY = canvas.centerY + height / 3;

  positions.set(a, {
    x: roundToGrid(baseCenterX - sideLength / 2, canvas.gridStep),
    y: roundToGrid(baseCenterY, canvas.gridStep),
  });
  positions.set(b, {
    x: roundToGrid(baseCenterX + sideLength / 2, canvas.gridStep),
    y: roundToGrid(baseCenterY, canvas.gridStep),
  });
  positions.set(c, {
    x: roundToGrid(baseCenterX, canvas.gridStep),
    y: roundToGrid(baseCenterY - height, canvas.gridStep),
  });
}

/**
 * Calculate positions for a right angle
 */
function calculateRightAngle(
  constraint: { type: "right_angle"; vertex: string; rays: [string, string] },
  positions: Map<string, { x: number; y: number }>,
  canvas: typeof DEFAULT_CANVAS
) {
  const { vertex, rays } = constraint;
  const [ray1End, ray2End] = rays;

  // Right angle vertex
  positions.set(vertex, {
    x: roundToGrid(canvas.centerX - 80, canvas.gridStep),
    y: roundToGrid(canvas.centerY + 80, canvas.gridStep),
  });

  // Horizontal ray endpoint
  positions.set(ray1End, {
    x: roundToGrid(canvas.centerX + 120, canvas.gridStep),
    y: roundToGrid(canvas.centerY + 80, canvas.gridStep),
  });

  // Vertical ray endpoint
  positions.set(ray2End, {
    x: roundToGrid(canvas.centerX - 80, canvas.gridStep),
    y: roundToGrid(canvas.centerY - 100, canvas.gridStep),
  });
}

/**
 * Calculate positions for a circle
 */
function calculateCircle(
  constraint: { type: "circle" | "circle_through"; center: string; radius?: number; point?: string },
  positions: Map<string, { x: number; y: number }>,
  canvas: typeof DEFAULT_CANVAS
) {
  positions.set(constraint.center, {
    x: canvas.centerX,
    y: canvas.centerY,
  });
  // Circle will be rendered separately as an ellipse element
}

/**
 * Calculate positions for quadrilaterals (rectangle, square, parallelogram)
 */
function calculateQuadrilateral(
  constraint: { type: string; vertices: [string, string, string, string] },
  positions: Map<string, { x: number; y: number }>,
  canvas: typeof DEFAULT_CANVAS
) {
  const [a, b, c, d] = constraint.vertices;

  if (constraint.type === "rectangle" || constraint.type === "square") {
    const size = constraint.type === "square" ? 160 : 200;
    const height = constraint.type === "square" ? 160 : 120;

    positions.set(a, { x: canvas.centerX - size / 2, y: canvas.centerY + height / 2 });
    positions.set(b, { x: canvas.centerX + size / 2, y: canvas.centerY + height / 2 });
    positions.set(c, { x: canvas.centerX + size / 2, y: canvas.centerY - height / 2 });
    positions.set(d, { x: canvas.centerX - size / 2, y: canvas.centerY - height / 2 });
  } else if (constraint.type === "parallelogram") {
    const offset = 40;
    positions.set(a, { x: canvas.centerX - 100, y: canvas.centerY + 60 });
    positions.set(b, { x: canvas.centerX + 100, y: canvas.centerY + 60 });
    positions.set(c, { x: canvas.centerX + 100 + offset, y: canvas.centerY - 60 });
    positions.set(d, { x: canvas.centerX - 100 + offset, y: canvas.centerY - 60 });
  }
}

/**
 * Render an edge (line segment) as individual line elements
 */
function renderEdge(
  edge: DiagramEdge,
  positions: Map<string, { x: number; y: number }>
): ExcalidrawElementSkeleton[] {
  const from = positions.get(edge.from);
  const to = positions.get(edge.to);

  if (!from || !to) return [];

  return [{
    type: "line",
    x: from.x,
    y: from.y,
    points: [[0, 0], [to.x - from.x, to.y - from.y]],
    strokeColor: edge.style?.strokeColor || "#1e40af",
    strokeWidth: edge.style?.strokeWidth || 2,
    strokeStyle: edge.style?.dashed ? "dashed" : "solid",
  }];
}

/**
 * Render a node label (text element)
 */
function renderNodeLabel(
  node: DiagramNode,
  positions: Map<string, { x: number; y: number }>
): ExcalidrawElementSkeleton | null {
  const pos = positions.get(node.id);
  if (!pos || !node.label) return null;

  // Calculate label offset based on anchor
  const offset = getLabelOffset(node.labelAnchor || "bottomLeft");

  return {
    type: "text",
    x: pos.x + offset.x,
    y: pos.y + offset.y,
    text: node.label,
    fontSize: 20,
  };
}

/**
 * Get label offset based on anchor position
 */
function getLabelOffset(anchor: string): { x: number; y: number } {
  const offsets: Record<string, { x: number; y: number }> = {
    top: { x: -8, y: -30 },
    bottom: { x: -8, y: 15 },
    left: { x: -25, y: -10 },
    right: { x: 15, y: -10 },
    topLeft: { x: -25, y: -25 },
    topRight: { x: 15, y: -25 },
    bottomLeft: { x: -25, y: 15 },
    bottomRight: { x: 15, y: 15 },
  };
  return offsets[anchor] || offsets.bottomLeft;
}

/**
 * Render an annotation (text, length, angle)
 */
function renderAnnotation(
  annotation: DiagramAnnotation,
  positions: Map<string, { x: number; y: number }>
): ExcalidrawElementSkeleton | null {
  if (annotation.type === "text" && annotation.text) {
    let x = annotation.position?.x || 0;
    let y = annotation.position?.y || 0;

    if (annotation.attachTo) {
      const attachPos = positions.get(annotation.attachTo);
      if (attachPos && annotation.offset) {
        x = attachPos.x + annotation.offset[0];
        y = attachPos.y + annotation.offset[1];
      }
    }

    return {
      type: "text",
      x,
      y,
      text: annotation.text,
      fontSize: annotation.fontSize || 18,
    };
  }
  return null;
}

/**
 * Round a value to the nearest grid step
 */
function roundToGrid(value: number, gridStep: number): number {
  return Math.round(value / gridStep) * gridStep;
}
