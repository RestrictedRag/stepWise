# Lesson pacing fix (step 1) + Solvely look (step 2) — hand-off plan

> **For the executing agent (Antigravity):** Work through Part 1 task by task, in order. Each task says which file, what to find, what to put there, and how to check it. Part 2 is a design brief, not a ready-to-type plan: do NOT build Part 2 until the user has answered its open questions.

**Repo:** `D:\solvely clone` (Next.js, TypeScript). **Branch:** `feature/animation-engine` (stay on it).
**Reference for all Solvely behaviour:** `solvely-findings.md` in the repo root.

## Ground rules

- Do not commit or push unless the user asks.
- Do not add dependencies.
- Do not change `app/home/whiteboard-tutor/AnimatedBoardText.tsx` or `app/api/speak/route.ts` in Part 1.
- Do not import anything from `lib/pipeline.ts` into client code (`app/**` hooks/components). It is a server module.
- Line numbers below are from the file as it stood on 2026-11-10 and may have drifted by a few lines. Always locate code by the quoted text, not by the number.
- Smallest change that fully works. No new abstractions, options or config.
- After code changes run `graphify update` (project rule in `CLAUDE.md`).
- The test runner is Node's built-in one: `npm test` runs `node --test`. Test files import with the `.ts` extension (see existing `lib/liveboard/reveal.test.ts`).

---

## The problem (what the user sees)

On the whiteboard-tutor lesson page, the board looks static: all text is already there within a second or two and nothing "writes". Solvely writes each block character by character at a steady pace with a pen dot at the writing head.

## Root causes (confirmed by reading the code)

All in `app/home/whiteboard-tutor/useLessonPlayer.ts` and `lib/liveboard/reveal.ts`.

1. **Two voice requests at once.** In `playStep`, the *next* step's audio is prefetched **before** the current step's audio is awaited. The TTS provider (Vachana/Gnani, behind `/api/speak`) is believed to allow only one active request, so one of the two fails and `speak()` returns `null`. (The upstream 429 is inferred, never observed live. `/api/speak` turns any upstream failure into a 502 and logs `speak <status> <body>` on the server.)
2. **A failed voice request is cached forever.** `getAudioForStep` stores the promise in `audioCache` under `${colIdx}:${stepIdx}`. When the blob is `null` it returns `null` but leaves the entry in the map, so that step never gets a voice again, even on replay.
3. **The no-marks reveal formula is in the wrong unit.** `revealCount` ends with
   ```ts
   const ratio = Math.min(1.0, audioTimeMs / duration);
   const count = Math.floor(ratio * 1000);
   ```
   `count` is used by `AnimatedBoardText` as a **character index** into the text. A 120-character block is therefore fully shown at 12% of the duration. (When speech marks exist they carry `endChar` character indices, so that path is already correct. Do not touch it.)
4. **The no-voice fallback timer is wrong three ways.** It is a `setInterval(…, 50)` that (a) divides the duration by speed *and* multiplies elapsed by speed, so speed is applied twice; (b) uses wall-clock time, so pause does not pause it; (c) is never cleared on unmount or when another step starts.

## Target behaviour for Part 1 (from `solvely-findings.md`)

- Writing time for a block = `max(700, min(8000, characters * 58))` ms, linear.
- Elapsed time accumulates `delta * playbackRate` per animation frame, only while playing.
- Visible characters = `max(previous, n * ownPaceProgress, n * voiceProgress)`. Never goes backwards, never falls behind the voice.
- Pause freezes the writing mid-character. Speed changes apply once.
- Only one `/api/speak` request in flight during normal playback.

---

# Part 1 — Tasks

## Task 1: pacing helpers in `lib/liveboard/reveal.ts`

**File:** `lib/liveboard/reveal.ts`

### 1a. Add two exported helpers

Insert directly **above** the JSDoc comment that starts `/** Returns how many characters or words of the current step are visible.` (i.e. after the `SpeechMark` type, before `revealCount`):

```ts
/** Solvely's writing time for a block: 58 ms per character, clamped to 0.7–8 s. */
export const paceMs = (chars: number) => Math.max(700, Math.min(8000, chars * 58));

/** Characters visible without speech marks: max(previous, own 58 ms/char pace, voice progress). */
export function pacedCount(
  textLength: number,
  elapsedMs: number,
  audioProgress: number = 0,
  previousCount: number = 0
): number {
  if (textLength <= 0) return previousCount;
  const local = Math.min(1, Math.max(0, elapsedMs) / paceMs(textLength));
  const p = Math.max(local, Math.min(1, Math.max(0, audioProgress)));
  return Math.max(previousCount, Math.floor(textLength * p));
}
```

