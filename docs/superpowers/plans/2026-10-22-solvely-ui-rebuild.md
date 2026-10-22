# Solvely UI Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace every page and component of the current UI with a from-scratch rebuild that matches the solvely.ai screen recording: home, chat answer, flashcards, whiteboard tutor, login and rating modals. The existing backend stays as it is.

**Architecture:** This is a Next.js 16 app-router UI with three routes:
- `/` is home.
- `/chat/[id]` is the solver answer plus flashcards.
- `/home/whiteboard-tutor/[id]` is the lesson.

All three sit inside one client app shell (sidebar and top bar). Submitting a question creates a history entry in localStorage (`lib/history.ts`) and then navigates by id. Each page reads its entry and calls the existing APIs:
- `/api/solve` for the chat answer.
- `/api/lesson`, `/api/speak` and `/api/listen` for the whiteboard.
- A new `/api/flashcards` route.

All parsing is done by pure, tested `lib/*` functions. Components only render.

**Tech Stack:** Next.js 16, React 19, TypeScript, `next/font/google` (Inter, Kalam), katex via `lib/mathtext.ts`, pdfjs-dist via `lib/pdfrender.ts`, and `node --test` for tests.

**Spec:** The recording `ui-ux/Desktop 2026.10.22 - 19.26.28.02.mp4` (68 extracted frames reviewed). The values that define it are copied into Global Constraints and the tasks below. When a value is missing, the executor should open the video at the matching moment rather than invent one.

## Global Constraints

- **Delete before building.** Remove all of the old UI before building anything:
  - `app/Hero.tsx`, `app/ScrollReveal.tsx`, `app/Sidebar.tsx`.
  - `app/board/`, `app/pdf/`, `app/solve/`.
  - Do not import old components. Keep `app/useMic.ts` and every `app/api/*` and `lib/*` file unchanged unless a task names one.
- **Light theme only.**
  - Page background is `#ffffff`.
  - Sidebar is `#f7f7f8`, about 260px wide, with a 1px `#ececee` right border.
  - Text is `#1a1a1a`, muted text `#6b6b76`.
  - The accent/link blue is `#2f6bff`.
  - The moon toggle is visual only (YAGNI: no dark theme).
- **UI font:** Inter. **Board font:** Kalam (Caveat is acceptable as a fallback).
  - The board background is cream `#faf8f3`.
  - The board title is green `#1f7a4d`.
  - Board ink maps `lib/board.ts` COLORS as follows: ink `#2b2b2b`, purple `#7b4fd6`, orange `#e8833a`, green `#1f7a4d`, red `#d9443a`, blue `#2f6bff`.
- **Sidebar items, in this order:**
  1. Logo "Solvely"
  2. "New chat"
  3. "Home"
  4. "Whiteboard Tutor" (badge "New")
  5. "Flashcards"
  6. "Quiz"
  7. "Study Guide"
  8. "History" (section of recent entries)

  The bottom of the sidebar holds an "Upgrade" button and a moon icon.
- **Home:**
  - Tabs: "Study", "Exam Prep", "Writing".
  - Mode chips: "Solver", "Whiteboard Tutor", "Flashcards", "Quiz", "Study Guide".
  - Input placeholder: "Ask anything or upload a file".
- **Chat top bar buttons:** "Review later", "New question", "History", "Upgrade".
- **Lesson input placeholder:** "Type your question or response". End button: "End lesson". Rating modal title: "How was this session?".
- **Limits:** Topic/question max is 600 chars (`MAX_TOPIC` from `lib/validate.ts`). Speed steps are `0.75, 1.0, 1.25, 1.5, 2.0` and the label reads like "1.0x Speed".
- **Out of scope:** No new npm dependencies, no auth backend, no payments. The Quiz and Study Guide chips route to the chat page with a prefixed prompt; there is no dedicated backend for them.
- After every task, run `npm test` (green) and `npx tsc --noEmit` (clean). After the final task, also run `graphify update`.

## Review Focus

