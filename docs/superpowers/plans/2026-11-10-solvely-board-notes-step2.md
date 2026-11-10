# Step 2 — the Solvely look: short board notes, pen at the writing head, diagrams appear whole

**For:** Antigravity (executing agent). **Written by:** Claude, 2026-11-10.
**Branch:** `feature/animation-engine` (stay on it). **Reference:** `solvely-findings.md` in the repo root.
**Comes after:** `docs/superpowers/plans/2026-11-10-lesson-pacing-step1.md` (done; its Part 2 is the brief this plan implements).

Read this whole file once before touching anything. Do the tasks in order. Each task ends with a check; do not start the next task until the check passes.

---

## 0. What the user will see when you are done

1. Each lesson step writes a **short note** on the board (a heading, a key fact or a formula, about 3–12 words). The tutor's voice still speaks the full narration. Today the board writes out the whole narration word for word, which is the main reason it does not look like Solvely.
2. A **pen** follows the point where the text is being written. The orange dot is gone.
3. **Diagrams appear whole** (a short fade), instead of being drawn stroke by stroke with a second pen.
4. Old lessons that have no note still play exactly as they do today.

## 1. Ground rules (same as step 1)

- Do **not** commit, push, switch branch or stash. Leave all changes in the working tree.
- Do **not** add any npm dependency.
- Do **not** import `lib/pipeline.ts` (server only) into any file under `app/home/` or into `lib/liveboard/`.
- Line numbers in this plan are approximate. **Find code by the quoted text**, not by line number. If quoted text is not found, search for a distinctive part of it; if it is still not found, stop and report it instead of guessing.
- Smallest change that works. No new components, no new files except where this plan names one. Do not refactor anything this plan does not mention.
- Do not delete `AnimatedVector`'s stroke-drawing code or `SvgVirtualStylus`. We only stop using them from `LiveBoard`.
- Tests: `npm test` (runs `node --test`; test files import with the `.ts` extension, look at `lib/textDuration.test.ts` for the style).
- Type check: `npx tsc --noEmit`.
- After all code changes: run `graphify update`.
- Start the dev server only when you reach the live checks (section 8).

## 2. Decisions already made (Claude's calls; the user may overrule them later)

