// Deterministic Spatial Layout Engine for 1000x700 Virtual Canvas
// Direction-aware (LTR/RTL), blueprint-contained, and resolves semantic objects into exact Shape coordinates.

import type { Shape, Pt } from "../board.ts";
import type {
  SemanticObject,
  Color,
  CardinalPort,
  MacroBlueprint,
  DockingEndpoint,
} from "../manifest.ts";
import { isRTL } from "../languages.ts";

export interface AABB {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface BlueprintSlot {
  id: string;
  rect: { x: number; y: number; w: number; h: number };
  capacity: number;
  layout: "stack-v" | "stack-h" | "grid" | "center";
}

// Fixed slot rectangles within invariant 1000x700 viewport
export const BLUEPRINT_SLOTS: Record<MacroBlueprint, BlueprintSlot[]> = {
  process_flow: [
    { id: "banner", rect: { x: 100, y: 30, w: 800, h: 70 }, capacity: 1, layout: "center" },
    { id: "inputs", rect: { x: 40, y: 130, w: 230, h: 500 }, capacity: 3, layout: "stack-v" },
    { id: "core_subject", rect: { x: 310, y: 130, w: 380, h: 500 }, capacity: 1, layout: "center" },
    { id: "outputs", rect: { x: 730, y: 130, w: 230, h: 500 }, capacity: 3, layout: "stack-v" },
  ],
  anatomy_structure: [
    { id: "banner", rect: { x: 100, y: 30, w: 800, h: 70 }, capacity: 1, layout: "center" },
    { id: "left_callouts", rect: { x: 40, y: 130, w: 210, h: 520 }, capacity: 4, layout: "stack-v" },
    { id: "core_subject", rect: { x: 270, y: 130, w: 460, h: 520 }, capacity: 1, layout: "center" },
    { id: "right_callouts", rect: { x: 750, y: 130, w: 210, h: 520 }, capacity: 4, layout: "stack-v" },
  ],
  mathematical_derivation: [
    { id: "banner", rect: { x: 100, y: 30, w: 800, h: 60 }, capacity: 1, layout: "center" },
    { id: "vertical_steps", rect: { x: 100, y: 110, w: 500, h: 550 }, capacity: 5, layout: "stack-v" },
    { id: "justifications", rect: { x: 630, y: 110, w: 330, h: 550 }, capacity: 5, layout: "stack-v" },
  ],
  comparison: [
    { id: "banner", rect: { x: 100, y: 30, w: 800, h: 60 }, capacity: 1, layout: "center" },
    { id: "split_left", rect: { x: 40, y: 110, w: 430, h: 550 }, capacity: 4, layout: "stack-v" },
    { id: "split_right", rect: { x: 530, y: 110, w: 430, h: 550 }, capacity: 4, layout: "stack-v" },
  ],
  cycle: [
    { id: "banner", rect: { x: 100, y: 30, w: 800, h: 60 }, capacity: 1, layout: "center" },
    { id: "central_concept", rect: { x: 370, y: 220, w: 260, h: 260 }, capacity: 1, layout: "center" },
    { id: "cycle_nodes", rect: { x: 80, y: 110, w: 840, h: 540 }, capacity: 6, layout: "grid" },
  ],
  freeform: [
    { id: "canvas", rect: { x: 40, y: 40, w: 920, h: 620 }, capacity: 20, layout: "grid" },
  ],
};

export interface LayoutContext {
  language: string;
  labels: Record<string, string>;
  occupiedBoxes: AABB[];
  drawnElements: Map<string, { shape: Shape; aabb: AABB }>;
  sceneBlueprint?: MacroBlueprint;
  slotAssignments?: Map<string, string>;
  slotElementCounts?: Map<string, number>;
  portDockingCounts?: Map<string, number>;
  portDockingIndex?: Map<string, number>;
}

// Ray unit vectors for cardinal/ordinal ports (Y points down)
export const PORT_VECTORS: Record<CardinalPort, Pt> = {
  N: [0, -1],
  NE: [Math.SQRT1_2, -Math.SQRT1_2],
  E: [1, 0],
  SE: [Math.SQRT1_2, Math.SQRT1_2],
  S: [0, 1],
  SW: [-Math.SQRT1_2, Math.SQRT1_2],
  W: [-1, 0],
  NW: [-Math.SQRT1_2, -Math.SQRT1_2],
};

export class LayoutEngine {
  private width = 1000;
  private height = 700;
  private endpointCache: Map<string, Pt> = new Map();

  public clearCache() {
    this.endpointCache.clear();
  }