1. **Missing or broken localStorage.** The case is localStorage being unavailable (private mode) or holding corrupt JSON. Expected: `listEntries()` returns `[]` and `saveEntry` silently no-ops; the page never crashes. Test is in Task 2.
2. **A URL whose id isn't in history.** The case is opening `/chat/<id>` or `/home/whiteboard-tutor/<id>` with an id that is not stored (a shared link, or cleared storage). Expected: a "This chat isn't available" message with a link Home, not a crash or an infinite spinner. `getEntry` returns `null` for an unknown id (test in Task 2), and the pages render the fallback (Tasks 6 and 8).
3. **A solve stream that cuts out or never reaches "Answer:".** This includes the case where it ends with `[Error: could not finish solving. Try again.]`. Expected: the steps parsed so far still render, the final answer box is hidden, and an error line with a "Try again" button shows. Test is in Task 6.
4. **Malformed flashcard output.** The LLM may return fenced JSON, fewer than 5 cards, or cards with empty fields. Expected: only valid cards are kept; if there are zero, the widget shows "Couldn't make flashcards" plus Retry. Test is in Task 7.
5. **Empty, whitespace-only or over-long input.** This covers input over 600 chars on home or in the lesson ask pill. Expected: Send is disabled and nothing navigates or posts. `canSubmit` test is in Task 4.

---

### Task 1: Wipe old UI; tokens, fonts, root layout

**Files:**
- Delete: `app/Hero.tsx`, `app/ScrollReveal.tsx`, `app/Sidebar.tsx`, `app/board/`, `app/pdf/`, `app/solve/`
- Rewrite: `app/globals.css`, `app/layout.tsx`, `app/page.tsx` (placeholder `<h1>Solvely</h1>` until Task 4)

**Interfaces:**
- Produces:
  - CSS variables on `:root`: `--bg`, `--side`, `--line`, `--text`, `--muted`, `--blue`, `--board`, `--board-title`, `--ink-{ink,purple,orange,green,red,blue}`.
  - Font classes `.font-board` (Kalam) and `body` set to Inter via `next/font` variables `--font-ui` and `--font-board`.

- [ ] **Step 1: Delete the old files.** Then run `npx tsc --noEmit`. Expected: no errors referencing the deleted files. Run `npm test` and confirm the `lib/*` tests are still green.
- [ ] **Step 2: Write `globals.css`** with the tokens above, a box-sizing reset, `body { margin:0; background:var(--bg); color:var(--text) }`, the katex CSS import (keep it if the old file had it), and a `@keyframes shimmer` (gradient sweep, used for the status lines in Task 6).
- [ ] **Step 3: Write `layout.tsx`.**
  - Load `Inter` and `Kalam` (weights 400 and 700) from `next/font/google`.
  - Set `metadata.title = "Solvely"`.
  - Render `<html><body className={vars}>{children}</body></html>`. The shell comes in Task 3.
- [ ] **Step 4: Verify.** Run `npm run build`. Expected: build passes and `/` renders "Solvely".
- [ ] **Step 5: Commit.** Message: `chore(ui): remove old UI, add solvely tokens and fonts`.

### Task 2: `lib/history.ts` (TDD)

**Files:** Create `lib/history.ts` and `lib/history.test.ts`.

**Interfaces:**
- Produces:
  - `type Mode = "solver" | "whiteboard" | "flashcards" | "quiz" | "guide"`
  - `type Entry = { id: string; mode: Mode; prompt: string; image?: { mediaType: string; data: string }; createdAt: number }`
  - `newEntry(mode: Mode, prompt: string, image?: Entry["image"]): Entry`, which uses `crypto.randomUUID()` and `Date.now()`.
  - `saveEntry(e: Entry, store?: Storage): void`, which puts the newest entry first, caps the list at 50, and stores it under key `"solvely.history"`.
  - `listEntries(store?: Storage): Entry[]`
  - `getEntry(id: string, store?: Storage): Entry | null`
  - `store` defaults to `globalThis.localStorage` and is passed in tests as a fake `{getItem, setItem}`.

- [ ] **Step 1: Write the failing tests** in `lib/history.test.ts`:
  - `saveEntry then getEntry returns it`
  - `listEntries is newest first and capped at 50`: save 51 and assert `length === 50` and that `[0]` is the last one saved.
  - `getEntry unknown id returns null`
  - `corrupt JSON yields []`: a store whose `getItem` returns `"{oops"`. Assert `listEntries(store)` deep-equals `[]`.
  - `throwing store is ignored`: a store whose `getItem` and `setItem` throw. Assert `listEntries` returns `[]` and `saveEntry` does not throw.
