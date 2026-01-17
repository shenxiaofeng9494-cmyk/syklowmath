// Diagram IR (Intermediate Representation) for geometry diagrams
// Allows LLM to describe structure and constraints instead of calculating exact coordinates

export interface DiagramIR {
  type: "geometry";
  title?: string;

  // Canvas configuration
  canvas?: {
    gridStep?: number;    // Grid step size, default 40
    padding?: number;     // Canvas padding, default 80
  };

  // Nodes (points, labels)
  nodes: DiagramNode[];

  // Edges (line segments, arrows)
  edges?: DiagramEdge[];

  // Constraints (geometric relationships)
  constraints?: DiagramConstraint[];

  // Annotations (extra text, measurements)
  annotations?: DiagramAnnotation[];
}

// Node types
export interface DiagramNode {
  id: string;
  type: "point";
  label?: string;
  labelAnchor?: LabelAnchor;
}

export type LabelAnchor =
  | "top"
  | "bottom"
  | "left"
  | "right"
  | "topLeft"
  | "topRight"
  | "bottomLeft"
  | "bottomRight";

// Edge types
export interface DiagramEdge {
  type: "segment" | "ray" | "line" | "arc";
  from: string;   // Node ID
  to: string;     // Node ID
  style?: {
    strokeColor?: string;
    strokeWidth?: number;
    dashed?: boolean;
  };
}

// Constraint types - geometric relationships that determine layout
export type DiagramConstraint =
  | TriangleConstraint
  | IsoscelesConstraint
  | EquilateralConstraint
  | RightAngleConstraint
  | CircleConstraint
  | CircleThroughConstraint
  | ParallelConstraint
  | PerpendicularConstraint
  | MidpointConstraint
  | AngleBisectorConstraint
  | RectangleConstraint
  | SquareConstraint
  | ParallelogramConstraint;

export interface TriangleConstraint {
  type: "triangle";
  vertices: [string, string, string];
}

export interface IsoscelesConstraint {
  type: "isosceles";
  apex: string;
  base: [string, string];
}

export interface EquilateralConstraint {
  type: "equilateral";
  vertices: [string, string, string];
}

export interface RightAngleConstraint {
  type: "right_angle";
  vertex: string;
  rays: [string, string];
}

export interface CircleConstraint {
  type: "circle";
  center: string;
  radius: number;
}

export interface CircleThroughConstraint {
  type: "circle_through";
  center: string;
  point: string;
}

export interface ParallelConstraint {
  type: "parallel";
  line1: [string, string];
  line2: [string, string];
}

export interface PerpendicularConstraint {
  type: "perpendicular";
  line1: [string, string];
  line2: [string, string];
}

export interface MidpointConstraint {
  type: "midpoint";
  point: string;
  of: [string, string];
}

export interface AngleBisectorConstraint {
  type: "angle_bisector";
  vertex: string;
  rays: [string, string];
  bisector: string;
}

export interface RectangleConstraint {
  type: "rectangle";
  vertices: [string, string, string, string];
}

export interface SquareConstraint {
  type: "square";
  vertices: [string, string, string, string];
}

export interface ParallelogramConstraint {
  type: "parallelogram";
  vertices: [string, string, string, string];
}

// Annotation types
export interface DiagramAnnotation {
  type: "text" | "length" | "angle";
  text?: string;
  attachTo?: string;      // Node ID
  position?: { x: number; y: number };  // Absolute position
  offset?: [number, number];  // Relative to attachTo
  fontSize?: number;
}