  // Resolves a semantic object to an exact Shape inside the 1000x700 viewport
  public resolveObject(
    id: string,
    semanticObj: SemanticObject,
    color: Color,
    ctx: LayoutContext
  ): Shape {
    const rtl = isRTL(ctx.language);

    // Ensure context maps exist
    if (!ctx.slotAssignments) ctx.slotAssignments = new Map();
    if (!ctx.slotElementCounts) ctx.slotElementCounts = new Map();
    if (!ctx.portDockingCounts) ctx.portDockingCounts = new Map();
    if (!ctx.portDockingIndex) ctx.portDockingIndex = new Map();

    const bp = ctx.sceneBlueprint || "freeform";
    const slotId = semanticObj.slotId || this.inferSlotId(semanticObj, bp, rtl);
    ctx.slotAssignments.set(id, slotId);

    const slotCount = ctx.slotElementCounts.get(slotId) || 0;
    ctx.slotElementCounts.set(slotId, slotCount + 1);

    const slotRect = this.calculateSlotItemRect(bp, slotId, slotCount);

    switch (semanticObj.type) {
      case "circle": {
        const r =
          semanticObj.size === "sm" ? 45 : semanticObj.size === "lg" ? 130 : 80;
        let x = slotRect.x + slotRect.w / 2;
        let y = slotRect.y + slotRect.h / 2;

        // Legacy zone support if no specific blueprint slot
        if (!semanticObj.slotId && bp === "freeform") {
          x = 500;
          y = 350;
          if (semanticObj.zone === "left") x = rtl ? 650 : 350;
          else if (semanticObj.zone === "right") x = rtl ? 350 : 650;
        }

        const aabb: AABB = { id, x1: x - r, y1: y - r, x2: x + r, y2: y + r };
        ctx.occupiedBoxes.push(aabb);

        const shape: Shape = { type: "circle", x, y, r, color };
        ctx.drawnElements.set(id, { shape, aabb });
        return shape;
      }

      case "rect": {
        const w =
          semanticObj.size === "sm" ? 140 : semanticObj.size === "lg" ? 360 : 240;
        const h =
          semanticObj.size === "sm" ? 90 : semanticObj.size === "lg" ? 220 : 150;
        let x = slotRect.x + (slotRect.w - w) / 2;
        let y = slotRect.y + (slotRect.h - h) / 2;

        if (!semanticObj.slotId && bp === "freeform") {
          x = 500 - w / 2;
          y = 350 - h / 2;
          if (semanticObj.zone === "left") x = (rtl ? 650 : 350) - w / 2;
          else if (semanticObj.zone === "right") x = (rtl ? 350 : 650) - w / 2;
        }

        const aabb: AABB = { id, x1: x, y1: y, x2: x + w, y2: y + h };
        ctx.occupiedBoxes.push(aabb);

        const shape: Shape = { type: "rect", x, y, w, h, color };
        ctx.drawnElements.set(id, { shape, aabb });
        return shape;
      }

      case "number_line": {
        const min = semanticObj.min;
        const max = semanticObj.max;
        const lineX1 = 150;
        const lineX2 = 850;
        const lineY = 380;
        const span = Math.max(1, max - min);
        const step = semanticObj.step || 1;

        let d = `M ${lineX1} ${lineY} L ${lineX2} ${lineY}`;
        const tickCount = Math.min(20, Math.floor(span / step));

        for (let i = 0; i <= tickCount; i++) {
          const val = min + i * step;
          const tx = lineX1 + ((val - min) / span) * (lineX2 - lineX1);
          d += ` M ${tx} ${lineY - 10} L ${tx} ${lineY + 10}`;
        }

        const aabb: AABB = { id, x1: lineX1 - 20, y1: lineY - 20, x2: lineX2 + 20, y2: lineY + 30 };
        ctx.occupiedBoxes.push(aabb);

        const shape: Shape = { type: "path", d, color };
        ctx.drawnElements.set(id, { shape, aabb });
        return shape;
      }

      case "triangle": {
        let p1: Pt = [350, 480];
        let p2: Pt = [650, 480];
        let p3: Pt = [350, 260];

        if (semanticObj.kind === "equilateral") {
          p1 = [350, 480];
          p2 = [650, 480];
          p3 = [500, 220];
        }

        const d = `M ${p1[0]} ${p1[1]} L ${p2[0]} ${p2[1]} L ${p3[0]} ${p3[1]} Z`;
        const aabb: AABB = {
          id,
          x1: Math.min(p1[0], p2[0], p3[0]),
          y1: Math.min(p1[1], p2[1], p3[1]),
          x2: Math.max(p1[0], p2[0], p3[0]),
          y2: Math.max(p1[1], p2[1], p3[1]),
        };
        ctx.occupiedBoxes.push(aabb);

        const shape: Shape = { type: "path", d, color };
        ctx.drawnElements.set(id, { shape, aabb });
        return shape;
      }

      case "line":
      case "arrow": {
        // Connector resolving with docking endpoints and real-outline ray casting
        const fromEndpoint = this.normalizeEndpoint(semanticObj.from, semanticObj.fromId);
        const toEndpoint = this.normalizeEndpoint(semanticObj.to, semanticObj.toId);

        let fromPt: Pt = [250, 350];
        let toPt: Pt = [750, 350];

        if (fromEndpoint && toEndpoint && ctx.drawnElements.has(fromEndpoint.elementId) && ctx.drawnElements.has(toEndpoint.elementId)) {
          const shapeA = ctx.drawnElements.get(fromEndpoint.elementId)!;
          const shapeB = ctx.drawnElements.get(toEndpoint.elementId)!;

          let portA = fromEndpoint.port;
          let portB = toEndpoint.port;

          if (!portA || !portB) {
            const auto = this.autoPorts(shapeA.shape, shapeA.aabb, shapeB.shape, shapeB.aabb);
            if (!portA) portA = auto.fromPort;
            if (!portB) portB = auto.toPort;
          }

          fromPt = this.getPortCoordinate(fromEndpoint.elementId, portA, ctx, id);
          toPt = this.getPortCoordinate(toEndpoint.elementId, portB, ctx, id);
        } else {
          // Fallback legacy docking
          if (fromEndpoint && ctx.drawnElements.has(fromEndpoint.elementId)) {
            const b = ctx.drawnElements.get(fromEndpoint.elementId)!.aabb;
            fromPt = [b.x2 + 10, (b.y1 + b.y2) / 2];
          }
          if (toEndpoint && ctx.drawnElements.has(toEndpoint.elementId)) {
            const b = ctx.drawnElements.get(toEndpoint.elementId)!.aabb;
            toPt = [b.x1 - 10, (b.y1 + b.y2) / 2];
          }
        }

        const aabb: AABB = {
          id,
          x1: Math.min(fromPt[0], toPt[0]),
          y1: Math.min(fromPt[1], toPt[1]),
          x2: Math.max(fromPt[0], toPt[0]),
          y2: Math.max(fromPt[1], toPt[1]),
        };
        ctx.occupiedBoxes.push(aabb);

        const shape: Shape = { type: semanticObj.type, from: fromPt, to: toPt, color };
        ctx.drawnElements.set(id, { shape, aabb });
        return shape;
      }

      case "formula": {
        const x = slotRect.x + slotRect.w / 2;
        const y = slotRect.y + slotRect.h / 2;
        const size = Math.max(16, 32);
        const shape: Shape = {
          type: "text",
          x,
          y,
          text: `$$${semanticObj.latex}$$`,
          size,
          color,
        };
        const aabb: AABB = { id, x1: x - 150, y1: y - 25, x2: x + 150, y2: y + 25 };
        ctx.occupiedBoxes.push(aabb);
        ctx.drawnElements.set(id, { shape, aabb });
        return shape;
      }

      case "function_plotter": {
        const [xMin, xMax] = semanticObj.xDomain;
        const [yMin, yMax] = semanticObj.yDomain;
        const xSpan = Math.max(0.1, xMax - xMin);
        const ySpan = Math.max(0.1, yMax - yMin);

        const boxX = 260;
        const boxY = 160;
        const boxW = 480;
        const boxH = 400;

        const numPoints = 80;
        let d = "";
        let first = true;

        for (let i = 0; i <= numPoints; i++) {
          const xi = xMin + (i / numPoints) * xSpan;
          const yi = evaluateMath(semanticObj.f, xi);

          if (!Number.isFinite(yi) || yi < yMin - 10 || yi > yMax + 10) {
            first = true;
            continue;
          }

          const px = Math.round(boxX + ((xi - xMin) / xSpan) * boxW);
          const py = Math.round(boxY + boxH - ((yi - yMin) / ySpan) * boxH);

          if (first) {
            d += `M ${px} ${py} `;
            first = false;
          } else {
            d += `L ${px} ${py} `;
          }
        }

        const aabb: AABB = { id, x1: boxX, y1: boxY, x2: boxX + boxW, y2: boxY + boxH };
        ctx.occupiedBoxes.push(aabb);

        const shape: Shape = { type: "path", d: d.trim(), color };
        ctx.drawnElements.set(id, { shape, aabb });
        return shape;
      }

      case "coordinate_plane": {
        const [xMin, xMax] = semanticObj.xDomain;
        const [yMin, yMax] = semanticObj.yDomain;
        const xSpan = Math.max(0.1, xMax - xMin);
        const ySpan = Math.max(0.1, yMax - yMin);

        const boxX = 260;
        const boxY = 160;
        const boxW = 480;
        const boxH = 400;

        const origX = Math.round(boxX + ((0 - xMin) / xSpan) * boxW);
        const origY = Math.round(boxY + boxH - ((0 - yMin) / ySpan) * boxH);

        let d = "";

        d += `M ${boxX} ${origY} L ${boxX + boxW} ${origY} `;
        d += `M ${boxX + boxW - 10} ${origY - 6} L ${boxX + boxW} ${origY} L ${boxX + boxW - 10} ${origY + 6} `;

        d += `M ${origX} ${boxY + boxH} L ${origX} ${boxY} `;
        d += `M ${origX - 6} ${boxY + 10} L ${origX} ${boxY} L ${origX + 6} ${boxY + 10} `;

        for (let x = Math.ceil(xMin); x <= Math.floor(xMax); x++) {
          if (x === 0) continue;
          const tx = Math.round(boxX + ((x - xMin) / xSpan) * boxW);
          d += `M ${tx} ${origY - 4} L ${tx} ${origY + 4} `;
        }

        for (let y = Math.ceil(yMin); y <= Math.floor(yMax); y++) {
          if (y === 0) continue;
          const ty = Math.round(boxY + boxH - ((y - yMin) / ySpan) * boxH);
          d += `M ${origX - 4} ${ty} L ${origX + 4} ${ty} `;
        }

        if (semanticObj.points) {
          for (const [px, py] of semanticObj.points) {
            const cx = Math.round(boxX + ((px - xMin) / xSpan) * boxW);
            const cy = Math.round(boxY + boxH - ((py - yMin) / ySpan) * boxH);
            d += `M ${cx - 5} ${cy} L ${cx + 5} ${cy} M ${cx} ${cy - 5} L ${cx} ${cy + 5} `;
          }
        }

        const aabb: AABB = { id, x1: boxX, y1: boxY, x2: boxX + boxW, y2: boxY + boxH };
        ctx.occupiedBoxes.push(aabb);

        const shape: Shape = { type: "path", d: d.trim(), color };
        ctx.drawnElements.set(id, { shape, aabb });
        return shape;
      }

      case "label": {
        const text = ctx.labels[semanticObj.labelKey] || semanticObj.labelKey;
        const note = semanticObj.noteKey ? ctx.labels[semanticObj.noteKey] || semanticObj.noteKey : null;

        let x = slotRect.x + slotRect.w / 2;
        let y = slotRect.y + slotRect.h / 2;

        if (semanticObj.attachToId && ctx.drawnElements.has(semanticObj.attachToId)) {
          const b = ctx.drawnElements.get(semanticObj.attachToId)!.aabb;
          x = rtl ? Math.min(900, b.x2 + 60) : Math.max(100, b.x1 - 60);
          y = (b.y1 + b.y2) / 2;
        } else if (bp === "freeform" && !semanticObj.slotId) {
          x = rtl ? 820 : 180;
          y = 350;
          if (semanticObj.position === "center") {
            x = 500;
            y = 350;
          } else if (semanticObj.position === "top") {
            x = 500;
            y = 160;
          } else if (semanticObj.position === "bottom") {
            x = 500;
            y = 550;
          }
        }

        y = this.avoidCollision(x, y, 160, 40, ctx.occupiedBoxes);

        const aabb: AABB = { id, x1: x - 80, y1: y - 20, x2: x + 80, y2: y + 20 };
        ctx.occupiedBoxes.push(aabb);

        const shape: Shape = { type: "label", x, y, text, note, color };
        ctx.drawnElements.set(id, { shape, aabb });
        return shape;
      }

      case "path": {
        const shape: Shape = { type: "path", d: semanticObj.d, color };
        const pts = sampleSvgPath(semanticObj.d);
        let aabb: AABB;
        if (pts.length > 0) {
          let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
          for (const [px, py] of pts) {
            if (px < minX) minX = px;
            if (py < minY) minY = py;
            if (px > maxX) maxX = px;
            if (py > maxY) maxY = py;
          }
          aabb = { id, x1: minX, y1: minY, x2: maxX, y2: maxY };
        } else {
          aabb = { id, x1: 250, y1: 250, x2: 750, y2: 550 };
        }
        ctx.occupiedBoxes.push(aabb);
        ctx.drawnElements.set(id, { shape, aabb });
        return shape;
      }
    }
  }

