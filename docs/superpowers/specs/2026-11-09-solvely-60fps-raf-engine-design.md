# Solvely 60fps rAF Animation Engine & High-Fidelity Whiteboard Design Doc

**Date:** 2026-11-09  
**Status:** Approved by User  
**Author:** Staff Systems Architect & Antigravity Pair  
**Reference:** `solvely-findings.md` (Sections A3, A4, B1, B2, B4, C3, C6)

---

## 1. Intent & Problem Statement

Currently, whiteboard animation timing in the player is driven by HTMLMediaElement `ontimeupdate`, which only triggers every ~250ms (4 fps). Consequently, characters reveal in discrete 4-5 letter chunks, and stroke dashoffsets step coarsely rather than flowing at display refresh rate.

In `solvely-findings.md`, Solvely achieves its liquid handwriting and sketching aesthetic through a **60.0 fps `requestAnimationFrame` animation loop** (`ne += Math.max(0, C - P) * i.value`), **58ms/grapheme cluster typing pacing**, **progressive KaTeX math clipping**, **floating pen sprite glide physics**, and **`WholeNoteHighlighter` sweep animations**.

---

## 2. Architecture & Subsystems

### 2.1. 60fps Master Clock Interpolation (`useLessonPlayer.ts`)
- Master reference: `audio.currentTime * 1000`.
- Continuous sub-frame interpolation:
  $$\text{elapsedMs} = \text{audioTimeMs} + (\text{performance.now()} - \text{lastAudioTick}) \times \text{speed}$$
  Clamped to $[\text{audioTimeMs}, \text{audioTimeMs} + 350]$ to prevent drift during audio buffering.
- Runs via `requestAnimationFrame` while `playing === true`; halts instantly on `pause`.

### 2.2. `AnimatedBoardText` (`AnimatedBoardText.tsx`)
- Pacing: 58ms per grapheme cluster via `Intl.Segmenter` (min 700ms, max 8000ms).
- Math reveal: Full KaTeX tree rendered into DOM, with progressive horizontal reveal using CSS clip-path:
  `clipPath: inset(0 calc(100% - ${progress * 100}%) 0 0)`.
- Live pen tip: Calculates character head position `(rect.left + rect.width * progress, rect.top + rect.height * 0.78)` and emits to stylus coordinator.

### 2.3. `AnimatedVector` 60fps Smoothing (`AnimatedVector.tsx`)
- Sub-frame progress $P = \text{clamp}((\text{elapsedMs} - \text{startMs}) / \text{durationMs}, 0, 1)$.
- Unconstrained 60fps update: `strokeDashoffset: pathLen * (1 - P)` with `transition: none`.
- Reports active stroke tip `path.getPointAtLength(pathLen * P)` continuously to stylus coordinator.

### 2.4. `WholeNoteHighlighter` (`WholeNoteHighlighter.tsx`)
- Renders an authentic highlighter stroke sweeping across text:
  - Yellow/orange translucent ink (`rgba(254, 240, 138, 0.45)`).
  - Sweeps width from `0%` to `100%` during highlight duration.
  - Sits underneath text with `mix-blend-mode: multiply`.

### 2.5. Stylus Physics & Gliding (`VirtualStylus.tsx`)
- Tracks active target coordinate with smooth CSS easing (`transition: transform 0.12s cubic-bezier(0.2, 0.8, 0.3, 1)`).
- Pen lifts and fades when inactive; touches down and glows when actively sketching.

---

## 3. Verification Criteria
- `npx tsc --noEmit` exits 0.
- All unit tests pass (`node --test --experimental-strip-types lib/**/*.test.ts`).
- Browser verification:
  - Text reveals continuously at 60fps with zero 250ms stepping.
  - Math formulas unmask smoothly with horizontal clip reveal.
  - Diagram strokes sketch with 60fps fluid stroke-dashoffset.
  - Stylus glides and follows active drawing tips seamlessly.

