# Solvely 60fps rAF Animation Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Solvely's high-fidelity 60fps rAF animation engine: sub-frame clock interpolation, 58ms/grapheme typing cadence, progressive KaTeX horizontal math clipping, 60fps vector stroke sketching, `WholeNoteHighlighter` sweeps, and gliding stylus physics.

**Architecture:** Drive the active step's elapsed time via a `requestAnimationFrame` interpolation loop in `useLessonPlayer.ts`. Create `AnimatedBoardText` to handle smooth character & formula reveals. Enhance `AnimatedVector` with continuous 60fps stroke updates. Create `WholeNoteHighlighter` for translucent marker sweeps. Update `LiveBoard.tsx` to orchestrate stylus gliding.

**Tech Stack:** React 19, TypeScript, requestAnimationFrame, Intl.Segmenter, KaTeX, CSS Clip-path, Node.js Test Runner.

**Spec:** `docs/superpowers/specs/2026-11-09-solvely-60fps-raf-engine-design.md`

## Global Constraints
- Preserve append-only multi-column flow and open canvas layout.
- No new third-party dependencies (`katex` is already installed).
- `npx tsc --noEmit` and all unit tests must pass after each task.

## Review Focus
1. Audio pause immediately freezes rAF interpolation without drift.
2. Speed toggle (e.g. 1.5x) scales rAF frame delta proportionally.
3. KaTeX formulas render without layout shifts during progressive horizontal unmasking.
4. Highlighter sweeps don't obscure text readability (`mix-blend-mode: multiply`).
5. Stylus doesn't jump abruptly between disparate screen coordinates.

---

### Task 1: 60fps Sub-frame Clock Interpolator in `useLessonPlayer.ts`

**Files:**
- Create: `lib/liveboard/clockInterpolator.ts`
- Create: `lib/liveboard/clockInterpolator.test.ts`
- Modify: `app/home/whiteboard-tutor/useLessonPlayer.ts`

- [x] **Step 1: Write the failing test for clock interpolator**
  Test `interpolateClock(lastAudioMs, lastTickT, nowT, speed, maxDriftMs)` returning interpolated ms clamped against drift.
- [x] **Step 2: Run test to watch it fail**
  `node --test --experimental-strip-types lib/liveboard/clockInterpolator.test.ts`
- [x] **Step 3: Implement `lib/liveboard/clockInterpolator.ts`**
  Implement pure interpolation logic.
- [x] **Step 4: Verify test passes**
  `node --test --experimental-strip-types lib/liveboard/clockInterpolator.test.ts`
- [x] **Step 5: Integrate rAF interpolation loop in `useLessonPlayer.ts`**
  Update `useLessonPlayer` to run `requestAnimationFrame` while `playing` is true, emitting 60fps `stepElapsedMs`.

---

### Task 2: Smooth Text & Math Reveal (`AnimatedBoardText.tsx`)

**Files:**
- Create: `lib/liveboard/textPacing.ts`
- Create: `lib/liveboard/textPacing.test.ts`
- Create: `app/home/whiteboard-tutor/AnimatedBoardText.tsx`

- [x] **Step 1: Write the failing test for 58ms grapheme pacing**
  Test `calcTextRevealUnits(graphemeCount, elapsedMs, speed)` and `calcMathClipPercent(elapsedMs, durationMs)`.
- [x] **Step 2: Run test to watch it fail**
  `node --test --experimental-strip-types lib/liveboard/textPacing.test.ts`
- [x] **Step 3: Implement `lib/liveboard/textPacing.ts`**
  Implement grapheme counting and reveal progress calculation.
- [x] **Step 4: Verify test passes**
  `node --test --experimental-strip-types lib/liveboard/textPacing.test.ts`
- [x] **Step 5: Implement `app/home/whiteboard-tutor/AnimatedBoardText.tsx`**
  Render text and progressive KaTeX horizontal reveal with CSS clip-path.

---

### Task 3: Translucent Highlighter Sweeps (`WholeNoteHighlighter.tsx`)

**Files:**
- Create: `app/home/whiteboard-tutor/WholeNoteHighlighter.tsx`

- [x] **Step 1: Create `WholeNoteHighlighter.tsx`**
  Component rendering a translucent colored marker bar sweeping horizontally across text (`width: ${progress * 100}%`, `mix-blend-mode: multiply`).
- [x] **Step 2: Typecheck**
  `npx tsc --noEmit`

---

### Task 4: Gliding Stylus Physics & LiveBoard Integration

**Files:**
- Modify: `app/home/whiteboard-tutor/LiveBoard.tsx`

- [x] **Step 1: Integrate `AnimatedBoardText` into `BlockItem`**
  Replace raw transcript slice with `<AnimatedBoardText>` in `BlockItem`.
- [x] **Step 2: Add highlighter support for emphasized concepts**
  Mount `<WholeNoteHighlighter>` on active key terms.
- [x] **Step 3: Add stylus glide physics**
  Smoothly interpolate stylus position between text baseline and diagram stroke tips.
- [x] **Step 4: Run typecheck and full test suite**
  `npx tsc --noEmit`
  `node --test --experimental-strip-types lib/**/*.test.ts`

---

### Task 5: End-to-End Browser Verification

- [x] **Step 1: Verify 60fps smoothness in browser**
  Audit handwriting, KaTeX unmasking, and stroke drawing on port 3000.
- [x] **Step 2: Run final gate checks**
  Run `npx tsc --noEmit`, test suite, and check diff.