  // Normalizes endpoint input to a structured DockingEndpoint
  private normalizeEndpoint(
    endpoint?: DockingEndpoint | string,
    id?: string
  ): DockingEndpoint | null {
    if (endpoint) {
      if (typeof endpoint === "string") return { elementId: endpoint };
      return endpoint;
    }
    if (id) return { elementId: id };
    return null;
  }

  // Infers blueprint slot based on semantic object properties
  private inferSlotId(obj: SemanticObject, bp: MacroBlueprint, rtl: boolean): string {
    const slots = BLUEPRINT_SLOTS[bp];
    if (!slots || slots.length === 0) return "canvas";

    if (bp === "process_flow") {
      if (obj.type === "formula") return "banner";
      if (obj.type === "circle" && (obj as any).zone === "left") return rtl ? "outputs" : "inputs";
      if (obj.type === "circle" && (obj as any).zone === "right") return rtl ? "inputs" : "outputs";
      if (obj.type === "label" && (obj as any).position === "center") return "core_subject";
      if (obj.type === "path") return "core_subject";
      return "inputs";
    }

    if (bp === "anatomy_structure") {
      if (obj.type === "path" || obj.type === "circle") return "core_subject";
      if (obj.type === "label") return rtl ? "right_callouts" : "left_callouts";
      return "core_subject";
    }

    if (bp === "mathematical_derivation") {
      if (obj.type === "formula") return "vertical_steps";
      if (obj.type === "label") return "justifications";
      return "vertical_steps";
    }

    if (bp === "comparison") {
      if ((obj as any).zone === "right") return "split_right";
      return "split_left";
    }

    if (bp === "cycle") {
      if ((obj as any).position === "center" || obj.type === "circle") return "central_concept";
      return "cycle_nodes";
    }

    return slots[0].id;
  }

