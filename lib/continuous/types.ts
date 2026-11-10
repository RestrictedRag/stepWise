// Continuous Whiteboard Animation Engine - Core Schema & Types
// Pure timeline, additive element lifecycle, static world layout, and deterministic keyframed camera.

export type ColorToken = "default" | "accent" | "muted" | "warn" | "success";

export type SizeToken = "sm" | "md" | "lg";

export type ShapeType = "rect" | "circle" | "ellipse";

export type RelativePosition =
  | "above"
  | "above-left"
  | "above-right"
  | "below"
  | "below-aligned-eq" // Aligns vertically matching the '=' sign of referenced latex element
  | "left"
  | "right"
  | "inside";

export type PlacementSpec =
  | {
      type: "root";
      x?: number; // Optional explicit initial root x; defaults to 500
      y?: number; // Optional explicit initial root y; defaults to 200 or below prior max Y
    }
  | {
      type: "relative";
      relativeTo: string; // Must match an element ID already introduced in an earlier DRAW op
      position: RelativePosition;
      offset?: SizeToken; // Spacing token: sm (16px), md (32px), lg (56px)
    };

export interface BaseElement {
  id: string;
  color?: ColorToken;
}

export interface ShapeElement extends BaseElement {
  type: "shape";
  shapeType: ShapeType;
  size: SizeToken;
  placement: PlacementSpec;
  label?: string;
}

export interface TextElement extends BaseElement {
  type: "text";
  text: string;
  size: SizeToken;
  placement: PlacementSpec;
}

export interface LatexElement extends BaseElement {
  type: "latex";
  math: string;
  size: SizeToken;
  placement: PlacementSpec;
}

export interface ConnectorElement extends BaseElement {
  type: "connector";
  from: string; // ID of source element (must exist)
  to: string;   // ID of target element (must exist)
  label?: string;
  style?: "solid" | "dashed";
}

export type CanvasElement = ShapeElement | TextElement | LatexElement | ConnectorElement;

export type TimelineOp =
  | { op: "DRAW"; element: CanvasElement; anchor: string; durationMs?: number }
  | { op: "POINT"; targetId: string; anchor: string; durationMs?: number }
  | { op: "CIRCLE"; targetId: string; anchor: string; color?: ColorToken }
  | { op: "UNDERLINE"; targetId: string; anchor: string; color?: ColorToken }
  | { op: "STRIKE"; targetId: string; anchor: string }
  | { op: "DIM"; targetIds: string[]; anchor: string }
  | { op: "RESTORE"; targetIds: string[]; anchor: string }
  | { op: "ERASE"; targetIds: string[]; anchor: string };

export interface ContinuousStep {
  id: string;
  narration: string; // Contains [tag] markers, e.g. "The plant's leaf [leaf] absorbs sunlight [sun]..."
  ops: TimelineOp[];
}

export interface ContinuousLesson {
  id: string;
  topic: string;
  steps: ContinuousStep[];
}

// -----------------------------------------------------------------------------
// Layout & Measurement Contracts (Pure compile-time world representation)
// -----------------------------------------------------------------------------

export interface ElementDimensions {
  width: number;
  height: number;
  eqRelX?: number; // Measured relative X offset to '=' character in math formula
}

export interface Point2D {
  x: number;
  y: number;
}

export interface Rect2D {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SolvedElement {
  id: string;
  x: number; // Center X
  y: number; // Center Y
  width: number;
  height: number;
  bounds: Rect2D; // Bounding box: { x: minX, y: minY, width, height }
  element: Exclude<CanvasElement, ConnectorElement>;
}

export interface SolvedConnector {
  id: string;
  fromId: string;
  toId: string;
  fromPoint: Point2D;
  toPoint: Point2D;
  label?: string;
  color?: ColorToken;
  style?: "solid" | "dashed";
  element: ConnectorElement;
}

export interface SolvedLayout {
  elements: Map<string, SolvedElement>;
  connectors: Map<string, SolvedConnector>;
  bounds: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    width: number;
    height: number;
  };
}

// -----------------------------------------------------------------------------
// Playback Engine State Contracts (Pure function of global time t)
// -----------------------------------------------------------------------------

export type ElementVisualState = "drawn" | "dimmed" | "restored" | "erased";

export interface ResolvedRenderElement {
  id: string;
  state: ElementVisualState;
  opacity: number;       // Interpolated 0..1 (250ms ease)
  drawProgress: number;  // 0..1 stroke reveal progress during initial DRAW
  solved: SolvedElement;
}

export interface ResolvedRenderConnector {
  id: string;
  state: ElementVisualState;
  opacity: number;
  drawProgress: number;
  solved: SolvedConnector;
}

export interface ActiveAnnotation {
  id: string;
  type: "CIRCLE" | "UNDERLINE" | "STRIKE" | "POINT";
  targetId: string;
  color?: ColorToken;
  progress: number; // 0..1
  bounds: Rect2D;
  pointCoord?: Point2D; // For pointing hand / stylus tip
}

export interface CameraKeyframe {
  tMs: number;
  cx: number;
  cy: number;
  zoom: number;
}

export interface CameraTransform {
  cx: number;
  cy: number;
  zoom: number;
}

export interface ContinuousPlaybackState {
  tMs: number;
  camera: CameraTransform;
  elements: ResolvedRenderElement[];
  connectors: ResolvedRenderConnector[];
  annotations: ActiveAnnotation[];
}

