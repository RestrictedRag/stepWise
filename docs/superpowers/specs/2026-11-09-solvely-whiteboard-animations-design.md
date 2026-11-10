# Solvely Whiteboard Animations & Open Canvas Design Doc

**Date:** 2026-11-09  
**Status:** Ready for Review  
**Author:** Staff Systems Architect & Antigravity Pair  
**Reference:** `solvely-findings.md` (Sections A1–A4, B1–B4, C3–C6, D1–D4)

---

## 1. Intent & Problem Statement

In the recent player refactor to a live append-only DOM model, the player successfully gained user-controlled camera transforms, multi-column navigation, and transcript locating. However, it lost Solvely's signature whiteboard animation aesthetic:
1. Diagram strokes are statically dumped without `stroke-dashoffset` path-drawing animation.
2. The virtual stylus / pen sprite that traced the active drawing head was deleted.
3. Spoken pedagogical monologues were dumped onto the board inside heavy bordered cards with shadows, and diagrams were cramped inside a `500×240` dashed box.

In `solvely-findings.md`, Solvely is an **open, borderless whiteboard canvas** where spoken banter is confined to audio/captions, and the whiteboard contains clean, progressive handwritten notes, KaTeX equations, and animated SVG strokes with a floating pen sprite.

---

## 2. Goals, Non-Goals & Anti-Goals

### Goals
- **Open Canvas Aesthetic:** Eliminate card borders, white card backgrounds, and dashed SVG boxes. The whiteboard surface is continuous and borderless.
- **Progressive Vector Stroke Animation:** SVG strokes (lines, arrows, ellipses, rects, paths) sketch progressively using `stroke-dasharray` and `stroke-dashoffset` driven by step timing (`cmd.startMs`, `cmd.durationMs`).
- **Active Pen / Stylus Sprite:** Display a floating stylus sprite tracing the active drawing tip during stroke animation and progressive text reveal.
- **Clean Content Separation:** The board displays structured visual commands (titles, equations, bulleted givens, diagrams) rather than raw conversational monologue.
- **Maintain Performance & Determinism:** All animations run cleanly at 60fps via CSS / rAF without reflowing already-placed blocks.

### Non-Goals
- Reintroducing a global seek scrubber or video-timeline playback engine.
- Reintroducing element erasures or destructive scene clearing.

### Anti-Goals
- Do NOT shrink or squeeze diagrams into fixed aspect ratio dashed boxes.
- Do NOT block audio on SVG path measurements.

---

## 3. Approaches Considered & Trade-offs

### Approach 1: Full Solvely Architecture Match (Chosen)
- Open whiteboard surface without card wrappers.
- Diagram strokes rendered as `<AnimatedVector>` with `strokeDasharray` / `strokeDashoffset`.
- Floating stylus sprite following `getPointAtLength` during active stroke drawing.
- Spoken dialogue in audio/captions; board displays structured visual notes and diagrams.
- **Trade-off:** Requires removing the boxed card styling from `LiveBoard.tsx` and updating `shapes.tsx` / `AnimatedVector` component.

### Approach 2: Animated Cards (Rejected)
- Keeps the rounded cards with borders and shadows; adds stroke animations inside each card.
- **Why Rejected:** Violates `solvely-findings.md` Section D1 & D4. Still feels like a list of blog cards rather than a real whiteboard tutor, and diagrams remain constrained.

---

## 4. Architectural & Component Specification

### 4.1. Open Whiteboard Layout (`LiveBoard.tsx`)
- Container: `.agent-board-column` (width 528px, gap 48px).
- Block styling:
  - Background: transparent.
  - Border: none (no 1px line, no dashed boxes).
  - Box-shadow: none.
  - Typography: clean Inter / KaTeX formulas.
- SVG Canvas per block:
  - Full column width (528px), dynamic height based on diagram bounds.
  - `overflow: visible` to allow natural annotations and labels.

### 4.2. Stroke Sketch Animation (`AnimatedVector.tsx`)
For each `DRAW` command:
- Geometry elements (`path`, `line`, `circle`, `rect`, `ellipse`) are measured via `getTotalLength()` upon mount.
- Local command progress:
  $$P_{\text{cmd}} = \text{clamp}\left(\frac{\text{elapsedMs} - \text{cmd.startMs}}{\text{cmd.durationMs}}, 0, 1\right)$$
- If step is complete or rehydrating (`elapsedMs >= durationMs`): $P_{\text{cmd}} = 1.0$.
- Path stroke styling:
  ```css
  stroke-dasharray: ${pathLen};
  stroke-dashoffset: ${pathLen * (1 - P_cmd)};
  transition: none;
  ```

### 4.3. Virtual Stylus Sprite (`VirtualStylus.tsx`)
- Rendered in active block coordinate space or global world overlay.
- Position $(x, y)$:
  - During stroke draw: calculated via `path.getPointAtLength(pathLen * P_cmd)`.
  - During text reveal: calculated at active character head.
- Visual: Stylus tip with subtle glowing pen dot (`var(--ink-orange, #e67e22)`).
- Opacity: 1 when active; fades to 0 when idle.

### 4.4. Content Separation (`LiveBoard.tsx` / `useLessonPlayer.ts`)
- The active step's full conversational transcript continues driving the bottom bar caption.
- On the board itself, display:
  - Step title / section header (if present).
  - Formulas and notes explicitly emitted by the visual planner.
  - Diagram visual shapes.
  - Checkpoint question cards (if present).

---

## 5. Verification Gate
- `npx tsc --noEmit` exits 0.
- All unit tests pass (`node --test --experimental-strip-types lib/**/*.test.ts`).
- Browser verification:
  - Vector shapes draw smoothly with stroke-dashoffset animation.
  - Pen sprite traces active strokes.
  - Open whiteboard appearance (no card borders/shadows/dashed boxes).
  - Monotonic block accumulation preserved across all steps.

