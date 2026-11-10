/**
 * Pure functions for virtual stylus coordinate boundaries and calculations.
 */

export interface Point {
  x: number;
  y: number;
}

export interface Bounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export function clampStylusPosition(pt: Point, bounds: Bounds): Point {
  return {
    x: Math.max(bounds.minX, Math.min(bounds.maxX, pt.x)),
    y: Math.max(bounds.minY, Math.min(bounds.maxY, pt.y)),
  };
}