- [ ] **Step 2: Run the tests and confirm they fail.** Run `node --test lib/history.test.ts`. Expected: FAIL, module not found.
- [ ] **Step 3: Implement** `lib/history.ts`. Wrap the parse and storage access in try/catch, and return `[]` if the parsed value is not an array.
- [ ] **Step 4: Run the tests again.** Run `node --test lib/history.test.ts`. Expected: PASS.
- [ ] **Step 5: Commit.** Message: `feat(lib): localStorage chat history`.

### Task 3: App shell — Sidebar, TopBar

**Files:**
- Create: `app/shell/Shell.tsx` (client), `app/shell/Sidebar.tsx`, `app/shell/TopBar.tsx`
- Modify: `app/layout.tsx` so it wraps `children` in `<Shell>`

**Interfaces:**
- Consumes: `listEntries`, `Entry` (Task 2).
- Produces:
  - `<Shell>`: a two-column flex layout (sidebar plus main). The sidebar can collapse via a toggle icon at the top.
  - `<TopBar right?: ReactNode>`: a 56px bar with a bottom border. Pages pass their own buttons.
  - The sidebar History list re-reads on a `"solvely:history"` window event. `saveEntry` must `dispatchEvent(new Event("solvely:history"))` when `window` exists (add this to Task 2's file).

- [ ] **Step 1: Build the Sidebar.**
  - Use the exact item order and labels from Global Constraints.
  - Use inline SVG icons (no icon library). The active item gets a `#ececee` pill.
  - "New chat" and "Home" link to `/`. "Whiteboard Tutor", "Flashcards", "Quiz" and "Study Guide" link to `/?mode=<mode>`.
  - History rows show `prompt` truncated to 1 line and link to the page for that entry's mode (`hrefFor` from Task 4).
- [ ] **Step 2: Build the bottom block.** It holds a blue filled "Upgrade" button (full width, radius 10px) and a moon icon button.
- [ ] **Step 3: Verify.** Run `npm run build` and confirm it passes. Start the preview and use `read_page` to check that the sidebar labels appear in order.
- [ ] **Step 4: Commit.** Message: `feat(ui): app shell with sidebar and top bar`.

### Task 4: Home page — tabs, input card, chips, examples

**Files:**
- Create: `lib/modes.ts` and `lib/modes.test.ts`, `app/home/InputCard.tsx`
- Rewrite: `app/page.tsx`

**Interfaces:**
- Consumes: `newEntry`, `saveEntry`, `Mode` (Task 2); `MAX_TOPIC` (`lib/validate.ts`).
- Produces:
  - `MODES: { id: Mode; label: string }[]`, in chip order.
  - `hrefFor(e: Entry): string`. It returns `/home/whiteboard-tutor/<id>` for `whiteboard` and `/chat/<id>` for every other mode.
  - `canSubmit(text: string, hasImage: boolean): boolean`. It returns true when the trimmed text is between 1 and `MAX_TOPIC` chars, or when there is an image and the text is no longer than `MAX_TOPIC`.

- [ ] **Step 1: Write the failing tests** in `lib/modes.test.ts`:
  - `hrefFor(whiteboard)` starts with `/home/whiteboard-tutor/`.
  - `hrefFor(solver)` starts with `/chat/`.
  - `canSubmit("", false) === false`, `canSubmit("   ", false) === false`, `canSubmit("x".repeat(601), false) === false`, `canSubmit("2+2", false) === true`, `canSubmit("", true) === true`.
- [ ] **Step 2: Run them and confirm they fail.** Run `node --test lib/modes.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `lib/modes.ts`.
- [ ] **Step 4: Run them and confirm they pass.** Run `node --test lib/modes.test.ts`. Expected: PASS.
- [ ] **Step 5: Build the Home page.**
  - Centered heading as shown in the video, then the tabs "Study", "Exam Prep" and "Writing". Only Study is functional; the others switch the example set.
  - The `InputCard` is a white card with a 1px `--line` border, 16px radius and a soft shadow. It holds:
    - a textarea with the placeholder "Ask anything or upload a file";
    - a paperclip button that takes an image upload and shows a thumbnail chip (read it as base64 with FileReader);
    - a mic button that uses `useMic` and appends its text to the textarea;
    - a round dark send button, disabled when `!canSubmit`.
  - Below the card are the mode chips. The selected chip is outlined blue. The initial chip comes from the `?mode=` search param.
  - Enter submits and Shift+Enter makes a newline.
  - Submit runs `newEntry(mode, text, image)`, then `saveEntry`, then `router.push(hrefFor(e))`.
- [ ] **Step 6: Add example cards.** Below the input, a grid of 3 example cards with the video's examples (open the video to copy their text). Clicking one fills the textarea.
- [ ] **Step 7: Verify in the browser.**
  - Typing "derivative of x^2" with Solver and pressing Enter goes to `/chat/<uuid>`.
  - With Whiteboard Tutor it goes to `/home/whiteboard-tutor/<uuid>`.
  - With an empty input, the send button is disabled.
- [ ] **Step 8: Commit.** Message: `feat(ui): home page with mode chips and routing`.

### Task 5: Login modal (UI only)

**Files:** Create `app/shell/LoginModal.tsx`. Modify `Sidebar.tsx` to add a "Log in" button above Upgrade that opens the modal.

**Interfaces:**
- Produces: `<LoginModal open: boolean; onClose(): void>`.

- [ ] **Step 1: Build the modal** to match the video:
  - centered card, 420px wide, on a dimmed backdrop;
  - "Continue with Google" button (outlined);
  - "or" divider;
  - email input;
  - "Next" button, enabled only when the email matches `/^\S+@\S+\.\S+$/`.

  Next and Google both just call `onClose()`. Add the comment `// shortcut: no auth backend, wire real auth when accounts exist`.
- [ ] **Step 2: Make it accessible.** Use `role="dialog"` and `aria-modal`. Esc and a backdrop click close it, and focus moves to the email input on open.
- [ ] **Step 3: Verify.** In the browser, Next is disabled for "abc" and enabled for "a@b.co", and Esc closes the modal.
- [ ] **Step 4: Commit.** Message: `feat(ui): login modal`.

### Task 6: Chat answer page with streaming

**Files:**
- Create: `lib/answer.ts` and `lib/answer.test.ts`, `app/chat/[id]/page.tsx`, `app/chat/Chat.tsx`

**Interfaces:**
- Consumes: `getEntry` (Task 2), `TopBar` (Task 3), `mathText` (`lib/mathtext.ts`), and `/api/solve` (POST `{text?, image?}`, streaming `text/plain`).
- Produces: `parseAnswer(text: string): { summary: string; steps: { title: string; body: string }[]; answer: string | null; error: boolean }`. Parsing rules:
  - Lines matching `/^\s*(?:Step\s*)?(\d+)[.):]\s*(.*)$/i` start a step, and that first line becomes the title.
  - Text before the first step is `summary`.
  - Text after a line starting with `Answer:` is `answer`.
  - `error` is set when the text contains `[Error: could not finish solving`. The error text is removed from the step bodies.

- [ ] **Step 1: Write the failing tests** in `lib/answer.test.ts`:
  - `parses steps and answer`: the input `"Intro\n1. Differentiate\nUse power rule\n2. Simplify\n2x\nAnswer: 2x"` gives summary `"Intro"`, 2 steps with titles `"Differentiate"` and `"Simplify"`, and answer `"2x"`.
  - `partial stream has no answer`: `"1. Differentiate\nUse"` gives 1 step and `answer === null`.
  - `error suffix flagged and stripped`: `"1. A\nb\n\n[Error: could not finish solving. Try again.]"` gives `error === true` and `steps[0].body === "b"`.
  - `no numbered steps`: `"Just text"` gives summary `"Just text"` and `steps.length === 0`.
- [ ] **Step 2: Run them and confirm they fail.** Run `node --test lib/answer.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `parseAnswer`.
- [ ] **Step 4: Run them and confirm they pass.** Run `node --test lib/answer.test.ts`. Expected: PASS.
- [ ] **Step 5: Build `Chat.tsx`.**
  - If `getEntry(id)` is null, render "This chat isn't available" and a Home link.
  - Otherwise show the user's question as a right-aligned grey bubble (with the image thumbnail if there is one).
  - While waiting for the first byte, show shimmer status lines, cycling "Reading your question…" then "Solving step by step…".
  - Stream with `res.body.getReader()` and re-run `parseAnswer` on the accumulated text each chunk.
- [ ] **Step 6: Build the answer layout** to match the video:
  - Answer cards row: "Video Explanation" (button "Watch Now" creates a whiteboard entry with the same prompt and pushes to it) and "Tutor Me" (the same action).
  - Blue "Explanation" heading, then numbered step blocks (a number circle, a bold title, and a body rendered with `mathText`), then a final "Answer" box with a light blue background.
  - Helpful? 👍/👎 (local state only).
  - A "Go further" chips row with "Flashcards" (opens the Task 7 widget inline), "Quiz me" and "Explain simpler" (each starts a new solver entry with a prefixed prompt).
  - If `error` is set, show an error line and a "Try again" button that re-fetches.
- [ ] **Step 7: Add the TopBar buttons.** "Review later" and "History" are no-op/visual. "New question" goes to `/`. "Upgrade" is visual.
- [ ] **Step 8: Verify in the browser.** Run the question "derivative of x^2". Expected: shimmer, then streamed steps, then the Answer box. Then visit `/chat/does-not-exist` and confirm the fallback renders.
- [ ] **Step 9: Commit.** Message: `feat(ui): chat answer page with streaming steps`.

### Task 7: Flashcards — lib, API route, widget

**Files:**
- Create: `lib/flashcards.ts` and `lib/flashcards.test.ts`, `app/api/flashcards/route.ts`, `app/chat/Flashcards.tsx`
- Modify: `app/chat/Chat.tsx` to mount the widget, auto-opened when `entry.mode === "flashcards"`

**Interfaces:**
- Consumes: `extractJson` (`lib/lesson.ts`), and `llmText` / `Msg` (`lib/llm.ts`). Read its signature before use.
- Produces:
  - `type Card = { q: string; a: string }`
  - `parseFlashcards(raw: string): Card[]`. It runs `extractJson`, accepts either `{cards: [...]}` or a bare array, keeps only items whose `q` and `a` are non-empty strings after trimming, and caps the result at 5.
  - `POST /api/flashcards {topic: string}` returns `{cards: Card[]}`. It returns 400 when `topic` is empty or longer than `MAX_TOPIC`, and 502 when there are zero cards.

- [ ] **Step 1: Write the failing tests** in `lib/flashcards.test.ts`:
  - `bare array`: `'[{"q":"A","a":"B"}]'` gives `[{q:"A",a:"B"}]`.
  - `fenced object`: `` '```json\n{"cards":[{"q":"A","a":"B"}]}\n```' `` gives 1 card.
  - `drops invalid and caps at 5`: 7 items, one with `a:""` and one missing `q`, gives a length of 5.
  - `garbage gives []`: `"nope"` gives `[]`.
- [ ] **Step 2: Run them and confirm they fail.** Run `node --test lib/flashcards.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `parseFlashcards`, then the route. The system prompt asks for exactly 5 concise Q/A pairs as JSON `{cards:[{q,a}]}`.
- [ ] **Step 4: Run them and confirm they pass.** Run `node --test lib/flashcards.test.ts`. Expected: PASS.
- [ ] **Step 5: Build the widget** to match the video:
  - A card counter like "1 / 5".
  - A large card that flips on click with a CSS 3D `rotateY(180deg)`: question on the front, answer on the back.
  - Buttons "Need to review" and "Mastered", which advance to the next card and tally the counts.
  - After the last card, a summary showing the counts and a "Restart" button.
  - If the request fails or returns zero cards, show "Couldn't make flashcards" and a "Retry" button.
- [ ] **Step 6: Verify in the browser.** Go further, then Flashcards. Expected: 5 cards, flipping works, and the counter advances.
- [ ] **Step 7: Commit.** Message: `feat: flashcards api and widget`.

### Task 8: Whiteboard lesson — loading card and lesson fetch

**Files:** Create `app/home/whiteboard-tutor/[id]/page.tsx`, `app/home/whiteboard-tutor/Lesson.tsx` (client, owns state) and `app/home/whiteboard-tutor/LoadingCard.tsx`.

**Interfaces:**
- Consumes: `getEntry` (Task 2); `/api/lesson` POST `{topic}`, which returns `{script: BoardScript, fallback}`; `BoardScript` (`lib/board.ts`).
- Produces: the `Lesson` state shape `{ script: BoardScript | null; step: number; playing: boolean; asks: { at: number; text: string }[] }`. `at` is the step index where the asked question's appended steps begin. Tasks 9–11 receive these as props.

- [ ] **Step 1: Handle the unknown-id case.** If `getEntry(id)` is null, render the "This lesson isn't available" fallback with a Home link.
- [ ] **Step 2: Build `LoadingCard`** to match the video. It is a centered wide card:
  - The left 40% is a blue panel with an auto-advancing carousel of 3 tip slides (copy their text from the video).
  - The right side is a 5-step checklist whose items tick on a timer every about 2.5s, holding on the last item until the script arrives. Copy the step labels from the video.
- [ ] **Step 3: Fetch the lesson.** Fetch `/api/lesson` with `{topic: entry.prompt}`. On success, swap to the lesson layout (Tasks 9–11). On failure, show an error and a "Try again" button.
- [ ] **Step 4: Verify in the browser.** The loading card shows, then the lesson layout replaces it.
- [ ] **Step 5: Commit.** Message: `feat(ui): whiteboard loading card and lesson fetch`.

### Task 9: Board surface — handwritten SVG, zoom/pan, Follow tutor

**Files:** Create `app/home/whiteboard-tutor/BoardSurface.tsx` and `app/home/whiteboard-tutor/shapes.tsx`.

**Interfaces:**
- Consumes: `W`, `H`, `Shape`, `focusBox` (`lib/board.ts`); `shapeDelays` (`lib/sync.ts`); `mathText` for text shapes when they contain `$`.
- Produces: `<BoardSurface script step clipSeconds follow onFollowChange />`. Panel `i` is drawn at x offset `i * 1040`. Shapes for steps before `step` render fully. Shapes of the current step reveal using `shapeDelays(step, clipSeconds)`, with a stroke-dashoffset draw animation for strokes and a fade for text, labels and icons.

- [ ] **Step 1: Write `shapes.tsx`**, a `renderShape(s: Shape)` switch covering every Shape kind in `lib/board.ts`:
  - line, arrow (with a marker head), highlight (wide translucent stroke), circle, ellipse, rect, path, text (`.font-board`, given `size`), label (text plus a smaller muted `note`), and icon.
  - Icons are inline SVG for the 8 names in `ICONS`.
  - Colours come from `--ink-*`.
- [ ] **Step 2: Build `BoardSurface`.**
  - A cream `--board` viewport.
  - The `script.title` is green in Kalam at the top-left of panel 0, with the subtitle muted below it.
  - Wheel zooms, clamped to 25%–300%, and drag pans.
  - Top-right shows the zoom percent ("84%" style, `Math.round(scale*100)+"%"`) with −/+ buttons.
  - When `follow` is true, the camera animates to fit `focusBox` of the current step's shapes (offset by panel x). Any manual pan or zoom sets follow to false.
  - A "Follow tutor" pill shows bottom-center when follow is false and clicking it sets follow back to true.
- [ ] **Step 3: Verify in the browser.** Go through the lesson steps: the strokes draw, the camera follows, a manual drag shows the Follow tutor pill, and clicking the pill re-centres.
- [ ] **Step 4: Commit.** Message: `feat(ui): handwritten board surface with follow camera`.

### Task 10: Course source panel

**Files:** Create `app/home/whiteboard-tutor/SourcePanel.tsx`.

**Interfaces:**
- Consumes: `renderScale` (`lib/pdfrender.ts`) and pdfjs-dist (dynamic import; reuse the worker setup pattern from the old PdfPane via git history: `git show HEAD:app/pdf/PdfPane.tsx`).
- Produces: `<SourcePanel />`, a left column with a resizable width clamped to 175–295px. It is self-contained.

- [ ] **Step 1: Build the panel.**
  - A "COURSE SOURCE" uppercase muted heading, and an upload dropzone ("Upload files", accepting image/* and .pdf).
  - Images show as thumbnails. A PDF renders each page to a canvas thumbnail labelled "PAGE N".
  - A drag handle on the right edge resizes the panel within 175–295px.
  - Add the comment `// shortcut: sources are display-only, not sent to /api/lesson; wire when lesson API accepts context`.
- [ ] **Step 2: Verify in the browser.** Uploading a 2-page PDF shows "PAGE 1" and "PAGE 2", and the width clamps at the limits.
- [ ] **Step 3: Commit.** Message: `feat(ui): course source panel`.

### Task 11: Narration bottom bar, ask/mic, top controls, end-lesson modal

**Files:** Create `app/home/whiteboard-tutor/BottomBar.tsx` and `app/home/whiteboard-tutor/EndModal.tsx`. Modify `Lesson.tsx` to wire playback, asks and the top-right controls.

**Interfaces:**
- Consumes:
  - `loadClips(says, speak, stored?)` (`lib/clips.ts`). Read its file for the exact return type.
  - `/api/speak`.
  - `/api/lesson` with `doubt: {question, say, titles, prev?}`. Its response steps are appended after the current step.
  - `useMic(onText)` (`app/useMic.ts`), which returns `{state, micError, toggleMic}`.
  - `canSubmit` (Task 4).
- Produces: `<BottomBar caption playing onPlayPause volume onVolume onAsk(text) busy />` and `<EndModal open onSubmit(stars) onClose />`.

- [ ] **Step 1: Wire playback in `Lesson.tsx`.**
  - Load the clips for every `step.say`. Play the clip for the current step with `audio.playbackRate = speed` and `audio.volume = volume`.
  - On `ended`, advance the step. At the last step, set playing to false.
  - If a clip fails, fall back to a timer of `say.length * 60ms / speed`, so the lesson still advances with captions only.
- [ ] **Step 2: Build `BottomBar`** to match the video:
  - a tutor avatar circle, then the current `say` caption (2 lines, ellipsis);
  - a play/pause button and a volume slider;
  - the input pill "Type your question or response", with the send button disabled when `!canSubmit(text,false)`;
  - a mic button that shows the recording state.

  Asking pauses playback and shows a "YOUR QUESTION" pill on the board at the current position. It then POSTs a doubt and splices the returned steps in after the current step, then plays them. `busy` disables the input while the doubt is in flight.
- [ ] **Step 3: Add the top-right controls.**
  - The zoom % (from Task 9).
  - A speed button cycling `0.75, 1.0, 1.25, 1.5, 2.0` and labelled like "1.0x Speed".
  - A download button that serialises the board SVG to a `.svg` file (`Blob` plus an `a[download]`).
  - A dark "End lesson" button.
- [ ] **Step 4: Build `EndModal`.** It shows "How was this session?", 5 hoverable stars and a "Submit" button that is disabled until a star is picked. Submit goes to `router.push("/")`.
- [ ] **Step 5: Verify in the browser.**
  - Audio plays and the captions update.
  - Changing speed changes the rate.
  - Typing a question appends steps, with the "YOUR QUESTION" pill visible.
  - End lesson, then stars, then Submit lands on Home.
- [ ] **Step 6: Commit.** Message: `feat(ui): lesson narration, questions, end modal`.

### Task 12: Final verification

- [ ] **Step 1: Check for leftover old code.** Run `npm test`, `npx tsc --noEmit` and `npm run build`; all must pass. Then confirm that searching for `Hero|ScrollReveal|app/board|app/pdf|app/solve` under `app/` returns nothing.
- [ ] **Step 2: Run the full flow in the browser at 1440×900.**
  - home, then solver, then chat with flashcards;
  - home, then whiteboard, then lesson, then ask, then end, then rate.

  Screenshot each surface and compare it side by side with the matching video frames (`f_*.jpg`). Fix any visible mismatch in spacing, colour or copy.
- [ ] **Step 3: Check mobile width.** At 375px, the sidebar collapses behind its toggle and no screen scrolls horizontally.
- [ ] **Step 4: Update and commit.** Run `graphify update`, then commit with the message `chore: refresh graph after UI rebuild`.
