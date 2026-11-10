export interface Camera {
  x: number;
  y: number;
  scale: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Viewport {
  width?: number;
  height?: number;
  w?: number;
  h?: number;
}

export interface Point {
  x: number;
  y: number;
}

export const MIN_SCALE = 0.5;
export const MAX_SCALE = 2.0;

/**
 * Keeps targetRect in view, about 1/3 of the way down from the top and horizontally centered.
 */
export function followCamera(targetRect: Rect, viewport: Viewport, scale: number = 1): Camera {
  const vw = viewport.width ?? viewport.w ?? 1000;
  const vh = viewport.height ?? viewport.h ?? 700;
  const currentScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));

  const targetScreenX = (vw - targetRect.w * currentScale) / 2;
  const targetScreenY = vh / 3;

  const x = targetScreenX - targetRect.x * currentScale;
  const y = targetScreenY - targetRect.y * currentScale;

  return { x, y, scale: currentScale };
}

/**
 * Zooms around the pointer position in viewport coordinates.
 * Scale is clamped to [0.5, 2.0].
 * Mathematically keeps the world coordinate directly under the cursor invariant.
 */
export function zoomAt(cam: Camera, pointer: Point, delta: number): Camera {
  const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, cam.scale + delta));

  // World coordinates under pointer before zoom
  const wx = (pointer.x - cam.x) / cam.scale;
  const wy = (pointer.y - cam.y) / cam.scale;

  // New camera origin to keep wx, wy at pointer.x, pointer.y
  const x = pointer.x - wx * newScale;
  const y = pointer.y - wy * newScale;

  return { x, y, scale: newScale };
}

/**
 * Pans camera by delta screen pixels.
 */
export function panBy(cam: Camera, dx: number, dy: number): Camera {
  return {
    x: cam.x + dx,
    y: cam.y + dy,
    scale: cam.scale,
  };
}

/**
 * Centres the camera on a given block.
 */
export function locate(blockRect: Rect, viewport: Viewport, cam?: Camera): Camera {
  const currentScale = cam?.scale ?? 1;
  const vw = viewport.width ?? viewport.w ?? 1000;
  const vh = viewport.height ?? viewport.h ?? 700;

  const blockCenterX = blockRect.x + blockRect.w / 2;
  const blockCenterY = blockRect.y + blockRect.h / 2;

  const viewCenterX = vw / 2;
  const viewCenterY = vh / 2;

  const x = viewCenterX - blockCenterX * currentScale;
  const y = viewCenterY - blockCenterY * currentScale;

  return { x, y, scale: currentScale };
}