  // Computes the assigned bounding rectangle for an item inside a slot
  private calculateSlotItemRect(
    bp: MacroBlueprint,
    slotId: string,
    itemIndex: number
  ): { x: number; y: number; w: number; h: number } {
    const slot = BLUEPRINT_SLOTS[bp]?.find((s) => s.id === slotId);
    if (!slot) return { x: 40, y: 40, w: 920, h: 620 };

    const r = slot.rect;
    const cap = Math.max(1, slot.capacity);
    const idx = Math.min(cap - 1, itemIndex);

    if (slot.layout === "center") {
      return r;
    }

    if (slot.layout === "stack-v") {
      const itemH = r.h / cap;
      return {
        x: r.x,
        y: Math.round(r.y + idx * itemH),
        w: r.w,
        h: Math.round(itemH),
      };
    }

    if (slot.layout === "stack-h") {
      const itemW = r.w / cap;
      return {
        x: Math.round(r.x + idx * itemW),
        y: r.y,
        w: Math.round(itemW),
        h: r.h,
      };
    }

    if (slot.layout === "grid") {
      const cols = 2;
      const rows = Math.ceil(cap / cols);
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      const itemW = r.w / cols;
      const itemH = r.h / Math.max(1, rows);
      return {
        x: Math.round(r.x + col * itemW),
        y: Math.round(r.y + row * itemH),
        w: Math.round(itemW),
        h: Math.round(itemH),
      };
    }

    return r;
  }

