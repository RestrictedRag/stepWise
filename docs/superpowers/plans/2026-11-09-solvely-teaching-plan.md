# Solvely-style teaching: executor plan

Written 2026-11-09 by Claude (planner). To be executed by a different model (Gemini 3.8 Flash High in Antigravity, or any agent).
Branch: `feature/animation-engine`.

---

## 0. EXECUTOR RULES (read first, obey always)

1. **Do exactly ONE task per prompt.** The prompt names the task (for example "Do T3"). Do not start the next task.
2. **Do not design.** Every decision is already made below. If something is ambiguous, STOP and ask. Do not guess.
3. **Touch only the files listed in the task.** If you think another file must change, STOP and say which file and why.
4. **DO NOT TOUCH these files, ever** (other people's uncommitted work):
   - `app/home/whiteboard-tutor/shapes.tsx`
   - `eval/syncEval.ts`, `eval/fixtures/`
   - `lib/sketch.ts`
   - `lib/continuous/` (yes, it contains ERASE too; leave it alone)
   - `.playwright-mcp/`, `next-env.d.ts`, `evidence-bundle.json`, `solvely-findings.md`
   - `lib/llm.ts` and `app/api/solve/route.ts` (uncommitted 429 work; keep it as is)
5. **No new dependencies.** No `npm install`. KaTeX (`katex@^0.19`) is already installed.
6. **No refactors, renames, reformatting, or "cleanups"** beyond what the task says. No new abstractions.
7. **Line numbers are hints from 2026-11-09.** Find code by the quoted snippet, not the number.
8. **After every task, run and paste the output of:**
   ```
   npx tsc --noEmit
   node --test --experimental-strip-types lib/**/*.test.ts
   ```
   (If the glob fails on Windows, run each test file listed in the task explicitly.)
   Then run `git diff --stat` and paste it. Then STOP and wait.
9. **Done means:** tsc has zero errors in files you touched, all tests pass, and the "Done when" list of the task is true. If a pre-existing failure exists in a file you did not touch, report it; do not fix it.
10. **Commit only when the user says so.** Message format: `<type>(<area>): <what>` and end with a blank line plus `Co-Authored-By: Gemini <noreply@google.com>`.

---

## 1. GOAL

Lessons that teach like Solvely:
- Narration is patient and deep (explains why, not just what).
- The board shows short paraphrased notes, not the narration verbatim.
- **The board is never erased.** Nothing fades out. Content accumulates and the camera pans down.
- Text is handwritten-revealed letter by letter with a pen that moves with it.

## 2. DECISIONS (all made by Claude, the planner; marked "my call")

| # | Decision | |
|---|---|---|
| D1 | Keep the 1000 px wide world. The world grows **downward** without limit. The 1000×700 viewport pans with `transform: translate3d(0,-Ypx,0)`, `transition: transform 1s cubic-bezier(0.22,1,0.36,1)`. | my call |
| D2 | **Never erase.** Remove `ERASE` and `TRANSITION` actions from prompts, schema, pipeline, engine, validator, tests. Every `exitMs` is `Infinity`. If a diagram is "updated", the new one is drawn below; the old one stays. | my call |
| D3 | Text reveal duration = `max(700, min(8000, graphemes * 58))` ms, linear. | my call |
| D4 | Reveal progress and pen position are **monotonic** within a command (never go backward while playing forward). | my call |
| D5 | Keep Gnani aligner word timings; existing proportional fallback stays. | my call |
| D6 | Keep the precompiled lesson (whole lesson compiled before play). Streaming/SSE is a non-goal. | my call |
| D7 | Text is rendered as **DOM + KaTeX** (`lib/mathtext.ts`) revealed per grapheme with a pen sprite. | my call |
| D8 | Shapes (lines, arrows, circles) stay as SVG strokes. p5/canvas is a non-goal. | my call |
| D9 | Interactive "ask the student" pauses are a non-goal. | my call |
| D10 | `audio.preservesPitch = true` so speed changes don't chipmunk the voice. | my call |
| D11 | Slot overflow (no free slot in the blueprint) is **not an error**: place the object in the next row below the lowest occupied slot. | my call |
| D12 | Palette (optional, T11): ink `#293749`, blue `#176eae`, orange `#d57531`, gray `#687686`, text `#23303f`. | my call |

## 3. NON-GOALS (do not build)

SSE streaming, p5/canvas renderer, ask_student, new TTS provider, Gemini fallback, 429 retry logic, mobile layout, new UI controls, touching `lib/continuous/`.

---

## 4. TASKS

Order matters. T1–T7 are required. T8–T10 are the visible "Solvely feel". T11 optional.

### T1. preservesPitch  (D10)

**File:** `lib/engine/playbackEngine.ts` only.

There are exactly 3 lines `audio.playbackRate = this.speed;` / `activeAudio.playbackRate = this.speed;` (in `bindStepAudio`, `setSpeed`, `syncActiveAudioPlayState`). After each, add the matching `preservesPitch` line.

Desired shape:
```ts
public bindStepAudio(stepIndex: number, audio: HTMLAudioElement) {
  audio.playbackRate = this.speed;
  audio.preservesPitch = true;
  this.audios.set(stepIndex, audio);
}
// setSpeed:
this.audios.forEach((audio) => {
  audio.playbackRate = this.speed;
  audio.preservesPitch = true;
});
// syncActiveAudioPlayState:
activeAudio.playbackRate = this.speed;
activeAudio.preservesPitch = true;
activeAudio.play().catch(() => {});
```
**Done when:** `grep -n preservesPitch lib/engine/playbackEngine.ts` shows 3 lines. tsc clean.

---

### T2. Engine never erases  (D2)

**Files:** `lib/engine/playbackEngine.ts`, `lib/engine/playbackEngine.test.ts`, `app/home/whiteboard-tutor/LayeredBoardSurface.tsx`, `lib/layout/structuredAnimationEngine.test.ts` (only delete the transition-fade test near 191–222; pulled forward from T5).

**2a. playbackEngine.ts `computeStateAt`:**
- Delete the whole `// Check ERASE targets` block (`if (cmd.action === "ERASE" && ...) {...}`).
- Delete the `const cmdExit = ...` line.
- In the `else { // Drawing completed` branch delete the `// Check pure 300ms exit fade` block. The branch becomes:
  ```ts
  } else {
    completedCommandIds.add(cmd.id);
    commandProgress.set(cmd.id, 1.0);
  }
  ```
- **Keep** the fields `eraseProgress` and `erasedElementIds` in `GlobalEngineState` and keep returning them (they will always be empty). Reason: fewer consumers to change. Do not remove them from the interface.

**2b. playbackEngine.test.ts:**
- Remove the ERASE command from the fixture (near line 26) and delete the assertions about erase (near lines 67–110).
- Add this test (adapt the fixture builder the file already uses):
  ```ts
  test("completed commands never fade or erase", () => {
    const engine = new GlobalPlaybackEngine([stepWithOneDraw /* exitMs: Infinity */]);
    const s = engine.computeStateAt(999_999);
    assert.equal(s.commandProgress.get("d1"), 1);
    assert.equal(s.eraseProgress.size, 0);
    assert.equal(s.erasedElementIds.size, 0);
  });
  ```

**2c. LayeredBoardSurface.tsx:** Leave the props as they are. Because the maps are always empty, `eraseProgress` is always 0 and nothing is hidden. **Only** change it if tsc errors. Do not refactor.

**2d. structuredAnimationEngine.test.ts:** Delete only the test 'pure playback engine guarantees identical state across forward and backward scrubbing' (the TRANSITION fade that asserts `erasedElementIds.has("elem_sun")`). Touch nothing else in that file.

**Done when:** tsc clean, `playbackEngine.test.ts` and `structuredAnimationEngine.test.ts` pass, `grep -n '"ERASE"' lib/engine/playbackEngine.ts` returns nothing.

---

### T3. Pipeline never erases or transitions  (D2)

**File:** `lib/pipeline.ts` only.

- Near lines 225–238 there is a synthesized `TRANSITION` command pushed when the blueprint changes. Delete the push. **Keep** the line `layoutCtx.sceneBlueprint = targetBlueprint` (near 241).
- Near lines 279–303: delete the `ERASE` branch of the command loop.
- Near lines 304–339: delete the `TRANSITION` branch.
- If `stepOffsets` (near 151–156) becomes unused, delete it. If still used, leave it.
- Do NOT touch the max-tokens value (1200, near line 125) in this task.

**Done when:** `grep -n "ERASE\|TRANSITION" lib/pipeline.ts` returns nothing. tsc errors may remain ONLY in `lib/manifest.ts`-related type narrowing that T4 fixes; list them and stop.

---

### T4. Schema has no ERASE / TRANSITION; exitMs is Infinity  (D2)

**File:** `lib/manifest.ts` only.

- Delete the `ERASE` and `TRANSITION` choreographer zod schemas (near 173–190) and remove them from the discriminated union (near 192–197).
- Delete the compiled `ERASE` / `TRANSITION` types (near 232–253) and remove them from the compiled union.
- Near line 339 change
  ```ts
  exitMs: sIdx < script.steps.length - 1 ? durationMs : Infinity
  ```
  to
  ```ts
  exitMs: Infinity
  ```
- If `sIdx` or `durationMs` becomes unused there, remove only that now-unused variable.

Desired shape of the union (names may differ; keep the existing ones minus the two):
```ts
export const ChoreographerCommandSchema = z.discriminatedUnion("action", [
  DrawCommandSchema, WriteCommandSchema, HighlightCommandSchema, /* ...others that already exist... */
]); // no ERASE, no TRANSITION
```
Example compiled command (what the engine sees after T4):
```json
{ "id": "w3", "action": "WRITE", "startMs": 4200, "durationMs": 1102,
  "enterMs": 4200, "exitMs": null }
```
(`Infinity` serializes to `null` in JSON. That is fine; engine treats non-number as Infinity — verify `cmd.exitMs !== undefined` checks don't break by searching `exitMs` in `lib/` and listing each hit in your report.)

**Done when:** `grep -rn "ERASE\|TRANSITION" lib --include=*.ts | grep -v lib/continuous` shows only test files and `validator.ts` / `prompts.ts` (handled in T5/T6). tsc clean except those files.

---

### T5. Validator + layout tests  (D2, D11)

**Files:** `lib/validator.ts`, `lib/layout/structuredAnimationEngine.test.ts`, and the slot-placement code that emits the "A TRANSITION is required" error (find it with `grep -rn "TRANSITION is required" lib`; if it is in a file other than `validator.ts`, STOP and report the file before editing).

- `validator.ts` near 148–157: delete the ERASE target check.
- `validator.ts` near 266–274: delete the ERASE / TRANSITION branches.
- `validator.ts` near 192–254 (lifecycle / connector checks using `exitMs`): leave as is. They still work because `exitMs` is Infinity.
- Slot capacity (near 227) (D11): replace the error with fallback placement. Desired behaviour:
  ```ts
  // When every slot of the blueprint is taken:
  // place the object at x = first slot's x, y = (max bottom of all placed AABBs) + 48
  // and DO NOT push an error.
  ```
  Use the existing `AABB` type from `lib/layout/`. Gap is 48 px (Solvely vertical gap).
- `structuredAnimationEngine.test.ts`:
  - The test near 166–188 that expects "TRANSITION is required" → rewrite it to expect **no error** and that the overflow object's `y` is greater than every other object's bottom.
  - The transition-fade test → already deleted in T2 (step 2d); skip.

Desired test shape:
```ts
test("slot overflow places object below, no error", () => {
  const { errors, placed } = /* existing helper that places N+1 objects into an N-slot blueprint */;
  assert.equal(errors.length, 0);
  const last = placed.at(-1)!;
  const maxBottom = Math.max(...placed.slice(0, -1).map(p => p.y + p.h));
  assert.ok(last.y >= maxBottom + 48);
});
```

**Done when:** tsc fully clean across the repo (except DO-NOT-TOUCH files). All tests pass.

---

### T6. Prompts: no erase, deep narration, paraphrased notes  (D2 + goal)

**File:** `lib/prompts.ts` only.

- Remove every mention of ERASE and TRANSITION (near 117, 132–133, 240–241), and the scene/TRANSITION/slot-capacity rules (near 249–251).
- Add to the **pedagogy** system prompt (the one that writes narration), verbatim:
  ```
  NARRATION RULES
  - Teach like a patient tutor sitting next to the student. Explain WHY each step works, not only what to do.
  - Before a calculation, say what we are about to find and why we need it.
  - After a result, say what it means in plain words and check it makes sense.
  - Use short spoken sentences. No markdown, no LaTeX in narration; say math out loud ("x squared").
  - 3 to 6 sentences per step.
  ```
- Add to the **choreographer** system prompt (the one that emits board commands), verbatim:
  ```
  BOARD RULES
  - The board is never erased. Every new item is written below or beside earlier items. Never emit ERASE or TRANSITION.
  - Board text is a SHORT PARAPHRASED NOTE of the narration, at most 8 words or one equation. Never copy narration sentences onto the board.
  - Put math in LaTeX between $...$ (for example "$x^2 + 3x = 10$").
  - Anchor each board command to the word in the narration where the idea is first spoken.
  ```
- Example of a desired choreographer output for one step (put this in the prompt as an example if the prompt already has an example block; otherwise do not add it):
  ```json
  {"commands":[
    {"id":"w1","action":"WRITE","text":"Goal: find $x$","anchor":{"wordIndex":3}},
    {"id":"w2","action":"WRITE","text":"$x^2+3x-10=0$","anchor":{"wordIndex":14}},
    {"id":"h1","action":"HIGHLIGHT","targetId":"w2","style":"underline","anchor":{"wordIndex":22}}
  ]}
  ```
  (Use the action names and field names that already exist in `lib/manifest.ts`; if `WRITE` is called something else there, use that name.)

**Done when:** `grep -n "ERASE\|TRANSITION" lib/prompts.ts` returns nothing. tsc clean. Then run one lesson in the app (`npm run dev`, solve "Solve x^2 + 3x - 10 = 0") and paste the narration of step 1 and the board texts of step 1.

---

### T7. Grapheme-based text duration  (D3)

**Files:** `lib/pipeline.ts`, plus one new test file `lib/textDuration.test.ts`, plus the helper inside `lib/pipeline.ts` (do NOT create a new module for one function; export it from `pipeline.ts`). If `pipeline.ts` imports server-only modules that break `node --test`, put the helper in `lib/compiler/anchorCompiler.ts` instead and export it from there.

1. First read the `Shape` type in `lib/manifest.ts` and report the name of the text field (likely `text`). Do not guess.
2. Add:
   ```ts
   const seg = new Intl.Segmenter(undefined, { granularity: "grapheme" });
   export function textRevealMs(text: string): number {
     const n = [...seg.segment(text)].length;
     return Math.max(700, Math.min(8000, n * 58));
   }
   ```
3. In `pipeline.ts`, right after `layoutEngine.resolveObject(...)` (near line 255), when the resolved shape has a text field, override that command's `durationMs` with `textRevealMs(text)`. Leave `startMs` as compiled by `compileAnchors`.
4. Test:
   ```ts
   import { test } from "node:test";
   import assert from "node:assert";
   import { textRevealMs } from "./compiler/anchorCompiler.ts"; // or wherever it lives
   test("short text floors at 700", () => assert.equal(textRevealMs("x=2"), 700));
   test("58ms per grapheme", () => assert.equal(textRevealMs("a".repeat(20)), 1160));
   test("caps at 8000", () => assert.equal(textRevealMs("a".repeat(500)), 8000));
   test("emoji counts as one grapheme", () => assert.equal(textRevealMs("👍🏽".repeat(20)), 1160));
   ```

**Done when:** the 4 tests pass, tsc clean.

---

### T8. Monotonic reveal  (D4)

**File:** `lib/engine/playbackEngine.ts` only.

In `computeStateAt`, the active branch computes `const progress = (globalMs - cmdEnter) / cmdDrawDuration;`. Clamp it:
```ts
const progress = Math.min(1, Math.max(0, (globalMs - cmdEnter) / cmdDrawDuration));
```
That is all. Monotonic-in-time is already guaranteed because `globalMs` only moves forward during play (drift correction can jump it forward or back by >80 ms; that is acceptable — do NOT add state to prevent it).

Test (add to `playbackEngine.test.ts`):
```ts
test("progress is non-decreasing over time", () => {
  const engine = new GlobalPlaybackEngine([stepWithOneDraw]);
  let prev = -1;
  for (let t = 0; t <= 3000; t += 16) {
    const p = engine.computeStateAt(t).commandProgress.get("d1")!;
    assert.ok(p >= prev && p <= 1);
    prev = p;
  }
});
```
**Done when:** test passes.

---

### T9. DOM + KaTeX text with a pen sprite  (D7)

**Files:** `app/home/whiteboard-tutor/LayeredBoardSurface.tsx` and ONE new file `app/home/whiteboard-tutor/RevealText.tsx`. (Do not touch `shapes.tsx`.)

**Before editing, read LayeredBoardSurface.tsx and report:** where text shapes are rendered now (component + line), and how `commandProgress` reaches them. STOP and wait for "go" after the report.

Component contract (desired shape):
```tsx
// RevealText.tsx
import { mathText } from "@/lib/mathtext"; // use the existing export name in lib/mathtext.ts

type Props = {
  text: string;          // may contain $...$ LaTeX
  x: number; y: number;  // world px, top-left
  width: number; height: number;
  progress: number;      // 0..1 from engine.commandProgress
  color?: string;
};

export function RevealText({ text, x, y, width, height, progress, color = "#23303f" }: Props) {
  // 1. html = mathText(text)  (KaTeX HTML string)
  // 2. Reveal = CSS clip-path: inset(0 ${(1 - progress) * 100}% 0 0)  on the text box.
  //    shortcut: reveals left-to-right by width, not exact per-grapheme; upgrade if multi-line text looks wrong.
  // 3. Pen sprite: absolutely positioned div (16x16 circle, #293749) at
  //      left = x + width * progress, top = y + height * 0.78
  //    visible only while 0 < progress < 1.
  // 4. No React state, no effects, no timers. Pure function of props.
}
```
Render it in an absolutely positioned HTML layer **above** the SVG, inside the same world container (so it pans with T10). SVG text for the same shape must not also render (no double text).

Wrap `RevealText` with `React.memo`. `aria-label={text}` on the box for accessibility.

**Done when:** tsc clean; in `npm run dev`, a lesson shows text appearing left-to-right with a dot moving along it; KaTeX renders fractions/exponents; screenshot pasted.

---

### T10. World grows downward, camera pans  (D1)

**File:** `app/home/whiteboard-tutor/LayeredBoardSurface.tsx` only (and `BoardSurface.tsx` only if it owns the viewport container; report first).

**Before editing, report** which element is the 1000×700 viewport and which is the content container. STOP and wait for "go".

Desired behaviour:
```tsx
// viewport: width 1000, height 700, overflow: hidden, position: relative
// world: position absolute, width 1000, height = worldHeight
//        style={{ transform: `translate3d(0, ${-cameraY}px, 0)`,
//                 transition: "transform 1s cubic-bezier(0.22,1,0.36,1)" }}
//
// cameraY = clamp(0, worldHeight - 700, focusBottom - 700 + 120)
//   focusBottom = max (y + h) over commands with progress > 0  (started or done)
//   worldHeight = max(700, max (y + h) over ALL commands + 120)
// Compute with useMemo from props; no new state; no scroll listeners.
// While the user is scrubbing (state.isScrubbing), set transition: "none".
```
Example: items at bottoms 300, 650, 980 have started → focusBottom 980 → cameraY = 980 − 700 + 120 = 400.

**Done when:** in `npm run dev` a 6+ step lesson keeps all earlier content (scroll the world by scrubbing back: old items are still there), the view slides smoothly down as new content passes the bottom; screenshot at the end of a lesson pasted.

---

### T11 (optional). Palette  (D12)

Replace the existing ink/accent color constants (find them with `grep -rn "#[0-9a-fA-F]\{6\}" app/home/whiteboard-tutor lib/layout`, excluding `shapes.tsx`) with the D12 palette. Report the list of constants before changing.

---

## 5. FINAL ACCEPTANCE (after T10)

- [ ] `npx tsc --noEmit` → 0 errors (ignore DO-NOT-TOUCH files if they were already failing; say so).
- [ ] All `*.test.ts` under `lib/` (except `lib/continuous/`) pass.
- [ ] `grep -rn "ERASE\|TRANSITION" lib app --include=*.ts --include=*.tsx | grep -v lib/continuous` → empty.
- [ ] Manual run of "Solve x^2 + 3x - 10 = 0":
  - narration explains why (contains words like "because", "so that", "which means");
  - every board text ≤ 8 words or one equation;
  - nothing disappears from the board at any time;
  - 1.5x speed: voice pitch normal;
  - camera slides down smoothly; scrubbing back shows old content.
