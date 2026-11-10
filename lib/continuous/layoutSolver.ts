// Continuous Layout Solver: Resolves static world coordinates, collision-free placement,
// equation '=' alignment, and ray-cast outline connector ports across all lesson elements.

import type {
  ContinuousLesson,
  CanvasElement,
  ConnectorElement,
  SolvedElement,
  SolvedConnector,
  SolvedLayout,
  ElementDimensions,
  Point2D,
  Rect2D,
  SizeToken,
  RelativePosition,
} from "./types.ts";
import { validateContinuousLesson, repairContinuousLesson } from "./validator.ts";

// Spacing tokens aligned with schema contract in types.ts (16 / 32 / 56 px)
const OFFSET_PX: Record<SizeToken, number> = {
  sm: 16,
  md: 32,
  lg: 56,
};

// Default dimensional heuristics when browser DOM measurements are not yet available
export function estimateDimensions(element: CanvasElement): ElementDimensions {
  if (element.type === "shape") {
    let width = 140;
    let height = 90;

    switch (element.size) {
      case "sm":
        width = 80;
        height = 80;
        break;
      case "md":
        width = 150;
        height = 95;
        break;
      case "lg":
        width = 220;
        height = 130;
        break;
    }

    // Account for shape label text if present
    if (element.label && element.label.trim().length > 0) {
      const labelLen = element.label.length;
      const labelW = Math.round(labelLen * 9.5 + 24);
      width = Math.max(width, labelW);
      height += 24; // Additional vertical space for label text
    }

    return { width, height };
  }

  if (element.type === "text") {
    const fontSize = element.size === "sm" ? 15 : element.size === "lg" ? 22 : 18;
    const len = element.text.length;
    const estimatedWidth = Math.max(70, Math.round(len * fontSize * 0.58 + 24));
    const estimatedHeight = Math.round(fontSize * 1.5 + 16);
    return { width: estimatedWidth, height: estimatedHeight };
  }

  if (element.type === "latex") {
    const fontSize = element.size === "sm" ? 16 : element.size === "lg" ? 24 : 20;
    // Strip common LaTeX commands to estimate visible length
    const cleanMath = element.math.replace(/\\[a-zA-Z]+/g, "m").replace(/[{}_^]/g, "");
    const estimatedWidth = Math.max(120, Math.round(cleanMath.length * fontSize * 0.65 + 32));
    const estimatedHeight = Math.round(fontSize * 2.2 + 16);

    // Estimate relative X position of the '=' sign or arrow
    let eqRelX = estimatedWidth * 0.5;
    const eqIdx = element.math.search(/(=|\\to|\\xrightarrow|\\implies)/);
    if (eqIdx !== -1) {
      const ratio = Math.max(0.15, Math.min(0.85, eqIdx / element.math.length));
      eqRelX = Math.round(estimatedWidth * ratio);
    }

    return { width: estimatedWidth, height: estimatedHeight, eqRelX };
  }

  return { width: 100, height: 50 };
}

function checkAABBOverlap(r1: Rect2D, r2: Rect2D, padding = 12): boolean {
  return !(
    r1.x + r1.width + padding <= r2.x ||
    r2.x + r2.width + padding <= r1.x ||
    r1.y + r1.height + padding <= r2.y ||
    r2.y + r2.height + padding <= r1.y
  );
}

// Analytic ray-cast from center to ellipse outline
function rayCastEllipse(cx: number, cy: number, rx: number, ry: number, targetX: number, targetY: number): Point2D {
  const dx = targetX - cx;
  const dy = targetY - cy;
  if (dx === 0 && dy === 0) return { x: cx + rx, y: cy };

  const angle = Math.atan2(dy, dx);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const denom = Math.sqrt((ry * cos) ** 2 + (rx * sin) ** 2);
  const r = denom === 0 ? 0 : (rx * ry) / denom;

  return {
    x: Math.round((cx + r * cos) * 10) / 10,
    y: Math.round((cy + r * sin) * 10) / 10,
  };
}

// Line intersection with rectangle boundary
function rayCastRect(cx: number, cy: number, bounds: Rect2D, targetX: number, targetY: number): Point2D {
  const dx = targetX - cx;
  const dy = targetY - cy;
  if (dx === 0 && dy === 0) return { x: bounds.x + bounds.width, y: cy };

  const halfW = bounds.width / 2;
  const halfH = bounds.height / 2;

  let tMin = Infinity;
  let hit: Point2D = { x: cx, y: cy };

  if (dx !== 0) {
    const tx = dx > 0 ? halfW / dx : -halfW / dx;
    const py = cy + tx * dy;
    if (tx > 0 && tx < tMin && py >= bounds.y - 0.1 && py <= bounds.y + bounds.height + 0.1) {
      tMin = tx;
      hit = { x: dx > 0 ? bounds.x + bounds.width : bounds.x, y: py };
    }
  }

  if (dy !== 0) {
    const ty = dy > 0 ? halfH / dy : -halfH / dy;
    const px = cx + ty * dx;
    if (ty > 0 && ty < tMin && px >= bounds.x - 0.1 && px <= bounds.x + bounds.width + 0.1) {
      tMin = ty;
      hit = { x: px, y: dy > 0 ? bounds.y + bounds.height : bounds.y };
    }
  }

  return {
    x: Math.round(hit.x * 10) / 10,
    y: Math.round(hit.y * 10) / 10,
  };
}

