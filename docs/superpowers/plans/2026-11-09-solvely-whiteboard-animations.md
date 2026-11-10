# Solvely Whiteboard Animations & Open Canvas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore Solvely's open whiteboard canvas aesthetic, progressive vector stroke sketching (`stroke-dashoffset`), floating stylus sprite tracking, and clean content separation on the live interactive whiteboard.

**Architecture:** Replace the cramped card-based and dashed-box block containers with an open whiteboard layout. Synchronize vector stroke animations (`stroke-dashoffset`) with audio playback timestamps (`cmd.startMs`, `cmd.durationMs`) via an `AnimatedVector` component. Track active drawing heads with a `VirtualStylus` sprite component. Keep spoken monologue in captions while displaying structured formulas and diagrams on the whiteboard.

**Tech Stack:** React 19, TypeScript, SVG Path Length APIs, CSS 3D Transforms, KaTeX, Node.js Test Runner.

**Spec:** `docs/superpowers/specs/2026-11-09-solvely-whiteboard-animations-design.md`

## Global Constraints
- Strictly obey DO-NOT-TOUCH files outside the whiteboard tutor player scope.
- Maintain append-only multi-column flow ($x = n \times 628\text{px}$, 528px width, 48px gap).
- Never reintroduce global seek bars or timeline scrubbers.
- `npx tsc --noEmit` and test suite must pass cleanly after each task.

## Review Focus
1. Paths with zero length or unmeasurable SVG geometry don't crash and default to instant visibility.
2. Rehydration / finished steps render at 100% progress immediately without replay lag.
3. Rapid pause / resume toggling freezes stroke animation cleanly in place.
4. Stylus coordinate clamping prevents jumping off-screen when shapes are at column edges.
5. Zoom / pan gestures remain responsive during active stroke animation.

---

### Task 1: Vector Stroke Progress & Animation Logic (`lib/liveboard/vectorProgress.ts` & `AnimatedVector.tsx`)

**Files:**
- Create: `lib/liveboard/vectorProgress.ts`
- Create: `lib/liveboard/vectorProgress.test.ts`
- Create: `app/home/whiteboard-tutor/AnimatedVector.tsx`

- [ ] **Step 1: Write the failing test for stroke progress calculation**
  Test `calcCommandProgress(elapsedMs, startMs, durationMs)` clamping to $[0, 1]$ and handling zero duration.
- [ ] **Step 2: Run test to watch it fail**
  `node --test --experimental-strip-types lib/liveboard/vectorProgress.test.ts`
- [ ] **Step 3: Implement `lib/liveboard/vectorProgress.ts`**
  Implement `calcCommandProgress` and `calcStrokeDashoffset(pathLength, progress)`.
- [ ] **Step 4: Verify test passes**
  `node --test --experimental-strip-types lib/liveboard/vectorProgress.test.ts`
- [ ] **Step 5: Create `app/home/whiteboard-tutor/AnimatedVector.tsx`**
  Implement `<AnimatedVector>` component rendering SVG shapes with `strokeDasharray` and `strokeDashoffset` based on progress.

---

### Task 2: Floating Virtual Stylus Sprite (`VirtualStylus.tsx`)

**Files:**
- Create: `lib/liveboard/stylus.ts`
- Create: `lib/liveboard/stylus.test.ts`
- Create: `app/home/whiteboard-tutor/VirtualStylus.tsx`

- [ ] **Step 1: Write the failing test for stylus coordinate interpolation**
  Test `interpolateStylusPosition(pathPoints, progress)` and boundary clamping.
- [ ] **Step 2: Run test to watch it fail**
  `node --test --experimental-strip-types lib/liveboard/stylus.test.ts`
- [ ] **Step 3: Implement `lib/liveboard/stylus.ts`**
  Implement coordinate interpolation and active state detection.
- [ ] **Step 4: Verify test passes**
  `node --test --experimental-strip-types lib/liveboard/stylus.test.ts`
- [ ] **Step 5: Create `app/home/whiteboard-tutor/VirtualStylus.tsx`**
  Implement `<VirtualStylus>` with pen sprite icon and subtle orange glowing tip (`var(--ink-orange)`).

---

### Task 3: Command Elapsed Timing in `useLessonPlayer.ts`

**Files:**
- Modify: `app/home/whiteboard-tutor/useLessonPlayer.ts`

- [ ] **Step 1: Track `stepElapsedMs` in `useLessonPlayer`**
  Expose `elapsedMs: Record<string, number>` in the hook return so blocks know their exact playback elapsed milliseconds during `ontimeupdate`.
- [ ] **Step 2: Run typecheck and existing tests**
  `npx tsc --noEmit`
  `node --test --experimental-strip-types lib/**/*.test.ts`

---

### Task 4: Open Whiteboard Canvas & Live Animated Block Rendering (`LiveBoard.tsx`)

**Files:**
- Modify: `app/home/whiteboard-tutor/LiveBoard.tsx`

- [ ] **Step 1: Remove card styling and dashed boxes**
  Remove borders, backgrounds, shadows, and dashed container around diagrams. Set open whiteboard presentation.
- [ ] **Step 2: Integrate `AnimatedVector` and `VirtualStylus`**
  Render diagram shapes using `<AnimatedVector>` with elapsed timing. Position `<VirtualStylus>` at the active stroke tip.
- [ ] **Step 3: Run full typecheck and test suite**
  `npx tsc --noEmit`
  `node --test --experimental-strip-types lib/**/*.test.ts`

---

### Task 5: End-to-End Verification on Port 3000

**Files:**
- Visual audit & Playwright tests

- [ ] **Step 1: Audit in browser**
  Verify borderless open whiteboard canvas, progressive stroke sketching, and stylus tracking.
- [ ] **Step 2: Run final gate checks**
  Run `npx tsc --noEmit`, test suite, and git status.