  // Computes exact real-outline perimeter docking coordinate with fanOut and memoization
  public getPortCoordinate(
    elementId: string,
    port: CardinalPort = "E",
    ctx?: LayoutContext,
    connectorId?: string
  ): Pt {
    const cacheKey = `${elementId}:${port}:${connectorId || ""}`;
    if (this.endpointCache.has(cacheKey)) {
      return this.endpointCache.get(cacheKey)!;
    }

    if (!ctx || !ctx.drawnElements.has(elementId)) {
      // Default center fallback
      return [500, 350];
    }

    const { shape, aabb } = ctx.drawnElements.get(elementId)!;
    const basePt = this.intersectRayWithShape(shape, aabb, port);

    // Apply fanOut spreading if multiple connectors dock to the exact same port
    let finalPt = basePt;
    if (connectorId && ctx.portDockingCounts) {
      const portKey = `${elementId}:${port}`;
      const count = ctx.portDockingCounts.get(portKey) || 0;
      ctx.portDockingCounts.set(portKey, count + 1);

      const connKey = `${connectorId}:${portKey}`;
      let idx = ctx.portDockingIndex?.get(connKey);
      if (idx === undefined) {
        idx = count;
        ctx.portDockingIndex?.set(connKey, idx);
      }

      // Expected total connectors docking to this port (estimate from count or at least 1)
      const total = Math.max(1, count + 1);
      finalPt = this.fanOut(basePt, port, idx, total);
    }

    this.endpointCache.set(cacheKey, finalPt);
    return finalPt;
  }