| Question | Decision |
|---|---|
| Who writes the board note? | The **model** writes it: a new `"note"` field in the pedagogy prompt. If a step has no usable note, the board falls back to the narration (today's behaviour). |
| Diagrams whole or stroke by stroke? | **Whole**, as Solvely does. |
| Old saved lessons / fixtures without a note? | Must keep working through the fallback. `note` is optional everywhere. |
| Order of work | 2A note → 2B pen → 2C diagrams → verify 2D/2E. |

## 3. Task 0 — confirm what is already done (no code)

These parts of the step 2 brief already exist. Open each file, confirm the quoted text is there, and write one line per item in your report. Change nothing.

| Item | File | Must contain |
|---|---|---|
| 2D column layout | `lib/liveboard/layout.ts` | `COLUMN_WIDTH = 528`, `COLUMN_GAP = 100`, `BLOCK_GAP = 48` |
| 2D camera easing | `app/home/whiteboard-tutor/LiveBoard.tsx` | `transform 1s cubic-bezier(0.22, 1, 0.36, 1)` |
| 2E speed list | `lib/playback.ts` | `SPEEDS = [0.75, 1, 1.25, 1.5, 2]` |

If one is missing, report it and continue with Task 1; do not fix it in this pass.

Also read these three files in full now, because every later task depends on them:

- `lib/liveboard/reveal.ts` (the step 1 helpers `paceMs`, `pacedCount`, `revealCount`)
- `app/home/whiteboard-tutor/useLessonPlayer.ts`
- `app/home/whiteboard-tutor/AnimatedBoardText.tsx`

---

## 4. Task group 2A — the short board note

Data path: **prompt → pipeline → manifest → player block → board**. One optional string, `note`, travels the whole way.

### Task 1 — two pure helpers + tests

**File:** `lib/liveboard/reveal.ts`. Add at the end of the file:

```ts
/** Longest note we accept. Longer means the model copied the narration; fall back to it. */
export const NOTE_MAX_CHARS = 160;

/** Returns a usable board note, or undefined when the step should fall back to the narration. */
export function cleanNote(note: unknown): string | undefined {
  if (typeof note !== "string") return undefined;
  const t = note.trim();
  if (!t || t.length > NOTE_MAX_CHARS) return undefined;
  return t;
}

/** The text the board writes for a step: the short note when there is one, else the narration. */
export function boardText(speech: { transcript?: string; note?: string }): string {
  return cleanNote(speech.note) ?? speech.transcript ?? "";
}
```

**Tests:** add to the existing test file for `reveal.ts` (find it with a search for `pacedCount` in `*.test.ts`). If there is none, create `lib/liveboard/reveal.test.ts` in the style of `lib/textDuration.test.ts`. Add:

```ts
test("cleanNote keeps a short note, trims it, rejects junk", () => {
  assert.equal(cleanNote("  Light + water → sugar  "), "Light + water → sugar");
  assert.equal(cleanNote(""), undefined);
  assert.equal(cleanNote("   "), undefined);
  assert.equal(cleanNote(undefined), undefined);
  assert.equal(cleanNote(42), undefined);
  assert.equal(cleanNote("x".repeat(161)), undefined);
});

test("boardText prefers the note and falls back to the transcript", () => {
  assert.equal(boardText({ transcript: "long narration", note: "Short" }), "Short");
  assert.equal(boardText({ transcript: "long narration" }), "long narration");
  assert.equal(boardText({ transcript: "long narration", note: "  " }), "long narration");
  assert.equal(boardText({}), "");
});
```

**Check:** `npm test` passes (was 169 tests; now 171).

### Task 2 — manifest type

**File:** `lib/manifest.ts`.

1. Find the `CompiledStepManifest` type (search `CompiledStepManifest`). Inside its `speech: { ... }` object, directly under the line `transcript: string`, add:
   ```ts
   /** Short text written on the board. Absent on old lessons: the board then writes the transcript. */
   note?: string;
   ```
2. Find `validateLessonManifest`. Read how it checks `speech.transcript`. If it rejects unknown keys or lists allowed keys, allow `note`. If it checks field types one by one, add: when `speech.note` is present it must be a string, otherwise report an error in the same way the function reports other errors. If the validator does not look at individual speech fields at all, change nothing.
3. Find `boardScriptToManifest` (it sets `transcript: step.say`). **Change nothing here.** This is the older lesson path; it has no note and will use the fallback.

**Check:** `npx tsc --noEmit` is clean.

### Task 3 — ask the model for the note

**File:** `lib/prompts.ts`, function/constant `pedagogyPrompt` (search `pedagogyPrompt`). Do **not** touch `lessonSystem`.

1. First find out which math delimiter the board understands: open `app/home/whiteboard-tutor/AnimatedBoardText.tsx` and find where the text is split into math and plain segments (search for `katex` and for the regular expression near it). Note the delimiter (expected: `$...$`). Use that exact delimiter in the prompt text below. If the board has no math delimiter at all, leave the math sentence out of the prompt.
2. In the JSON shape that the prompt shows the model, each step currently has `"say"` and `"visualIntent"`. Add a `"note"` field **between** them, written in the same style as the neighbouring lines:
   ```
   "note": "what the tutor writes on the board for this step: 3 to 12 words, at most 90 characters",
   ```
3. In the prompt's list of rules (where it says things like the narration must not contain markdown or LaTeX), add these rules, in the prompt's own formatting:
   ```
   - "note" is the board text. It is NOT a copy of "say". Write a heading, a key fact, or a formula, the way a teacher writes on a whiteboard.
   - "note" is 3 to 12 words and at most 90 characters. One line. No markdown, no bullet marks, no quotes around it.
   - "note" may contain simple math between $ signs, for example $6CO_2 + 6H_2O$. Avoid backslash commands; if one is truly needed, write the backslash twice because this is JSON.
   - Every step must have a "note".
   ```
   **Careful:** the prompt is a TypeScript template literal. A `$` followed by `{` would start an interpolation, and a single backslash would be eaten. The example above has neither; if you change the example, keep it that way.
4. The existing rule that forbids LaTeX in the narration applies to `"say"` only. If its wording could be read as covering the whole output, change it to name `"say"` explicitly.

**Check:** `npx tsc --noEmit` is clean. Read the final prompt string once, top to bottom, and confirm the JSON example is still valid JSON in shape (commas in the right places).

### Task 4 — carry the note through the pipeline

**File:** `lib/pipeline.ts` (server only).

1. Find the `PedagogyStep` type (search `PedagogyStep`). Add `note?: string;` next to `say`.
2. Find where the model's pedagogy JSON is parsed and turned into `PedagogyStep` objects (search `visualIntent` and `extractJson` in this file). If the code copies fields one by one into a new object, add `note: step.note`. If it validates or strips unknown keys, let `note` through. If it passes the parsed object along untouched, change nothing.
3. Find the step assembly, the object that contains **`transcript: prep.rawSay`**. Trace `prep` backwards to where it is created from a pedagogy step. Make the pedagogy step's `note` reachable there (add a `note` field to whatever `prep` is, set where `rawSay` is set). Then, directly under `transcript: prep.rawSay,` add:
   ```ts
   note: cleanNote(prep.note),
   ```
   and import it at the top: `import { cleanNote } from "./liveboard/reveal.ts";` — **match the import style the file already uses** for other `lib/` modules (with or without the `.ts` extension, relative or `@/`).
4. There is a 3-stage repair / retry flow in this file and in `lib/validator.ts`. If a repair stage rebuilds steps from a fresh model answer, make sure `note` survives it the same way `say` does. `lib/validator.ts` works on speech marks and word indices of the narration: **do not change it**, the note has no speech marks.
5. Search the whole repo for other places that build a `speech: {` object with a `transcript:` key (for example `app/api/lesson/route.ts`, `app/api/solve/route.ts`, `eval/`). Anywhere that copies speech fields one by one must also copy `note`. Anywhere that spreads or passes the object through needs no change. List what you found in the report.

**Check:** `npx tsc --noEmit` clean, `npm test` green.

### Task 5 — the player reveals the note

**File:** `app/home/whiteboard-tutor/useLessonPlayer.ts`.

Import at the top (extend the existing import from the reveal module): `boardText`, and `pacedCount` if it is not already imported.

**5a. `BoardBlock` type.** Under `transcript: string` (search `transcript`) add `note?: string;`.

**5b. Block creation in `playStep`.** Find `transcript: step.speech.transcript` inside the object that builds a block. Under it add:
```ts
note: step.speech.note,
```

**5c. Main rAF loop (audio is playing).** Find the call that looks like:
```ts
revealCount(stepDef.speech.speechMarks, interpolated, realDurMs, stepDef.speech.durationMs, currentCount, stepDef.speech.transcript.length)
```
(the variable names may differ slightly; it is the only `revealCount(` call that passes `stepDef.speech.speechMarks`). Replace the call expression with:
```ts
(stepDef.speech.note
  // Short note: the speech marks index into the narration, not the note, so pace it Solvely-style.
  ? pacedCount(
      boardText(stepDef.speech).length,
      interpolated,
      realDurMs > 0 ? interpolated / realDurMs : 0,
      currentCount,
    )
  : revealCount(stepDef.speech.speechMarks, interpolated, realDurMs, stepDef.speech.durationMs, currentCount, stepDef.speech.transcript.length))
```
Before you do this, confirm from `reveal.ts` that `pacedCount`'s parameters are `(textLength, elapsedMs, audioProgress, previousCount)` in that order and that `audioProgress` is a 0–1 fraction. If the signature differs, adapt the arguments, not the helper. Keep the `else` branch byte-for-byte what it is today.

Why: Solvely shows `max(previous, n × localProgress, n × voiceProgress)` where local progress is 58 ms per character. `pacedCount` already does exactly that.

**5d. Silent loop (no audio / TTS failed).** Find:
```ts
const len = step.speech.transcript.length;
const total = Math.max(paceMs(len), step.speech.durationMs || 0);
```
Replace with:
```ts
const text = boardText(step.speech);
const len = text.length;
// The step still lasts as long as the narration would, so a short note does not make the lesson race.
const total = Math.max(paceMs(len), paceMs(step.speech.transcript.length), step.speech.durationMs || 0);
```
Then find the `revealCount(step.speech.speechMarks, elapsed, total, step.speech.durationMs, shown, len)` call below it and replace the call expression with:
```ts
(step.speech.note
  ? pacedCount(len, elapsed, 0, shown)
  : revealCount(step.speech.speechMarks, elapsed, total, step.speech.durationMs, shown, len))
```
Passing `0` as audio progress is deliberate: with no audio only the 58 ms/char pace drives the note, and the step then holds until `total`.

**5e. Leave alone:** `speak(step.speech.transcript)` — the voice must keep speaking the **narration**, never the note. Leave every other use of `transcript` in this file unless it is used as "the length of the text on the board"; if you find such a use beyond 5c/5d (for example a place that marks a block as fully revealed by comparing with `transcript.length`, or sets the count to the transcript length when a step ends), switch it to `boardText(step.speech).length` and name it in the report. Places that set the count to `Infinity` need no change.

**Check:** `npx tsc --noEmit` clean.

### Task 6 — the board writes the note

**File:** `app/home/whiteboard-tutor/LiveBoard.tsx`.

1. In `BlockItem`, find `const fullText = block.transcript || "";` and replace with:
   ```ts
   const fullText = boardText(block);
   ```
   Import `boardText` from the reveal module, in the import style this file already uses for `lib/liveboard/`.
2. Search the file for every other `block.transcript` / `b.transcript`:
   - The transcript drawer (`{b.transcript}`) **stays as it is** — it shows what the tutor says.
   - Anything that measures or compares the board text length must use `fullText` / `boardText(...)`.
3. Search the repo for other readers of `BoardBlock.transcript` used as board text (`Lesson.tsx`, `lib/liveboard/layout.ts`). In particular: if `layoutBlocks` **estimates a block's height from the transcript length** before the real height is measured, change that estimate to use `boardText(block)`, otherwise blocks with short notes will reserve far too much space and then jump. If it only uses measured heights, change nothing.

**Check:** `npx tsc --noEmit` clean, `npm test` green.

---

## 5. Task group 2B — the pen follows the writing head

Today `AnimatedBoardText` can report where the reveal head is (`onTipMove`), but `LiveBoard` never passes that prop, and the head is shown as an orange dot. We connect the callback and show the existing `VirtualStylus` pen instead.

### Task 7 — hide the orange dot, keep its anchor

**File:** `app/home/whiteboard-tutor/AnimatedBoardText.tsx`.

There are exactly two elements with `ref={activeTipRef}`: one inside partially revealed **math** (absolutely positioned, `left: segProgress * 100%`, an 8×8 circle) and one after partially revealed **plain text** (an inline-block 8×8 circle with a left margin).

For **both**: keep the element, the ref, its position and its size. Only remove what makes it visible: set its background to `"transparent"` and remove any box-shadow / border / animation that draws it. Add `aria-hidden` if it is not there. The element must stay in the layout because the pen position is measured from its rectangle.

Do not change the `onTipMove` effect. For reference, it reports **viewport** coordinates: `x = rect.left + rect.width / 2`, `y = rect.top + rect.height * 0.78`, and `null` when the text is fully revealed. The `0.78` is Solvely's number; keep it.

Before editing, search the repo for other users of `<AnimatedBoardText`. If something other than `LiveBoard.tsx` renders it and relies on the dot being visible, stop and report; otherwise proceed.

### Task 8 — render the pen in the block

**File:** `app/home/whiteboard-tutor/LiveBoard.tsx`, component `BlockItem`.

1. Open `app/home/whiteboard-tutor/VirtualStylus.tsx` and read the **default export** `VirtualStylus({ x, y, active })`. It is an absolutely positioned HTML element at `left: x, top: y`. Note which point of the drawing sits exactly at (x, y) — it should be the pen tip / dot. You will need this in step 5.
2. Import it in `LiveBoard.tsx` if it is not imported: `import VirtualStylus from "./VirtualStylus";` (the file may already import `SvgVirtualStylus` from there; extend that import).
3. In `BlockItem`, the root element is the `div` with `data-block-id` (`position: absolute; left: block.x; top: block.y; width: block.w`). It needs a ref. If a ref to this element already exists (it is used for `onMeasure`), reuse it; below it is called `rootRef`.
4. Add state and a stable callback inside `BlockItem` (add `useCallback`, `useState` to the React import if missing):
   ```tsx
   const [penPos, setPenPos] = useState<{ x: number; y: number } | null>(null);

   const handleTipMove = useCallback((tip: { x: number; y: number } | null) => {
     const el = rootRef.current;
     if (!tip || !el) {
       setPenPos(null);
       return;
     }
     // tip is in viewport pixels; the block lives inside the scaled, translated #board-world.
     const r = el.getBoundingClientRect();
     const scale = el.offsetWidth ? r.width / el.offsetWidth : 1;
     const x = (tip.x - r.left) / scale;
     const y = (tip.y - r.top) / scale;
     setPenPos((p) => (p && Math.abs(p.x - x) < 0.5 && Math.abs(p.y - y) < 0.5 ? p : { x, y }));
   }, []);
   ```
   - `scale` is derived from the element itself, so no camera prop is needed.
   - The "same position → keep the old object" guard is required: without it every report causes a re-render, which can cause another report (render loop).
   - If `onTipMove`'s parameter type in `AnimatedBoardText` is named or shaped differently, match that type.
5. Pass the callback: change
   ```tsx
   <AnimatedBoardText text={fullText} revealedCount={revealedCount} />
   ```
   to
   ```tsx
   <AnimatedBoardText text={fullText} revealedCount={revealedCount} onTipMove={handleTipMove} />
   ```
   (keep any other props that are already there).
6. Render the pen as the **last child of the block root div**:
   ```tsx
   {penPos && <VirtualStylus x={penPos.x} y={penPos.y} active />}
   ```
   The root is `position: absolute`, so the pen's `left/top` are relative to the block. Make sure the root does **not** have `overflow: hidden`; if it does, the pen will be clipped at the block edge — report it instead of removing the overflow rule.
7. If `VirtualStylus` has a CSS transition on `left`/`top`, keep it only if it is 120 ms or shorter; a longer one makes the pen lag behind the text. If it has none, add nothing.

**Expected behaviour**
- While a note is being written the pen tip sits at the end of the revealed text, slightly below the middle of the line.
- When the note is complete the pen disappears (`onTipMove(null)`).
- On pause the pen stays where it is, mid-word. On resume it continues from there.
- Only the block that is currently being written shows a pen. Finished blocks get `revealedCount` ≥ their length (or `Infinity`), so they report `null`.
- During a camera move the pen stays glued to the text (both rectangles are measured in the same frame).

**Check:** `npx tsc --noEmit` clean. No "Maximum update depth exceeded" in the browser console during the live check.

---

## 6. Task group 2C — diagrams appear whole

**File:** `app/home/whiteboard-tutor/LiveBoard.tsx`, component `BlockItem`.

Today each DRAW command gets `cmdProgress = elapsedMs === Infinity ? 1.0 : calcCommandProgress(elapsedMs, cmd.startMs ?? 0, cmd.durationMs ?? 1000)` and the active one reports a tip to `setDrawingTip`, which positions an `SvgVirtualStylus` inside the SVG.

### Task 9

1. In the `drawCommands.map(...)`, pass `progress={1}` to every `<AnimatedVector>` and remove the `onTipMove={...}` prop from it.
2. Remove what is now unused **in this file only**: the `drawingTip` state, `activeDrawingIndex` and its calculation, the `cmdProgress` calculation, the `<SvgVirtualStylus ... />` element, and the imports of `SvgVirtualStylus` / `calcCommandProgress` if nothing else in the file uses them. Do not delete those functions from their own files.
3. `BlockItem` still receives the `elapsedMs` prop. If it is now unused inside `BlockItem`, leave the prop in place (the parent passes it; removing it is not part of this pass) unless `tsc` or the linter reports an unused-variable **error**, in which case remove it from `BlockItem`'s destructuring only.
4. Fade-in. Open `app/globals.css` and search for `@keyframes`. If a simple opacity fade already exists (0 → 1), reuse its name. If not, add at the end of the file:
   ```css
   @keyframes board-fade-in {
     from { opacity: 0; }
     to { opacity: 1; }
   }
   ```
   Then on the `<svg>` element that wraps the block's shapes add to its style: `animation: "board-fade-in 400ms ease-out both"`. The block is mounted when its step starts, so the animation plays once at that moment and never again.
5. Confirm with `AnimatedVector` that `progress={1}` renders the complete shape, including fills, arrowheads and labels (read how it handles `progress >= 1`). If some part only becomes visible through a transition that starts at progress 1, report it.

**Expected behaviour:** when a step with a diagram starts, the whole diagram fades in over 0.4 s while the note is being written next to/above it. No second pen. Pausing does not affect an already visible diagram.

**Check:** `npx tsc --noEmit` clean, `npm test` green.

---

## 7. Fixture (small, optional but useful)

`eval/fixtures/photosynthesis_continuous.json` is the only fixture. If (and only if) each step in it has a `speech` object with a `transcript`, add a `"note"` to the **first two** steps (for example `"Photosynthesis: light → chemical energy"` and `"$6CO_2 + 6H_2O$ → sugar + oxygen"`), leave the other steps without one. That gives one file that exercises both the note path and the fallback path. If `eval/syncEval.ts` or any test fails because of the new key, revert the fixture change and report it.

---

## 8. Final verification

Run in this order and paste the real output tails into the report:

1. `npx tsc --noEmit` → no errors.
2. `npm test` → all green (171 or more).
3. `graphify update`.
4. Start the dev server and open a whiteboard lesson. Generate one **new** lesson (so that it has notes) and also open one **old** lesson if any is available (fallback). Do every row below by actually looking at the page; for the measured rows use the browser console.

| # | Check | How | Pass when |
|---|---|---|---|
| 1 | Note is short | New lesson: compare the board text of a step with the same step in the transcript drawer | Board text is a short note (≤ 160 chars), the drawer shows the full narration, and they differ |
| 2 | Voice unchanged | Listen / check the `/api/speak` request body in the network tab | The spoken text is the narration, not the note |
| 3 | Note pace | Time one note from first to last character | About `max(700, min(8000, chars × 58))` ms at 1× (± 20 %), and never later than the end of that step's audio |
| 4 | Step length | A step with a short note | The next step does not start until the narration audio of this one has ended |
| 5 | No audio path | Block `/api/speak` in dev tools (or let TTS fail) and replay | Notes still write at the 58 ms/char pace, steps still hold for roughly the narration's length, nothing reveals instantly |
| 6 | Pen position | Watch a note being written | Pen tip is at the end of the revealed text, in the lower part of the line; no orange dot anywhere |
| 7 | Pen with zoom/pan | Zoom the board in/out and drag it while a note is being written | Pen stays glued to the text head |
| 8 | Pen on pause | Pause mid-note, wait 3 s, resume | Text and pen freeze mid-word and continue from the same place |
| 9 | Pen hides | Let a note finish | Pen disappears; only the block currently being written ever shows a pen |
| 10 | Math note | A step whose note contains `$…$` | Math renders with KaTeX, pen moves across it, no raw `$` on the board |
| 11 | Diagram whole | A step with a diagram | The whole diagram fades in at step start; no stroke-by-stroke drawing; no second pen |
| 12 | Old lesson | A lesson/fixture step without `note` | Board writes the narration exactly as after step 1 |
| 13 | Speeds | Click through the speed button | 0.75, 1, 1.25, 1.5, 2; note pace follows the speed |
| 14 | Console | Whole run | No React "Maximum update depth" error, no KaTeX parse error from a note |
| 15 | Model output | Look at the raw `/api/lesson` (or the route that returns the manifest) response of the new lesson | Every step has `speech.note`; count how many steps fell back because the note was missing or too long |

If a row cannot be tested (for example no old lesson exists), write **NOT TESTED** and the reason. Do not mark a row PASS from reading code.

## 9. Known limits (do not fix in this pass; mention if you hit them)

- The reveal counts UTF-16 code units, Solvely counts graphemes. Only matters for emoji / combined characters in a note.
- A model answer with a badly escaped backslash inside `"note"` can break JSON parsing of the whole lesson. The prompt tells the model to avoid backslash commands. If lesson generation starts failing with JSON errors after Task 3, report the raw model output; the fallback option is to forbid math in notes.
- From step 1, still open: in the silent loop a step **without** a note that has speech marks but no audio takes the speech-mark path. Unchanged by this plan.

## 10. Report back in this format

```
STEP 2 REPORT
Task 0 (already done items): layout ✔/✘, camera easing ✔/✘, speeds ✔/✘
Files changed: <path> — <one line what changed>   (one line per file)
Places where "note" had to be carried besides the ones in the plan: <list or "none">
Uses of transcript-as-board-text found and switched: <list or "none">
tsc: <last lines of output>
npm test: <pass/fail counts>
graphify update: done / failed
Live checks: table rows 1–15 with PASS / FAIL / NOT TESTED and one line of evidence each
  (evidence = a measured number, a console line, or what you saw; say "inferred" if you did not observe it)
Deviations from the plan and why: <list or "none">
Open problems: <list or "none">
Nothing committed: yes
```
