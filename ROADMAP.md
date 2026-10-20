# StepWise Board: roadmap

## Goal

A whiteboard tutor that **draws and talks**. It combines the two reference reels:

- **Teach mode** (studywith.karen reel): the student asks for a topic. The AI draws a labelled diagram stroke by stroke and narrates each part as it appears. A persona sets the tone, for example "gossip": *"The cell's group chat"*.
- **Watch mode** (rosacodes reel): the student works on the board with a pen or mouse. The AI watches quietly, stays silent while things are going well, and gives a spoken and written hint only when the student is stuck or makes a mistake.

### Stack

| Job | Model or tool |
|---|---|
| Reasoning and lesson scripts | Gnani Evon v3.3 (already wired in `app/api/solve/route.js`) |
| Reading handwriting and canvas images | Gemini Flash (already wired as `readPhoto`) |
| Voice | Gnani TTS; browser `speechSynthesis` as fallback |
| Drawing | Plain SVG + pointer events, no new dependencies |
| Data | Synthetic only (hackathon rule) |

Out of scope for v1: accounts, saved history, payments, multiplayer boards, and a native app.

---

## Phase 0: Decisions and groundwork (S)

| # | Task | Done when |
|---|---|---|
| 0.1 | Confirm Gnani TTS access: endpoint, voices, languages, latency, and whether it supports style or emotion | Note in `FINDINGS.md`: model name, request shape, voice list, and p50 latency for a 15-word line |
| 0.2 | Confirm Evon can return strict JSON reliably (try 20 topics at `temperature` 0.3) | At least 90% parse on the first try; failures are noted |
| 0.3 | Fix the board coordinate system: a **1000×700** virtual canvas, scaled to fit the screen | Written into the board script spec (below) |
| 0.4 | Choose fonts: Google Fonts *Caveat* for the AI's handwriting, *Inter* for the UI | Loaded in `app/layout.js` |
| 0.5 | Add `TTS_*` variables to `.env.example` | Variables documented |

## Phase 1: The board script format and renderer, with no AI (M)

This is the core of the product. Everything the AI "draws" is data in this format.

**Board script (JSON):**
```json
{
  "title": "The cell's group chat",
  "subtitle": "Same cell. A lot of drama.",
  "steps": [
    {
      "say": "Okay so the nucleus? Thinks she runs the place.",
      "draw": [
        { "type": "circle", "x": 500, "y": 380, "r": 70, "color": "purple" },
        { "type": "text", "x": 500, "y": 385, "text": "DNA", "color": "purple" },
        { "type": "label", "x": 120, "y": 200, "text": "Nucleus", "note": "\"thinks she runs the place\"", "color": "purple" },
        { "type": "arrow", "from": [200, 230], "to": [440, 360], "color": "ink" }
      ]
    }
  ]
}
```

**Shape types (v1):**
- `line`, `arrow`, `circle`, `ellipse`, `rect`
- `path` (free SVG path `d`, for organelles and squiggles)
- `text`, `label` (a heading plus a handwritten note)
- `icon` (a small fixed set: crown, bolt, star, check, cross)
- `highlight` (a translucent marker stroke)

**Colors:** a named palette only (`ink`, `purple`, `orange`, `green`, `red`, `blue`), mapped to CSS tokens. The model never sends raw colors.

| # | Task | Files | Done when |
|---|---|---|---|
| 1.1 | Schema validator: clamp coordinates to the canvas; limit shapes per step (≤ 8), steps (≤ 12) and text length; drop unknown types | `lib/board.js`, `lib/board.test.mjs` | Tests cover bad types, coordinates out of range, missing `say`, and oversized scripts |
| 1.2 | Synthetic fixtures: hand-written scripts for cell organelles, the water cycle, Pythagoras and photosynthesis | `lib/fixtures/*.json` | All four pass the validator |
| 1.3 | `<Board>` renderer: SVG `viewBox="0 0 1000 700"` | `app/board/Board.js` | Fixtures render correctly at phone and desktop widths |
| 1.4 | Hand-drawn animation: stroke reveal through `stroke-dasharray`/`dashoffset`, text typed a character at a time, slight random wobble (seeded, so replays look the same) | `app/board/Board.js`, `app/globals.css` | Each step animates in about 1–3 s |
| 1.5 | Playback controls: play, pause, previous/next step, replay, speed (1×, 1.5×) | `app/board/Player.js` | Works with keyboard (Space, ←, →) |
| 1.6 | `/board` page that loads a fixture through `?demo=cell` | `app/board/page.js` | Offline demo works with no API keys |
| 1.7 | Respect `prefers-reduced-motion`: show each step instantly | CSS | Checked in a browser |