### 1b. Give `revealCount` a sixth optional parameter

Change the signature from

```ts
export function revealCount(
  speechMarks: SpeechMark[] | undefined | null,
  audioTimeMs: number,
  realDurationMs: number,
  manifestDurationMs: number,
  previousCount: number = 0
): number {
```

to

```ts
export function revealCount(
  speechMarks: SpeechMark[] | undefined | null,
  audioTimeMs: number,
  realDurationMs: number,
  manifestDurationMs: number,
  previousCount: number = 0,
  textLength: number = 0
): number {
```

### 1c. Replace the fallback at the bottom of `revealCount`

Find (last lines of the function):

```ts
  // Fallback linear reveal if no marks are provided
  const ratio = Math.min(1.0, audioTimeMs / duration);
  const count = Math.floor(ratio * 1000);
  return Math.max(previousCount, count);
}
```

Replace with:

```ts
  // No marks: write at Solvely's pace, never behind the voice.
  const ratio = Math.min(1.0, audioTimeMs / duration);
  // shortcut: callers that pass no textLength keep the old 0–1000 scale, remove once every caller passes it.
  if (textLength <= 0) return Math.max(previousCount, Math.floor(ratio * 1000));
  return pacedCount(textLength, audioTimeMs, ratio, previousCount);
}
```

Leave everything else in the function (the two early returns, `scale`, the whole speech-marks branch) exactly as it is.

### 1d. Find every caller

Run a search for `revealCount(` across the repo (excluding `node_modules`, `.next`, `graphify-out`). Expected callers: `app/home/whiteboard-tutor/useLessonPlayer.ts` and `lib/liveboard/reveal.test.ts`. If there are others in live (non-deleted) code, pass the block's text length as the 6th argument there too, using the same string that the caller renders.

## Task 2: tests for the helpers

**File:** `lib/liveboard/reveal.test.ts` (exists; uses `node:test` and `node:assert`).

1. Extend the existing import of `revealCount` so it also imports the new helpers. It currently looks like `import { revealCount } from "./reveal.ts";` — change to:

   ```ts
   import { revealCount, paceMs, pacedCount } from "./reveal.ts";
   ```

   (Keep whatever else that line already imports.)

2. Append at the end of the file. Use the same `test`/`assert` identifiers the file already imports; if the file uses `assert.strictEqual` or `assert.equal`, either is fine.

   ```ts
   test("paceMs: 58 ms per character, clamped to 700–8000", () => {
     assert.equal(paceMs(3), 700);
     assert.equal(paceMs(20), 1160);
     assert.equal(paceMs(500), 8000);
   });

   test("pacedCount: own pace, voice lead, never backwards", () => {
     assert.equal(pacedCount(100, 2900), 50); // 2900 / 5800
     assert.equal(pacedCount(100, 0, 0.8), 80); // voice is ahead
     assert.equal(pacedCount(100, 100, 0, 60), 60); // keeps previous
     assert.equal(pacedCount(0, 5000), 0); // empty text
   });

   test("revealCount without marks uses text length, not ratio * 1000", () => {
     assert.equal(revealCount(undefined, 2900, 10000, 10000, 0, 100), 50);
     assert.equal(revealCount(undefined, 10000, 10000, 10000, 0, 100), 100);
   });
   ```

3. Run:

   ```bash
   node --test lib/liveboard/reveal.test.ts
   ```

   **Expected:** all tests pass, including the old ones. If Node complains about `.ts` imports, run `npm test` instead (that is how the project normally runs them) and confirm the `reveal` tests are in the output.

## Task 3: `useLessonPlayer.ts` — pass text length to the main reveal loop

**File:** `app/home/whiteboard-tutor/useLessonPlayer.ts`

### 3a. Import

Find the import of `revealCount` from `../../../lib/liveboard/reveal` and add `paceMs`:

```ts
import { revealCount, paceMs } from "../../../lib/liveboard/reveal";
```

### 3b. Main rAF effect (around lines 57–110)

Find the call (around lines 90–96):

```ts
revealCount(
  stepDef.speech.speechMarks,
  interpolated,
  realDurMs,
  stepDef.speech.durationMs,
  currentCount
)
```

(variable names may differ slightly; it is the only `revealCount(` call inside the rAF effect). Add a sixth argument:

```ts
revealCount(
  stepDef.speech.speechMarks,
  interpolated,
  realDurMs,
  stepDef.speech.durationMs,
  currentCount,
  stepDef.speech.transcript.length
)
```

