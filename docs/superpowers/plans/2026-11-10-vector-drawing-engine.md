# Vector Drawing Engine & Diagram Framing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Approach A: Fix SVG stroke dashoffset animation via native `pathLength="1"` normalization, sequence arrowheads, eliminate label truncation via dynamic text bounding boxes in `getShapesViewBox`, and ensure precision stylus gliding.

**Architecture:** Update `getShapesViewBox` in `lib/liveboard/vectorProgress.ts` with font/length-aware bounding boxes. Update `AnimatedVector.tsx` to drive `strokeDasharray: 1.05` / `strokeDashoffset: 1.05 * (1 - P)` without raw pixel mismatch.

**Spec:** `docs/superpowers/specs/2026-11-10-vector-drawing-engine-design.md`

## Global Constraints
- Do NOT touch `shapes.tsx`, `eval/`, `lib/continuous/`, `lib/engine/`, `lib/layout/`, `lib/manifest.ts`, `lib/board.ts`, `lib/llm.ts`, `app/api/**`.
- No new dependencies.
- `npx tsc --noEmit` and all unit tests must pass after each task.

---

### Task 1: Dynamic Text Bounding Boxes in `vectorProgress.ts`

**Files:**
- Modify: `lib/liveboard/vectorProgress.test.ts`
- Modify: `lib/liveboard/vectorProgress.ts`

- [x] **Step 1: Write failing test for long text label bounding boxes**
  In `vectorProgress.test.ts`, assert that a label with text "Understanding the Water Cycle" at $x=500, y=100$ produces a viewBox wide enough to encompass the full rendered string ($\ge 250\text{px}$ span around $x=500$), not clipped to $\pm 50\text{px}$.
- [x] **Step 2: Run test to watch it fail**
  `node --test --experimental-strip-types lib/liveboard/vectorProgress.test.ts`
- [x] **Step 3: Implement dynamic text bounding box in `lib/liveboard/vectorProgress.ts`**
  Compute `halfWidth = Math.max(60, ((s.text?.length || 10) * (s.size || 22) * 0.65) / 2) + 20` for text and label shapes.
- [x] **Step 4: Verify test passes**
  `node --test --experimental-strip-types lib/liveboard/vectorProgress.test.ts`

---

### Task 2: Native `pathLength="1"` Stroke Drawing in `AnimatedVector.tsx`

**Files:**
- Modify: `app/home/whiteboard-tutor/AnimatedVector.tsx`

- [x] **Step 1: Refactor stroke dashoffset logic for `pathLength="1"`**
  When animating ($0 < P < 1$), apply:
  - `strokeDasharray: 1.05`
  - `strokeDashoffset: Math.max(0, 1.05 * (1 - clampedProgress))`
  - `transition: "none"`
  When $P \ge 1$, clear dash properties.
- [x] **Step 2: Sequence arrow shapes (shaft first, head second)**
  For arrow shapes, split progress so the shaft sketches during $0 \le P \le 0.75$, and the head sketches during $0.75 < P \le 1.0$.
- [x] **Step 3: Smooth label and icon reveal**
  Non-stroke shapes fade in smoothly: `opacity: Math.min(1, clampedProgress * 2)`.
- [x] **Step 4: Verify typecheck**
  `npx tsc --noEmit`

---

### Task 3: Verification & Browser Audit

- [x] **Step 1: Run full test suite**
  `node --test --experimental-strip-types lib/**/*.test.ts`
- [x] **Step 2: Browser verification on port 3000**
  Verify diagram strokes sketch without flickering, labels are fully visible without truncation, and the stylus dot glides along the curve.
