# Vector Drawing Engine & Diagram Framing Specification (Approach A)

**Date:** 2026-11-10  
**Status:** In Review  
**Author:** Antigravity Pair & Systems Architect  
**Scope:** `AnimatedVector.tsx`, `lib/liveboard/vectorProgress.ts`, `lib/liveboard/vectorProgress.test.ts`, `LiveBoard.tsx`

---

## 1. Intent & Problem Statement

Currently, whiteboard diagram animations suffer from two visual defects:
1. **Stroke Dashoffset Warping:** In `shapes.tsx`, every stroke geometry has `pathLength: 1`. In `AnimatedVector.tsx`, dashoffset was computed using raw pixel lengths (e.g. 350px), causing the browser to cycle dash patterns 350 times and snap/flicker rather than drawing smoothly.
2. **Text Label Truncation:** In `vectorProgress.ts`, `getShapesViewBox` estimated text bounds using a static $\pm 50\text{px}$ offset. A 20-character label at 24px font requires ~240px, causing the SVG viewBox to clip start and end letters (e.g., `"The Water Cycle"` truncated to `"The Wat"`).

---

## 2. Technical Design

### 2.1. Native SVG `pathLength="1"` Normalization (`AnimatedVector.tsx`)
- All stroke elements produced by `shapes.tsx` (`line`, `arrow`, `circle`, `ellipse`, `rect`, `path`, `highlight`) carry `pathLength: 1`.
- When animating ($0 < P < 1$):
  - Set `strokeDasharray: 1.05`
  - Set `strokeDashoffset: 1.05 * (1 - P)`
  - Set `transition: "none"`
  - When $P \ge 1$: reset `strokeDasharray: "none"` and `strokeDashoffset: "none"`.
- For arrows:
  - Sequence shaft sketching from $P \in [0, 0.75]$.
  - Sequence head sketching from $P \in [0.75, 1.0]$.
- For text, labels, and icons:
  - Opacity scales smoothly: `opacity: Math.min(1, P * 2)`.

### 2.2. Dynamic Text Bounding Box in `getShapesViewBox` (`lib/liveboard/vectorProgress.ts`)
- Replace fixed 50px text offset with character-length based calculation:
  $$\text{halfWidth} = \max\left(60, \frac{(\text{s.text.length} \times (\text{s.size} \lor 22) \times 0.65)}{2}\right) + 20$$
  $$\min X = \min(\min X, s.x - \text{halfWidth}), \quad \max X = \max(\max X, s.x + \text{halfWidth})$$
- Ensures zero label clipping across all diagram types.

### 2.3. Precision Stylus Contact Point
- Query active path element, compute `pt = path.getPointAtLength(totalLength * P)`.
- Emit $(pt.x, pt.y)$ to `<SvgVirtualStylus>` rendered directly inside the `<svg viewBox={vb.viewBox}>`.
- The orange stylus contact dot glides precisely at the growing tip of the stroke.

---

## 3. Verification Criteria
- `npx tsc --noEmit` exits 0.
- `node --test --experimental-strip-types lib/liveboard/vectorProgress.test.ts` passes with new label bounding box tests.
- All unit tests pass (`node --test --experimental-strip-types lib/**/*.test.ts`).
- Browser verification on port 3000:
  - Diagram strokes draw smoothly from 0% to 100% without flickering or snapping.
  - Labels are completely visible without truncation.
  - Stylus sprite glides in sync with the active stroke.