**Check before moving on:** open `app/home/whiteboard-tutor/LiveBoard.tsx` and find where `<AnimatedBoardText text={…} revealedCount={…} />` is rendered. The `text` prop must be the same string whose length you pass here. If `LiveBoard` renders a different field than `speech.transcript` (for example a block `text`/`content` field), pass **that field's** `.length` instead, here and in Task 5. The count is a UTF-16 character index into exactly the string `AnimatedBoardText` receives.

## Task 4: `useLessonPlayer.ts` — one voice request at a time, no cached failures

### 4a. Do not cache a failed voice (`getAudioForStep`, around lines 113–136)

Find:

```ts
if (!blob) return null;
```

Replace with:

```ts
if (!blob) {
  audioCache.current.delete(key); // let a later play retry the voice
  return null;
}
```

`key` is the `${colIdx}:${stepIdx}` string already computed in that function; if the variable has another name, use that name. This delete runs after the promise was stored (because `speak` is awaited first), so it does remove the entry.

### 4b. Prefetch the next step only after the current audio has arrived (`playStep`, around lines 139–243)

Inside `playStep` there is a block (around lines 171–177) that looks up the next step and calls `getAudioForStep(...)` for it **without** awaiting — the prefetch. A few lines further down (around line 187) is:

```ts
const audio = await getAudioForStep(colIdx, stepIdx, step);
```

Do this:

1. **Cut** the whole prefetch block (the code that computes the next step/column and calls `getAudioForStep` for it; do not change its contents).
2. Right **after** the `const audio = await getAudioForStep(colIdx, stepIdx, step);` line, add a superseded guard and then **paste** the prefetch block:

```ts
const audio = await getAudioForStep(colIdx, stepIdx, step);
// The user moved on while the voice was loading.
if (currentCoord.current.col !== colIdx || currentCoord.current.step !== stepIdx) return;

// …pasted prefetch block for the next step goes here, unchanged…
```

**Check:** `currentCoord.current` must already be set to `{ col: colIdx, step: stepIdx }` earlier in `playStep`, before the `await`. It was at the time of writing. If its field names are not `col`/`step`, use the real ones. If it is *not* set before the await, move/add that assignment above the await; otherwise the guard would always return.

The prefetch must stay above the `if (!audio)` fallback branch so the next step is still prefetched when the current one has no voice.

## Task 5: `useLessonPlayer.ts` — replace the `setInterval` fallback with a paced rAF loop

### 5a. New ref

Next to the other `useRef` declarations (`lastTickRef`, `prevCountRef`, …) add:

```ts
const silentRafRef = useRef<number>(0);
```

### 5b. Replace the null-audio branch in `playStep` (around lines 190–213)

Find the branch that starts with `if (!audio) {` and contains `setInterval`. It currently: computes `dur = Math.max(1000, step.speech.durationMs || 3000) / speedRef.current`, takes `startT = performance.now()`, runs an interval every 50 ms computing `elapsed = (performance.now() - startT) * speedRef.current`, updates revealed/elapsed state, and at the end sets `Infinity`, clears the interval, and either calls `setPlaying(false)` (checkpoint) or `advanceNext(...)`.

Note the names it uses before deleting it: the block key (called `blockId` below), the state setters (`setRevealed`, `setStepElapsedMs` below), the checkpoint test, and the arguments of `advanceNext`. Use the real names from the file.

Replace the **entire** `if (!audio) { … }` branch with:

```ts
if (!audio) {
  // No voice: write at Solvely's pace in silence.
  const len = step.speech.transcript.length;
  // Long enough for the writing and for any diagram strokes timed by the manifest.
  const total = Math.max(paceMs(len), step.speech.durationMs || 0);
  let elapsed = 0;
  let shown = 0;
  let last = performance.now();
  cancelAnimationFrame(silentRafRef.current);
  const tick = (now: number) => {
    const delta = Math.min(now - last, 100); // tab was in the background
    last = now;
    if (currentCoord.current.col !== colIdx || currentCoord.current.step !== stepIdx) return; // superseded
    if (playingRef.current) {
      elapsed += delta * speedRef.current;
      const next = revealCount(step.speech.speechMarks, elapsed, total, step.speech.durationMs, shown, len);
      if (next !== shown) {
        shown = next;
        setRevealed((p) => ({ ...p, [blockId]: next }));
      }
      setStepElapsedMs((p) => ({ ...p, [blockId]: elapsed }));
    }
    if (elapsed >= total) {
      setRevealed((p) => ({ ...p, [blockId]: Infinity }));
      setStepElapsedMs((p) => ({ ...p, [blockId]: Infinity }));
      if ((step as any).checkpoint) setPlaying(false);
      else advanceNext(colIdx, stepIdx, manifestList);
      return;
    }
    silentRafRef.current = requestAnimationFrame(tick);
  };
  silentRafRef.current = requestAnimationFrame(tick);
  return;
}
```