export function solveConnectorEndpoints(
  fromElem: SolvedElement,
  toElem: SolvedElement
): { fromPoint: Point2D; toPoint: Point2D } {
  const fc = { x: fromElem.x, y: fromElem.y };
  const tc = { x: toElem.x, y: toElem.y };

  let fromPoint: Point2D;
  if (fromElem.element.type === "shape" && (fromElem.element.shapeType === "ellipse" || fromElem.element.shapeType === "circle")) {
    fromPoint = rayCastEllipse(fc.x, fc.y, fromElem.width / 2, fromElem.height / 2, tc.x, tc.y);
  } else {
    fromPoint = rayCastRect(fc.x, fc.y, fromElem.bounds, tc.x, tc.y);
  }

  let toPoint: Point2D;
  if (toElem.element.type === "shape" && (toElem.element.shapeType === "ellipse" || toElem.element.shapeType === "circle")) {
    toPoint = rayCastEllipse(tc.x, tc.y, toElem.width / 2, toElem.height / 2, fc.x, fc.y);
  } else {
    toPoint = rayCastRect(tc.x, tc.y, toElem.bounds, fc.x, fc.y);
  }

  return { fromPoint, toPoint };
}

export function solveContinuousLayout(
  lessonInput: ContinuousLesson,
  measuredSizes?: Map<string, ElementDimensions>
): SolvedLayout {
  // Validate lesson first; auto-repair if errors exist to prevent crashes
  const validation = validateContinuousLesson(lessonInput);
  const lesson = validation.valid ? lessonInput : repairContinuousLesson(lessonInput);

  const solvedElements = new Map<string, SolvedElement>();
  const solvedConnectors = new Map<string, SolvedConnector>();

  let currentMaxY = 0;
  let rootCount = 0;

  // Chronological solve: elements and connectors solved in exact draw order
  for (const step of lesson.steps) {
    for (const op of step.ops) {
      if (op.op !== "DRAW") continue;
      const el = op.element;

      if (el.type === "connector") {
        // Gap 1 Fix: Verify connector endpoints have already been placed chronologically
        const fromElem = solvedElements.get(el.from);
        const toElem = solvedElements.get(el.to);

        if (!fromElem || !toElem) {
          console.warn(
            `[LayoutSolver] Skipping connector "${el.id}" because endpoints were not drawn yet: from="${el.from}" (solved: ${Boolean(
              fromElem
            )}), to="${el.to}" (solved: ${Boolean(toElem)})`
          );
          continue;
        }

        const { fromPoint, toPoint } = solveConnectorEndpoints(fromElem, toElem);
        solvedConnectors.set(el.id, {
          id: el.id,
          fromId: el.from,
          toId: el.to,
          fromPoint,
          toPoint,
          label: el.label,
          color: el.color,
          style: el.style,
          element: el,
        });
        continue;
      }

      // Shape / Text / Latex
      const dims = measuredSizes?.get(el.id) ?? estimateDimensions(el);
      const width = Math.round(dims.width);
      const height = Math.round(dims.height);

      let cx = 500;
      let cy = 200;

      if (el.placement.type === "root") {
        rootCount++;
        if (rootCount === 1) {
          cx = el.placement.x ?? 500;
          cy = el.placement.y ?? 200;
        } else {
          // Rule 8: Subsequent root goes below the current bottom of the board
          cx = el.placement.x ?? 500;
          cy = Math.max(currentMaxY + 90 + Math.round(height / 2), el.placement.y ?? 0);
        }

        // Verify root doesn't collide with any prior root or element
        let candidateBounds: Rect2D = {
          x: cx - Math.round(width / 2),
          y: cy - Math.round(height / 2),
          width,
          height,
        };

        for (const [, existing] of solvedElements) {
          if (checkAABBOverlap(candidateBounds, existing.bounds, 16)) {
            cy = existing.bounds.y + existing.bounds.height + 60 + Math.round(height / 2);
            candidateBounds.y = cy - Math.round(height / 2);
          }
        }
      } else if (el.placement.type === "relative") {
        const parent = solvedElements.get(el.placement.relativeTo);
        if (!parent) {
          // Fallback safely to root below currentMaxY rather than throwing
          cx = 500;
          cy = currentMaxY + 90 + Math.round(height / 2);
        } else {
          const offset = OFFSET_PX[el.placement.offset ?? "md"];
          const pos = el.placement.position;

          switch (pos) {
            case "above":
              cx = parent.x;
              cy = parent.bounds.y - offset - Math.round(height / 2);
              break;
            case "below":
              cx = parent.x;
              cy = parent.bounds.y + parent.bounds.height + offset + Math.round(height / 2);
              break;
            case "left":
              cx = parent.bounds.x - offset - Math.round(width / 2);
              cy = parent.y;
              break;
            case "right":
              cx = parent.bounds.x + parent.bounds.width + offset + Math.round(width / 2);
              cy = parent.y;
              break;
            case "above-left":
              cx = parent.bounds.x - Math.round(offset * 0.8) - Math.round(width / 2);
              cy = parent.bounds.y - Math.round(offset * 0.8) - Math.round(height / 2);
              break;
            case "above-right":
              cx = parent.bounds.x + parent.bounds.width + Math.round(offset * 0.8) + Math.round(width / 2);
              cy = parent.bounds.y - Math.round(offset * 0.8) - Math.round(height / 2);
              break;
            case "inside":
              cx = parent.x;
              cy = parent.y;
              break;
            case "below-aligned-eq": {
              cy = parent.bounds.y + parent.bounds.height + offset + Math.round(height / 2);
              const parentDims = measuredSizes?.get(parent.id) ?? estimateDimensions(parent.element);
              const parentEqRelX = parentDims.eqRelX ?? parentDims.width * 0.5;
              const childEqRelX = dims.eqRelX ?? width * 0.5;
              const parentEqAbsX = parent.bounds.x + parentEqRelX;
              cx = Math.round(parentEqAbsX - childEqRelX + width / 2);
              break;
            }
          }

          // Collision pushing: push outwards along relative direction
          if (pos !== "inside") {
            let candidateBounds: Rect2D = {
              x: cx - Math.round(width / 2),
              y: cy - Math.round(height / 2),
              width,
              height,
            };

            let pushAttempts = 0;
            const maxPushAttempts = 12;

            while (pushAttempts < maxPushAttempts) {
              let collided = false;
              for (const [, existing] of solvedElements) {
                if (existing.id === parent.id) continue;
                if (checkAABBOverlap(candidateBounds, existing.bounds, 16)) {
                  collided = true;
                  // Push outward along direction vector
                  if (pos.includes("right")) cx += 28;
                  if (pos.includes("left")) cx -= 28;
                  if (pos.includes("below") || pos === "below-aligned-eq") cy += 28;
                  if (pos.includes("above")) cy -= 28;

                  candidateBounds = {
                    x: cx - Math.round(width / 2),
                    y: cy - Math.round(height / 2),
                    width,
                    height,
                  };
                  break;
                }
              }
              if (!collided) break;
              pushAttempts++;
            }
          }
        }
      }

      // Clean integer rounding consistency: bounds and center agree 100%
      const boundsX = Math.round(cx - width / 2);
      const boundsY = Math.round(cy - height / 2);
      const bounds: Rect2D = {
        x: boundsX,
        y: boundsY,
        width,
        height,
      };

      const solved: SolvedElement = {
        id: el.id,
        x: boundsX + Math.round(width / 2),
        y: boundsY + Math.round(height / 2),
        width,
        height,
        bounds,
        element: el,
      };

      solvedElements.set(el.id, solved);
      currentMaxY = Math.max(currentMaxY, bounds.y + bounds.height);
    }
  }

  // Calculate global bounding box
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const [, el] of solvedElements) {
    minX = Math.min(minX, el.bounds.x);
    minY = Math.min(minY, el.bounds.y);
    maxX = Math.max(maxX, el.bounds.x + el.bounds.width);
    maxY = Math.max(maxY, el.bounds.y + el.bounds.height);
  }

  for (const [, conn] of solvedConnectors) {
    minX = Math.min(minX, conn.fromPoint.x, conn.toPoint.x);
    minY = Math.min(minY, conn.fromPoint.y, conn.toPoint.y);
    maxX = Math.max(maxX, conn.fromPoint.x, conn.toPoint.x);
    maxY = Math.max(maxY, conn.fromPoint.y, conn.toPoint.y);
  }

  if (minX === Infinity) {
    minX = 0;
    minY = 0;
    maxX = 1000;
    maxY = 700;
  }

  return {
    elements: solvedElements,
    connectors: solvedConnectors,
    bounds: {
      minX: Math.round(minX),
      minY: Math.round(minY),
      maxX: Math.round(maxX),
      maxY: Math.round(maxY),
      width: Math.round(maxX - minX),
      height: Math.round(maxY - minY),
    },
  };
}