  // Ray-casts from shape centroid to real outline (exact geometry, no AABB corners for curves)
  public intersectRayWithShape(shape: Shape, aabb: AABB, port: CardinalPort): Pt {
    const dir = PORT_VECTORS[port];
    const dx = dir[0];
    const dy = dir[1];

    if (shape.type === "circle") {
      const cx = shape.x;
      const cy = shape.y;
      const r = shape.r;
      return [Math.round((cx + r * dx) * 10) / 10, Math.round((cy + r * dy) * 10) / 10];
    }

    if (shape.type === "ellipse") {
      const cx = shape.x;
      const cy = shape.y;
      const rx = shape.rx;
      const ry = shape.ry;
      const t = 1 / Math.sqrt((dx / rx) ** 2 + (dy / ry) ** 2);
      return [Math.round((cx + t * dx) * 10) / 10, Math.round((cy + t * dy) * 10) / 10];
    }

    if (shape.type === "rect") {
      const cx = shape.x + shape.w / 2;
      const cy = shape.y + shape.h / 2;
      const halfW = shape.w / 2;
      const halfH = shape.h / 2;

      let tx = Infinity;
      let ty = Infinity;

      if (dx > 0) tx = halfW / dx;
      else if (dx < 0) tx = -halfW / dx;

      if (dy > 0) ty = halfH / dy;
      else if (dy < 0) ty = -halfH / dy;

      const t = Math.min(tx, ty);
      return [Math.round((cx + t * dx) * 10) / 10, Math.round((cy + t * dy) * 10) / 10];
    }

    if (shape.type === "path") {
      const poly = sampleSvgPath(shape.d);
      if (poly.length >= 3) {
        // Calculate centroid of polygon vertices
        let sumX = 0, sumY = 0;
        for (const [px, py] of poly) {
          sumX += px;
          sumY += py;
        }
        const cx = sumX / poly.length;
        const cy = sumY / poly.length;

        // Find closest ray intersection with polygon edges
        let minT = Infinity;
        let bestPt: Pt | null = null;

        for (let i = 0; i < poly.length; i++) {
          const p1 = poly[i];
          const p2 = poly[(i + 1) % poly.length];
          const hit = intersectRayWithSegment([cx, cy], [dx, dy], p1, p2);
          if (hit !== null && hit.t > 0.01 && hit.t < minT) {
            minT = hit.t;
            bestPt = hit.pt;
          }
        }

        if (bestPt) {
          return [Math.round(bestPt[0] * 10) / 10, Math.round(bestPt[1] * 10) / 10];
        }
      }
    }

    // Default ray-cast against AABB rectangle for text, label, etc.
    const cx = (aabb.x1 + aabb.x2) / 2;
    const cy = (aabb.y1 + aabb.y2) / 2;
    const halfW = (aabb.x2 - aabb.x1) / 2;
    const halfH = (aabb.y2 - aabb.y1) / 2;

    let tx = Infinity;
    let ty = Infinity;

    if (dx > 0) tx = halfW / dx;
    else if (dx < 0) tx = -halfW / dx;

    if (dy > 0) ty = halfH / dy;
    else if (dy < 0) ty = -halfH / dy;

    const t = Math.min(tx, ty);
    return [Math.round((cx + t * dx) * 10) / 10, Math.round((cy + t * dy) * 10) / 10];
  }

  // Automatic relative port selection across 8 quadrants
  public autoPorts(
    shapeA: Shape,
    aabbA: AABB,
    shapeB: Shape,
    aabbB: AABB
  ): { fromPort: CardinalPort; toPort: CardinalPort } {
    const cA = this.getShapeCentroid(shapeA, aabbA);
    const cB = this.getShapeCentroid(shapeB, aabbB);

    const deltaX = cB[0] - cA[0];
    const deltaY = cB[1] - cA[1];
    const angleRad = Math.atan2(deltaY, deltaX);
    let deg = (angleRad * 180) / Math.PI;
    if (deg < 0) deg += 360;

    // 8 quadrants of 45 degrees centered on cardinal directions
    if (deg >= 337.5 || deg < 22.5) {
      return { fromPort: "E", toPort: "W" };
    } else if (deg >= 22.5 && deg < 67.5) {
      return { fromPort: "SE", toPort: "NW" };
    } else if (deg >= 67.5 && deg < 112.5) {
      return { fromPort: "S", toPort: "N" };
    } else if (deg >= 112.5 && deg < 157.5) {
      return { fromPort: "SW", toPort: "NE" };
    } else if (deg >= 157.5 && deg < 202.5) {
      return { fromPort: "W", toPort: "E" };
    } else if (deg >= 202.5 && deg < 247.5) {
      return { fromPort: "NW", toPort: "SE" };
    } else if (deg >= 247.5 && deg < 292.5) {
      return { fromPort: "N", toPort: "S" };
    } else {
      return { fromPort: "NE", toPort: "SW" };
    }
  }

  // Returns shape center/centroid
  public getShapeCentroid(shape: Shape, aabb: AABB): Pt {
    if (shape.type === "circle" || shape.type === "ellipse") {
      return [shape.x, shape.y];
    }
    if (shape.type === "rect") {
      return [shape.x + shape.w / 2, shape.y + shape.h / 2];
    }
    return [(aabb.x1 + aabb.x2) / 2, (aabb.y1 + aabb.y2) / 2];
  }