Adjust to the file's real identifiers:

- `blockId`, `setRevealed`, `setStepElapsedMs`, `manifestList`, the checkpoint condition and the `advanceNext(...)` call must match what the old branch used. Keep the old branch's end-of-step behaviour identical (same two outcomes, same arguments).
- If Task 3's check found that the board renders a field other than `speech.transcript`, use that field for `len`.
- If the old branch also updated `prevCountRef.current`, keep doing so where `shown` is assigned (`prevCountRef.current = next;`).

Why this is right: `elapsed` only grows while `playingRef.current` is true (pause freezes it), speed is applied once (`delta * speedRef.current`), the loop stops itself when another step becomes current, and it is cancelled on unmount (5c).

### 5c. Cancel on unmount

In the unmount cleanup effect (around lines 266–275, the one that pauses audio and revokes blob URLs) add one line:

```ts
cancelAnimationFrame(silentRafRef.current);
```

### 5d. Confirm no `setInterval` is left

Search `useLessonPlayer.ts` for `setInterval` and `clearInterval`. **Expected:** no matches. If something else in the file used the same interval variable, remove that reference too.

## Task 6: static checks

Run each and fix anything that this change introduced (pre-existing errors in unrelated files can be left; list them in the final report):

```bash
npx tsc --noEmit
```

```bash
npm test
```

```bash
graphify update
```

**Expected:** no new TypeScript errors in `reveal.ts`, `reveal.test.ts`, `useLessonPlayer.ts`; all `reveal` tests green; graph updated.

## Task 7: check it in the running app

Start the dev server (`npm run dev`), open the app, start a whiteboard-tutor lesson (home page → whiteboard tutor → submit any question), and open the browser devtools.

| # | Do | Expect |
|---|----|--------|
| 1 | Watch the first block appear | Text writes left to right over roughly `chars × 58 ms` (about 6 s for 100 characters), with the orange dot at the writing head. It must not appear all at once. |
| 2 | Devtools → Network, filter `speak` | At most one `/api/speak` request pending at any moment during normal playback. The next step's request starts only after the current one has returned. |
| 3 | Dev-server terminal | Note whether lines starting `speak 429` (or any `speak <status>`) appear. Report what you see either way. This is the first live observation of that error. |
| 4 | Press pause mid-block | Writing freezes mid-word; resume continues from the same character. Check this both with voice and without (see row 7). |
| 5 | Change speed to 2× mid-block | Writing gets about twice as fast, not four times. |
| 6 | Let the lesson run through several steps | Each step starts after the previous one finishes; no step is skipped; no two steps write at once. |
| 7 | Force silent mode: in devtools Network, block the request URL `*/api/speak` and reload the lesson | Every block still writes at the 58 ms/char pace, steps advance by themselves, pause and speed still work. |
| 8 | Unblock `/api/speak`, replay the lesson without reloading (if the UI has replay) | Steps that were silent get their voice back (proves 4a). |
| 9 | Navigate away from the lesson mid-block | No console errors about state updates after unmount. |

## Part 1 acceptance criteria

- [ ] `node --test lib/liveboard/reveal.test.ts` (or `npm test`) passes, old and new tests.
- [ ] No `setInterval` in `useLessonPlayer.ts`.
- [ ] No `ratio * 1000` reveal reachable from `useLessonPlayer.ts` (every call passes a text length).
- [ ] One `/api/speak` in flight at a time during normal playback.
- [ ] A block of N characters takes about `clamp(N × 58, 700, 8000)` ms to write at 1× when there is no voice, and never lags behind the voice when there is one.
- [ ] Pause freezes writing; speed applies once.
- [ ] Nothing committed.

## Known limits left after Part 1 (do not fix now; mention in the report)

- `appendColumn` calls `playStep` inside a `setColumns` updater. In React StrictMode (dev) that runs twice, and it can overlap a voice request that is already in flight.
- `/api/speak` rejects text longer than 600 characters with a 400. Those steps get no voice; after Part 1 they are written silently at normal pace.
- The board still shows the full spoken narration. Solvely shows short notes. That is Part 2.
- The pen is still an orange dot. A real pen sprite is Part 2.

## Report back to the user

