/**
 * Pure helper functions for vector stroke timing and dashoffset calculations.
 */

export function calcCommandProgress(
  elapsedMs: number,
  startMs: number,
  durationMs: number
): number {
  if (durationMs <= 0) return 1.0;
  if (elapsedMs <= startMs) return 0.0;
  if (elapsedMs >= startMs + durationMs) return 1.0;
  return (elapsedMs - startMs) / durationMs;
}

export function calcStrokeDashoffset(pathLength: number, progress: number): number {
  const clampedProgress = Math.max(0, Math.min(1, progress));
  return pathLength * (1 - clampedProgress);
}

export function getShapesViewBox(shapes: any[]): {
  minX: number;
  minY: number;
  width: number;
  height: number;
  viewBox: string;
} {
  if (!shapes || shapes.length === 0) {
    return { minX: 0, minY: 0, width: 1000, height: 700, viewBox: "0 0 1000 700" };
  }
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;

  for (const s of shapes) {
    if (!s) continue;
    if (s.from && s.to) {
      minX = Math.min(minX, s.from[0], s.to[0]);
      maxX = Math.max(maxX, s.from[0], s.to[0]);
      minY = Math.min(minY, s.from[1], s.to[1]);
      maxY = Math.max(maxY, s.from[1], s.to[1]);
    } else if (s.r !== undefined && s.x !== undefined && s.y !== undefined) {
      minX = Math.min(minX, s.x - s.r);
      maxX = Math.max(maxX, s.x + s.r);
      minY = Math.min(minY, s.y - s.r);
      maxY = Math.max(maxY, s.y + s.r);
    } else if (s.rx !== undefined && s.ry !== undefined && s.x !== undefined && s.y !== undefined) {
      minX = Math.min(minX, s.x - s.rx);
      maxX = Math.max(maxX, s.x + s.rx);
      minY = Math.min(minY, s.y - s.ry);
      maxY = Math.max(maxY, s.y + s.ry);
    } else if (s.w !== undefined && s.h !== undefined && s.x !== undefined && s.y !== undefined) {
      minX = Math.min(minX, s.x);
      maxX = Math.max(maxX, s.x + s.w);
      minY = Math.min(minY, s.y);
      maxY = Math.max(maxY, s.y + s.h);
    } else if (s.x !== undefined && s.y !== undefined) {
      const textLen = typeof s.text === "string" ? s.text.length : 10;
      const fontSize = typeof s.size === "number" ? s.size : 22;
      const halfW = Math.max(60, (textLen * fontSize * 0.65) / 2);
      const halfH = Math.max(30, fontSize * 1.2);
      minX = Math.min(minX, s.x - halfW);
      maxX = Math.max(maxX, s.x + halfW);
      minY = Math.min(minY, s.y - halfH);
      maxY = Math.max(maxY, s.y + halfH);
    }
  }

  if (!Number.isFinite(minX) || !Number.isFinite(maxX)) {
    return { minX: 0, minY: 0, width: 1000, height: 700, viewBox: "0 0 1000 700" };
  }

  // Add padding around shapes so strokes and labels never get cut off
  const pad = 40;
  const clampedMinX = Math.max(0, Math.floor(minX - pad));
  const clampedMinY = Math.max(0, Math.floor(minY - pad));
  const clampedMaxX = Math.min(1000, Math.ceil(maxX + pad));
  const clampedMaxY = Math.min(700, Math.ceil(maxY + pad));

  const width = Math.max(200, clampedMaxX - clampedMinX);
  const height = Math.max(120, clampedMaxY - clampedMinY);

  return {
    minX: clampedMinX,
    minY: clampedMinY,
    width,
    height,
    viewBox: `${clampedMinX} ${clampedMinY} ${width} ${height}`,
  };
}