  // Spreads multiple connectors sharing a docking port
  public fanOut(pt: Pt, port: CardinalPort, index: number, total: number, maxSpread = 24): Pt {
    if (total <= 1) return pt;
    const offset = (index - (total - 1) / 2) * (maxSpread / Math.max(1, total - 1));

    if (port === "N" || port === "S") {
      return [Math.round((pt[0] + offset) * 10) / 10, pt[1]];
    }
    if (port === "E" || port === "W") {
      return [pt[0], Math.round((pt[1] + offset) * 10) / 10];
    }

    // Perpendicular vector for diagonal ports
    const dir = PORT_VECTORS[port];
    const perpX = -dir[1];
    const perpY = dir[0];
    return [
      Math.round((pt[0] + perpX * offset) * 10) / 10,
      Math.round((pt[1] + perpY * offset) * 10) / 10,
    ];
  }

  // AABB collision avoidance safety net
  private avoidCollision(x: number, y: number, w: number, h: number, occupied: AABB[]): number {
    let currentY = y;
    const halfW = w / 2;
    const halfH = h / 2;

    for (let attempts = 0; attempts < 6; attempts++) {
      const box1 = { x1: x - halfW, y1: currentY - halfH, x2: x + halfW, y2: currentY + halfH };
      const collision = occupied.find(
        (b) => !(box1.x2 < b.x1 || box1.x1 > b.x2 || box1.y2 < b.y1 || box1.y1 > b.y2)
      );

      if (!collision) return currentY;
      currentY = collision.y2 + halfH + 15;
      if (currentY > 620) {
        currentY = 160;
      }
    }
    return currentY;
  }
}

// Ray-segment intersection (2D linear solve)
export function intersectRayWithSegment(
  rayOrigin: Pt,
  rayDir: Pt,
  segA: Pt,
  segB: Pt
): { t: number; pt: Pt } | null {
  const dx = rayDir[0];
  const dy = rayDir[1];
  const vx = segB[0] - segA[0];
  const vy = segB[1] - segA[1];

  const det = -dx * vy + dy * vx;
  if (Math.abs(det) < 1e-9) return null;

  const qx = segA[0] - rayOrigin[0];
  const qy = segA[1] - rayOrigin[1];

  const t = (-qx * vy + qy * vx) / det;
  const u = (dx * qy - dy * qx) / det;

  if (t > 0 && u >= 0 && u <= 1) {
    return {
      t,
      pt: [rayOrigin[0] + t * dx, rayOrigin[1] + t * dy],
    };
  }

  return null;
}

// SVG path tokenizer and sampler: converts path commands into polygon coordinates with <= 0.5px accuracy
export function sampleSvgPath(d: string, samplesPerCurve = 16): Pt[] {
  const points: Pt[] = [];
  const tokenRegex = /([a-df-z])|([-+]?(?:\d*\.\d+|\d+)(?:[eE][-+]?\d+)?)/gi;
  const tokens: string[] = [];
  let m: RegExpExecArray | null;

  while ((m = tokenRegex.exec(d)) !== null) {
    tokens.push(m[0]);
  }

  let i = 0;
  let curX = 0;
  let curY = 0;
  let startX = 0;
  let startY = 0;
  let curCmd = "";

  while (i < tokens.length) {
    const tok = tokens[i];
    if (/^[a-z]$/i.test(tok)) {
      curCmd = tok;
      i++;
    }

    const isRelative = curCmd === curCmd.toLowerCase();
    const cmd = curCmd.toUpperCase();

    if (cmd === "M") {
      const x = parseFloat(tokens[i++]);
      const y = parseFloat(tokens[i++]);
      curX = isRelative ? curX + x : x;
      curY = isRelative ? curY + y : y;
      startX = curX;
      startY = curY;
      points.push([curX, curY]);
      // Subsequent numbers after M are treated as L
      curCmd = isRelative ? "l" : "L";
    } else if (cmd === "L") {
      const x = parseFloat(tokens[i++]);
      const y = parseFloat(tokens[i++]);
      curX = isRelative ? curX + x : x;
      curY = isRelative ? curY + y : y;
      points.push([curX, curY]);
    } else if (cmd === "H") {
      const x = parseFloat(tokens[i++]);
      curX = isRelative ? curX + x : x;
      points.push([curX, curY]);
    } else if (cmd === "V") {
      const y = parseFloat(tokens[i++]);
      curY = isRelative ? curY + y : y;
      points.push([curX, curY]);
    } else if (cmd === "C") {
      const x1 = parseFloat(tokens[i++]);
      const y1 = parseFloat(tokens[i++]);
      const x2 = parseFloat(tokens[i++]);
      const y2 = parseFloat(tokens[i++]);
      const x = parseFloat(tokens[i++]);
      const y = parseFloat(tokens[i++]);

      const p0: Pt = [curX, curY];
      const p1: Pt = isRelative ? [curX + x1, curY + y1] : [x1, y1];
      const p2: Pt = isRelative ? [curX + x2, curY + y2] : [x2, y2];
      const p3: Pt = isRelative ? [curX + x, curY + y] : [x, y];

      for (let s = 1; s <= samplesPerCurve; s++) {
        const u = s / samplesPerCurve;
        const bx =
          (1 - u) ** 3 * p0[0] +
          3 * (1 - u) ** 2 * u * p1[0] +
          3 * (1 - u) * u ** 2 * p2[0] +
          u ** 3 * p3[0];
        const by =
          (1 - u) ** 3 * p0[1] +
          3 * (1 - u) ** 2 * u * p1[1] +
          3 * (1 - u) * u ** 2 * p2[1] +
          u ** 3 * p3[1];
        points.push([bx, by]);
      }
      curX = p3[0];
      curY = p3[1];
    } else if (cmd === "Q") {
      const x1 = parseFloat(tokens[i++]);
      const y1 = parseFloat(tokens[i++]);
      const x = parseFloat(tokens[i++]);
      const y = parseFloat(tokens[i++]);

      const p0: Pt = [curX, curY];
      const p1: Pt = isRelative ? [curX + x1, curY + y1] : [x1, y1];
      const p2: Pt = isRelative ? [curX + x, curY + y] : [x, y];

      for (let s = 1; s <= samplesPerCurve; s++) {
        const u = s / samplesPerCurve;
        const bx = (1 - u) ** 2 * p0[0] + 2 * (1 - u) * u * p1[0] + u ** 2 * p2[0];
        const by = (1 - u) ** 2 * p0[1] + 2 * (1 - u) * u * p1[1] + u ** 2 * p2[1];
        points.push([bx, by]);
      }
      curX = p2[0];
      curY = p2[1];
    } else if (cmd === "Z") {
      curX = startX;
      curY = startY;
      points.push([curX, curY]);
    } else {
      i++;
    }
  }

  return points;
}

// Safe math expression evaluator for function plotting (without eval)
export function evaluateMath(expr: string, x: number): number {
  const clean = expr.replace(/\s+/g, "").toLowerCase();

  const tokens: string[] = [];
  let i = 0;
  while (i < clean.length) {
    const ch = clean[i];
    if (/[0-9.]/.test(ch)) {
      let num = "";
      while (i < clean.length && /[0-9.]/.test(clean[i])) {
        num += clean[i++];
      }
      tokens.push(num);
    } else if (/[a-z]/.test(ch)) {
      let id = "";
      while (i < clean.length && /[a-z]/.test(clean[i])) {
        id += clean[i++];
      }
      tokens.push(id);
    } else if ("+-*/^()".includes(ch)) {
      tokens.push(ch);
      i++;
    } else {
      i++;
    }
  }

  let pos = 0;

  function parseExpression(): number {
    let val = parseTerm();
    while (pos < tokens.length && (tokens[pos] === "+" || tokens[pos] === "-")) {
      const op = tokens[pos++];
      const rhs = parseTerm();
      val = op === "+" ? val + rhs : val - rhs;
    }
    return val;
  }

  function parseTerm(): number {
    let val = parsePower();
    while (pos < tokens.length && (tokens[pos] === "*" || tokens[pos] === "/")) {
      const op = tokens[pos++];
      const rhs = parsePower();
      val = op === "*" ? val * rhs : val / (rhs === 0 ? 1e-9 : rhs);
    }
    return val;
  }

  function parsePower(): number {
    let val = parseFactor();
    if (pos < tokens.length && tokens[pos] === "^") {
      pos++;
      const rhs = parsePower();
      val = Math.pow(val, rhs);
    }
    return val;
  }

  function parseFactor(): number {
    if (pos >= tokens.length) return 0;
    const tok = tokens[pos++];

    if (tok === "-") return -parseFactor();
    if (tok === "+") return parseFactor();
    if (tok === "(") {
      const val = parseExpression();
      if (pos < tokens.length && tokens[pos] === ")") pos++;
      return val;
    }
    if (tok === "x") return x;
    if (tok === "pi") return Math.PI;
    if (tok === "e") return Math.E;
    if (["sin", "cos", "tan", "sqrt", "abs", "log", "ln", "exp"].includes(tok)) {
      let arg = 0;
      if (pos < tokens.length && tokens[pos] === "(") {
        pos++;
        arg = parseExpression();
        if (pos < tokens.length && tokens[pos] === ")") pos++;
      } else {
        arg = parseFactor();
      }
      switch (tok) {
        case "sin": return Math.sin(arg);
        case "cos": return Math.cos(arg);
        case "tan": return Math.tan(arg);
        case "sqrt": return Math.sqrt(Math.max(0, arg));
        case "abs": return Math.abs(arg);
        case "exp": return Math.exp(arg);
        case "log":
        case "ln": return Math.log(Math.max(1e-9, arg));
      }
    }

    const n = parseFloat(tok);
    return isNaN(n) ? 0 : n;
  }

  try {
    const res = parseExpression();
    return Number.isFinite(res) ? res : 0;
  } catch {
    return 0;
  }
}

export const layoutEngine = new LayoutEngine();