List: files changed; test output; the table from Task 7 with pass/fail per row; whether `speak 429` appeared in the server log; any place where the real code differed from this plan and what you did instead.

---

# Part 2 — Solvely look (design brief; needs the user's decisions first)

**Status:** not approved, no design document yet. Do not write code for this part until the user answers the open questions at the end. When they do, write the design to `docs/superpowers/specs/2026-11-10-solvely-board-notes-design.md` first.

## What Solvely does that this app does not (see `solvely-findings.md`)

1. **Board text is short notes, not the narration.** The voice says a full sentence; the board gets a heading, a formula, a few words. One MP3 per spoken sentence.
2. **A pen follows the writing head.** Positioned at the reveal head, `x` at the head, `y = rect.top + rect.height * 0.78`.
3. **Diagrams appear whole**, not stroke by stroke.
4. **Layout:** columns 528 px wide, 100 px gap between columns, 48 px vertical gap between blocks.
5. **Camera:** moves to the active block with `transform 1s cubic-bezier(0.22, 1, 0.36, 1)`.
6. **Speeds:** 0.75 / 1 / 1.25 / 1.5 / 2. Pause freezes mid-character.

## Files to read before designing

- `solvely-findings.md` — the reference. Read fully.
- `app/home/whiteboard-tutor/LiveBoard.tsx` — how columns and blocks are laid out, which string is passed to `AnimatedBoardText`, how the camera transform is computed.
- `app/home/whiteboard-tutor/AnimatedBoardText.tsx` — already reports the tip position via `onTipMove` using the `0.78` rule; the pen sprite can hang off that.
- `app/home/whiteboard-tutor/VirtualStylus.tsx` (`SvgVirtualStylus`) and `AnimatedVector.tsx` — existing pen and diagram drawing.
- `app/home/whiteboard-tutor/useLessonPlayer.ts` — playback state.
- `lib/prompts.ts` (`lessonSystem`) — what the model is asked to produce per step.
- `lib/manifest.ts` (speech-mark building, about lines 223–308) and `lib/pipeline.ts` (about line 289, `speechMarks: prep.alignRes.marks`; line 21, `textRevealMs`) — how a step's speech and timing are assembled.
- `lib/validator.ts` — any schema change to steps must be reflected here.
- `eval/syncEval.ts` and `eval/fixtures/` — fixtures that will need the new field.

## Likely shape of the change (a starting point, to be confirmed in the design)

- **2A. Notes separate from narration.** Add a short board-text field per step alongside the spoken transcript (prompt change in `lib/prompts.ts`, schema in `lib/manifest.ts`/`lib/validator.ts`, fixtures in `eval/fixtures/`). `LiveBoard` renders the note; the voice speaks the transcript. Speech marks index into the transcript, so they can no longer drive the note directly: drive the note with `pacedCount(note.length, elapsed, voiceProgress, previous)` from Part 1, which is exactly Solvely's rule. Old lessons without the new field fall back to the transcript.
- **2B. Pen sprite.** Replace the orange dot with the existing stylus graphic positioned from `onTipMove`; hide it when the block completes (`onTipMove(null)` already fires).
- **2C. Diagrams whole.** When a step's block is a diagram, show it complete at step start (fade allowed) instead of running stroke animation.
- **2D. Layout and camera numbers.** Apply 528 / 100 / 48 and the 1 s camera easing in `LiveBoard.tsx` if they are not already those values.
- **2E. Speed list.** Confirm `SPEEDS` in `lib/` is `[0.75, 1, 1.25, 1.5, 2]`.

Each of 2A–2E is independent; 2A is the big one and the only one touching the server pipeline and prompts.

## Acceptance checks for Part 2 (once built)

- A step whose narration is a 25-word sentence shows a board note of a few words, and the note finishes writing within `clamp(noteChars × 58, 700, 8000)` ms or with the voice, whichever is sooner.
- The pen graphic sits at the writing head for text and for math, and disappears when the block is complete.
- A diagram step shows the full diagram at once.
- Measured in devtools: column width 528 px, column gap 100 px, block gap 48 px; camera transition 1 s with the easing above.
- Old saved lessons (no note field) still play.
- `npm test` and `npx tsc --noEmit` clean; `eval/syncEval.ts` still runs on the fixtures.

## Open questions for the user (ask before building Part 2)

1. Should the board note be written by the model (new field in the lesson prompt), or derived from the narration in code?
2. Should diagrams really appear whole like Solvely, or keep the stroke-by-stroke drawing this branch just built?
3. Do old saved lessons need to keep working, or can they be regenerated?
4. Which of 2A–2E matter most, if not all are wanted?