## Phase 2: Lesson generation in Teach mode (M)

| # | Task | Files | Done when |
|---|---|---|---|
| 2.1 | `POST /api/lesson` `{ topic, persona, level, lang }` → board script. Evon is called with a JSON-only system prompt that includes the schema and one few-shot example | `app/api/lesson/route.js` | Returns valid JSON for the four fixture topics |
| 2.2 | Move the shared Evon call out of `/api/solve` into one helper, with the same error handling | `lib/evon.js` | `/api/solve` behaves exactly as before; both routes use the helper |
| 2.3 | Repair loop: if parsing or validation fails, send the error back to Evon once, then fall back to a closest-fixture or "text-only" script | `app/api/lesson/route.js` | Test with a mocked bad response |
| 2.4 | Layout guidance in the prompt: zones (title band at the top, main diagram in the centre, labels on the left and right), no overlaps, and arrows from labels to parts | prompt in `lib/prompts.js` | Visual check of 10 generated topics: no more than one overlap each |
| 2.5 | Optional: auto-layout after generation, nudging overlapping label boxes apart | `lib/board.js` | Has a test, if built |
| 2.6 | Stream steps (NDJSON, one step per line) so drawing starts before the whole script exists | route + Player | First stroke appears in under 3 s |
| 2.7 | Photo to lesson: the student uploads their notes, Gemini transcribes them, and Evon makes a board from them (the reel's "turning notes into tea") | reuse `readPhoto` | Works on 3 synthetic note photos |
| 2.8 | Input validation: topic up to 300 characters, persona and lang from an allow-list, same limits as `parseSolveRequest` | `lib/validate.js` | Tests |

## Phase 3: Voice (M)

| # | Task | Files | Done when |
|---|---|---|---|
| 3.1 | `POST /api/speak` `{ text, voice, lang }` → audio, through Gnani TTS | `app/api/speak/route.js` | Returns playable audio |
| 3.2 | Sync narration to drawing: step N's strokes start when its audio starts, and step N+1 waits until both its audio and animation finish. Fetch audio for step N+1 while step N plays | `app/board/Player.js` | No gap over 400 ms between steps on a normal connection |
| 3.3 | Fallback: if TTS fails or is slow (over 2.5 s), use the browser's `speechSynthesis` for that step | Player | Demo still talks with TTS switched off |
| 3.4 | Captions: the `say` text appears as a subtitle bar (accessibility, and use with the sound off) | Board | Always on; can be toggled |
| 3.5 | Cache audio by a hash of text, voice and language, in memory per session | route | A replay sends no second TTS call |
| 3.6 | Mute, volume and voice selection in the UI | Player | |

## Phase 4: Personas (S)

Personas live in a single prompt file that sets tone, wording and colour choices. Nothing else changes.

| Persona | Tone | Example line |
|---|---|---|
| `teacher` (default) | Clear, calm | "The nucleus stores the DNA, the cell's instructions." |
| `gossip` | Group-chat drama, light slang, emoji in the notes | "Nucleus thinks she runs the place 💅" |
| `coach` | Hype, short sentences | "Mitochondria. Powerhouse. Let's go." |
| `story` | A small narrative | "Once upon a time, in a cell far away…" |

| # | Task | Done when |
|---|---|---|
| 4.1 | Persona prompts plus one example script each | `lib/prompts.js` |
| 4.2 | Accuracy guardrail: the persona changes **tone only**, never the facts. The prompt says so, and a second cheap Evon pass, "list any factual errors in these notes", runs on 20 topics during evaluation | Error rate noted in `FINDINGS.md` |
| 4.3 | Keep content kind: no insults about real people; the gossip is about organelles, not classmates | Prompt rule plus a review of 20 outputs |
| 4.4 | Voice per persona, if Gnani offers several voices or styles | Mapped in `lib/prompts.js` |

## Phase 5: Student ink canvas (M)

| # | Task | Files | Done when |
|---|---|---|---|
| 5.1 | Pointer Events drawing, covering pen, touch and mouse, with `pressure` mapped to width. Strokes are kept as point arrays in the same 1000×700 space | `app/board/Ink.js` | Smooth on an iPad with Pencil and on Android with a stylus |
| 5.2 | Palm rejection: when a pen is detected, ignore `pointerType === "touch"`; set `touch-action: none` on the canvas | Ink | Resting a hand doesn't draw |
| 5.3 | Tools: pen, eraser (by stroke), undo/redo, clear, 3 colours | Ink + toolbar | Keyboard shortcuts work (Ctrl+Z, Ctrl+Y) |
| 5.4 | Layering: the AI draws on a layer above the student's, and the student can hide the AI layer | Board | |
| 5.5 | Export: render the strokes to a PNG data URL (offscreen canvas) under 4 MB, so it fits the existing image validator | Ink | Passes `parseSolveRequest` |
| 5.6 | Problem area: the student can type or paste the question at the top of the board, so the AI knows the task | page | |

## Phase 6: Watch mode, the silent tutor (L)

The hard part is deciding **when** to speak. If the tutor talks too often, students turn it off.

**Loop:**
1. **Trigger.** Check only after the student pauses: no new stroke for 2.5 s, and at least 3 new strokes since the last check, or a "Help" button press. Never more than one check per 8 s.
2. **Read.** Send the canvas PNG to Gemini Flash: "Transcribe the student's working line by line, including crossed-out parts."
3. **Judge.** Send the problem, the transcript, the previous hints and the hint level to Evon, which returns strict JSON:
   ```json
   { "action": "silent" | "nudge" | "hint" | "correct" | "praise",
     "say": "Check the sign on line 2.",
     "mark": { "type": "circle", "x": 310, "y": 220, "r": 40, "color": "red" } }
   ```
4. **Act.** If the action is `silent`, do nothing. Otherwise speak the `say` text and draw the `mark` on the AI layer, using Phase 1 and Phase 3 code.

| # | Task | Files | Done when |
|---|---|---|---|
| 6.1 | `POST /api/watch` `{ problem, image, history, level }` → action JSON | `app/api/watch/route.js` | Tests with mocked Gemini and Evon responses |
| 6.2 | Trigger policy in the client: debounce on stroke idle, a minimum gap, and a stroke-count delta. Skip the call when the image hash is unchanged | `app/board/useWatcher.js` | Unit test of the policy as a pure function |
| 6.3 | Hint ladder: `nudge` ("look at line 2") → `hint` (the method) → `correct` (the fix) → full solution, offered only when asked or after 3 hints | prompt + state | Script test on 5 synthetic wrong solutions |
| 6.4 | Positioning: Gemini returns rough line boxes, so `mark` coordinates point at the right line. If the boxes are unreliable, fall back to a margin note next to the latest strokes | `/api/watch` | Mark lands near the error on 4 of 5 test boards |
| 6.5 | Settings for how chatty the tutor is: Quiet (only on Help), Normal, Chatty | UI | |
| 6.6 | "I'm stuck" and "Check my work" buttons as explicit triggers | UI | |
| 6.7 | Cost guard: an image-size cap, a daily per-device limit, and checks paused while the tab is hidden | client + route | |
| 6.8 | Evaluation set: 20 synthetic handwritten solutions (10 correct, 10 with one planted error) | `lib/fixtures/watch/` | Stays silent on at least 8 of 10 correct ones; catches at least 7 of 10 errors |

## Phase 7: One board, both modes (S)

| # | Task | Done when |
|---|---|---|
| 7.1 | Switch modes on one board: Teach, then "now you try" turns into Watch on a practice problem the lesson generates | A full loop works in the demo |
| 7.2 | "Explain this" lasso: the student circles part of the AI's drawing, and the AI re-narrates that part | Optional stretch |
| 7.3 | Link from `/solve` to the board: "Show me on the board" turns a text solution into a board script | Reuses `/api/lesson` |

## Phase 8: Languages and Gnani strengths (M)

| # | Task | Done when |
|---|---|---|
| 8.1 | `lang` setting: English, Hindi, Kannada, Tamil, or whatever Gnani TTS supports | Narration and notes come out in that language |
| 8.2 | Handwriting font fallback for Indic scripts (for example *Kalam* for Devanagari) | Notes render correctly |
| 8.3 | Code-mixed narration (Hinglish) for the gossip persona | Review of 10 outputs |
| 8.4 | Optional: voice input (ask the question by speaking) through Gnani speech-to-text | Stretch |

## Phase 9: Production hardening (M)

| # | Task | Done when |
|---|---|---|
| 9.1 | Rate limits per IP or device on `/api/solve`, `/api/lesson`, `/api/speak` and `/api/watch` (the existing `shortcut:` comment in the solve route) | 429 responses with a friendly message |
| 9.2 | Timeouts and abort: cancel upstream calls when the client disconnects or leaves the page | No orphaned streams |
| 9.3 | Structured logs: route, latency, model, tokens, and action type. **No canvas images or student text in logs** | |
| 9.4 | Cost dashboard: estimated tokens and TTS characters per lesson and per watch minute | Numbers in `FINDINGS.md` |
| 9.5 | Content safety: refuse non-study topics politely; no personal data in prompts | Prompt rule plus 10 red-team prompts |
| 9.6 | Deployment: Vercel or similar for the Next.js app, a GPU host for Evon (vLLM), secrets in the platform's environment variables | A staging URL works end to end |
| 9.7 | Measure performance in prod: time to first stroke, TTS latency, watch round-trip (target under 4 s) | Measured on staging |
| 9.8 | Accessibility pass: keyboard-only playback, captions, contrast in both themes, a screen-reader summary of each step (`say` as live-region text) | Checked |

## Phase 10: Hackathon demo (S)

| # | Task | Done when |
|---|---|---|
| 10.1 | 90-second demo script: a gossip lesson on the cell, "now you try", the student makes a planted mistake, the tutor circles it and speaks | Rehearsed |
| 10.2 | Offline safety net: fixtures plus pre-recorded audio for the demo topic, so it still works if the network fails | `?demo=cell` works with the network off |
| 10.3 | README: Gnani models used (Evon v3.3, TTS model name), architecture diagram, how to run | Updated |
| 10.4 | Synthetic data statement: all fixtures and evaluation boards are made up | In README |

---

## Order and dependencies

```
0 ─► 1 ─► 2 ─► 3 ─► 4 ─┐
          │            ├─► 7 ─► 8 ─► 9 ─► 10
          └─► 5 ─► 6 ──┘
```

- Phase 1 (format and renderer) unblocks everything else, so do it first.
- Phases 2–4 (Teach) and 5–6 (Watch) can run in parallel once Phase 1 exists.
- **Minimum demo:** Phases 0–3 plus 4.1 for the gossip persona, plus 10.2. That gives a talking, drawing lesson, which is the part people found viral.

## New files at a glance

| Path | Purpose |
|---|---|
| `lib/board.js` (+ test) | Board script schema, validation, clamping |
| `lib/evon.js` | Shared Evon call (taken out of `/api/solve`) |
| `lib/prompts.js` | System prompts and personas |
| `lib/fixtures/` | Synthetic lessons and watch-mode boards |
| `app/board/page.js` | Board page |
| `app/board/Board.js` | SVG renderer and animation |
| `app/board/Player.js` | Step playback and audio sync |
| `app/board/Ink.js` | Student pen layer |
| `app/board/useWatcher.js` | Watch-mode trigger policy |
| `app/api/lesson/route.js` | Topic or notes → board script |
| `app/api/speak/route.js` | Text → speech (Gnani TTS) |
| `app/api/watch/route.js` | Canvas → silent, hint or correction |

## Risks and open questions

| Risk | Mitigation |
|---|---|
| Gnani TTS sounds flat, so the gossip persona falls flat | Test in Phase 0.1. Write the energy into the words (punctuation, short lines). Keep a browser-voice fallback |
| Evon's diagram layouts overlap or look messy | Layout zones in the prompt, clamping, an auto-nudge pass (2.5), and few-shot examples |
| Evon returns invalid JSON | Low temperature, the repair loop (2.3), and a fixture fallback |
| Watch mode is too chatty, or misses errors | Conservative triggers, "silent" as the default action, the evaluation set (6.8), and the chattiness setting |
| Gemini misreads messy handwriting | Ask for "unclear" markers; the tutor asks "is that a 7 or a 1?" instead of guessing |
| Persona tone distorts facts | Tone-only rule plus the fact-check evaluation (4.2) |
| Cost of an image call every few seconds | Idle-based triggers, image-hash skip, size caps, daily limits |
| Latency between strokes and voice | Streamed steps, prefetching the next step's audio, caching |

**Open questions:**
1. Gnani TTS: which model name, which voices, and does it support style or emotion control?
2. Is the main device a tablet with a stylus, or a laptop with a mouse? This decides how much to invest in 5.1–5.2.
3. Which subjects come first: biology diagrams (Teach) or maths working (Watch)?
4. Where will Evon be hosted for production, and what latency should we budget?
