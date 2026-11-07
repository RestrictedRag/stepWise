// Deterministic Spatial Layout Engine for 1000x700 Virtual Canvas
// Direction-aware (LTR/RTL), script-sensitive, and resolves semantic objects into exact Shape coordinates.

import type { Shape, Pt } from "../board.ts";
import type { SemanticObject, Color } from "../manifest.ts";
import { isRTL } from "../languages.ts";

export interface AABB {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface LayoutContext {
  language: string;
  labels: Record<string, string>;
  occupiedBoxes: AABB[];
  drawnElements: Map<string, { shape: Shape; aabb: AABB }>;
}

export class LayoutEngine {
  private width = 1000;
  private height = 700;

  public resolveObject(
    id: string,
    semanticObj: SemanticObject,
    color: Color,
    ctx: LayoutContext
  ): Shape {
    const rtl = isRTL(ctx.language);

    switch (semanticObj.type) {
      case "circle": {
        const r = semanticObj.size === "sm" ? 45 : semanticObj.size === "lg" ? 130 : 80;
        let x = 500;
        let y = 350;

        if (semanticObj.zone === "left") x = rtl ? 650 : 350;
        else if (semanticObj.zone === "right") x = rtl ? 350 : 650;

        const aabb: AABB = { id, x1: x - r, y1: y - r, x2: x + r, y2: y + r };
        ctx.occupiedBoxes.push(aabb);

        const shape: Shape = { type: "circle", x, y, r, color };
        ctx.drawnElements.set(id, { shape, aabb });
        return shape;
      }

      case "rect": {
        const w = semanticObj.size === "sm" ? 140 : semanticObj.size === "lg" ? 360 : 240;
        const h = semanticObj.size === "sm" ? 90 : semanticObj.size === "lg" ? 220 : 150;
        let x = 500 - w / 2;
        let y = 350 - h / 2;

        if (semanticObj.zone === "left") x = (rtl ? 650 : 350) - w / 2;
        else if (semanticObj.zone === "right") x = (rtl ? 350 : 650) - w / 2;

        const aabb: AABB = { id, x1: x, y1: y, x2: x + w, y2: y + h };
        ctx.occupiedBoxes.push(aabb);

        const shape: Shape = { type: "rect", x, y, w, h, color };
        ctx.drawnElements.set(id, { shape, aabb });
        return shape;
      }

      case "number_line": {
        // Horizontal number line centered on the canvas
        const min = semanticObj.min;
        const max = semanticObj.max;
        const lineX1 = 150;
        const lineX2 = 850;
        const lineY = 380;
        const span = Math.max(1, max - min);
        const step = semanticObj.step || 1;

        // Path representing axis and tick marks
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
        let from: Pt = [250, 350];
        let to: Pt = [750, 350];

        if (semanticObj.fromId && ctx.drawnElements.has(semanticObj.fromId)) {
          const b = ctx.drawnElements.get(semanticObj.fromId)!.aabb;
          from = [b.x2 + 10, (b.y1 + b.y2) / 2];
        }
        if (semanticObj.toId && ctx.drawnElements.has(semanticObj.toId)) {
          const b = ctx.drawnElements.get(semanticObj.toId)!.aabb;
          to = [b.x1 - 10, (b.y1 + b.y2) / 2];
        }

        const aabb: AABB = {
          id,
          x1: Math.min(from[0], to[0]),
          y1: Math.min(from[1], to[1]),
          x2: Math.max(from[0], to[0]),
          y2: Math.max(from[1], to[1]),
        };
        ctx.occupiedBoxes.push(aabb);

        const shape: Shape = { type: semanticObj.type, from, to, color };
        ctx.drawnElements.set(id, { shape, aabb });
        return shape;
      }

      case "formula": {
        // Centered formula text
        const x = 500;
        const y = 350;
        const shape: Shape = {
          type: "text",
          x,
          y,
          text: `$$${semanticObj.latex}$$`,
          size: 32,
          color,
        };
        const aabb: AABB = { id, x1: x - 150, y1: y - 25, x2: x + 150, y2: y + 25 };
        ctx.occupiedBoxes.push(aabb);
        ctx.drawnElements.set(id, { shape, aabb });
        return shape;
      }

      case "label": {
        const text = ctx.labels[semanticObj.labelKey] || semanticObj.labelKey;
        const note = semanticObj.noteKey ? ctx.labels[semanticObj.noteKey] || semanticObj.noteKey : null;

        let x = rtl ? 820 : 180;
        let y = 350;

        if (semanticObj.attachToId && ctx.drawnElements.has(semanticObj.attachToId)) {
          const b = ctx.drawnElements.get(semanticObj.attachToId)!.aabb;
          // Place label in margin on appropriate side
          x = rtl ? Math.min(900, b.x2 + 60) : Math.max(100, b.x1 - 60);
          y = (b.y1 + b.y2) / 2;
        } else if (semanticObj.position === "center") {
          x = 500;
          y = 350;
        } else if (semanticObj.position === "top") {
          x = 500;
          y = 160;
        } else if (semanticObj.position === "bottom") {
          x = 500;
          y = 550;
        }

        // Safety AABB collision check and vertical nudge
        y = this.avoidCollision(x, y, 160, 40, ctx.occupiedBoxes);

        const aabb: AABB = { id, x1: x - 80, y1: y - 20, x2: x + 80, y2: y + 20 };
        ctx.occupiedBoxes.push(aabb);

        const shape: Shape = { type: "label", x, y, text, note, color };
        ctx.drawnElements.set(id, { shape, aabb });
        return shape;
      }

      case "path": {
        const shape: Shape = { type: "path", d: semanticObj.d, color };
        const aabb: AABB = { id, x1: 250, y1: 250, x2: 750, y2: 550 };
        ctx.occupiedBoxes.push(aabb);
        ctx.drawnElements.set(id, { shape, aabb });
        return shape;
      }
    }
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
      // Nudge vertically away from collision
      currentY = collision.y2 + halfH + 15;
      if (currentY > 620) {
        currentY = 160; // wrap to top margin if pushing too low
      }
    }
    return currentY;
  }
}

export const layoutEngine = new LayoutEngine();
