# PDF section: ask about the page, get an animated, narrated lesson

Status: builder-checked, awaiting approval. Date: 2026-10-20.

## Intent and why

A student uploads a PDF (a worksheet, a textbook chapter, past papers), reads it in StepWise, and asks the AI about what is on screen. The AI then teaches it on the whiteboard: it draws the explanation step by step and narrates it aloud, **in whatever voice or style the student asks for** ("like I'm 5", "like a gossip", "like a cricket commentator").

This is for the Gnani hackathon demo. The moment judges must feel, in the user's words:

> "how well it narrates and how much customisable the narration can get as per the student's preference. Along with the animation. The animations must look like they are 10,000 dollars."

So the narration, how the style changes it, and the animation quality are the product. Everything else (upload, storage, layout) only has to be solid enough not to get in the way.

## Reference: the user's two reels (the animation bar)

The animation must look and feel like these two reels, **not** like a style made up by the builder.

- **Reel 2, the main reference:** `https://www.instagram.com/reel/DehgKHPsdaY/` (studywith.karen). An AI whiteboard tutor in a desktop browser.
  - The board has a title, "The cell's group chat", and a subtitle, "Same cell. A lot of drama."
  - The AI draws a diagram step by step in a hand-drawn style while a gossipy voice narrates:
    - a cell outline;
    - a nucleus wearing a crown, labelled "DNA", with the note *"thinks she runs the place"*, then "DNA + instructions";
    - mitochondria, *"doing the actual work"*, with "ATP = usable energy" and a ⚡ATP doodle;
    - ribosomes as dots, with an arrow pointing to them.
  - **Each label appears exactly as the voice reaches it.** The persona voice is what makes the reel work: commenters ask "app?" and "her AI speaks but mine doesn't".
- **Reel 1, the secondary reference:** `https://www.instagram.com/reel/Deeqn-cIHgN/` (rosacodes, DeepMind hackathon). A stylus-on-iPad tutor that watches quietly and helps when asked, with burned-in subtitles. What we borrow from it: the calm, uncluttered board, the help arriving the moment the student asks, and readable captions under the drawing.

The reels were watched frame by frame earlier. They were not downloaded, and their audio was not transcribed, so the exact narration lines are inferred from the on-screen notes.

### What "looks like the reels" means concretely

1. **Hand-drawn look.** Strokes draw themselves on with slight wobble (seeded, so it's the same on every replay). Labels are written in the handwriting font (Caveat, already used on `/board`). No clip-art, stock icons, or 3D.
2. **Persona doodles.** Small character touches that carry the joke, like the crown on the nucleus or the bolt on the mitochondria. They are drawn in the same hand-drawn stroke style, not as emoji.
3. **Voice-synced reveals.** Each shape and label starts drawing when its words are spoken, not on a fixed timer. This sync is the single most important quality signal.
4. **Title card with a styled subtitle.** Every lesson opens with a title and a one-line hook written in the chosen style (like "Same cell. A lot of drama.").
5. **Margin notes.** Short, witty notes beside a label, in a second ink colour (like "thinks she runs the place").
6. **Captions.** The current spoken line sits under the board, as in reel 1.
7. **Polish that makes it feel expensive** (builder's call within the reel style): ease-in-out on every stroke, a soft ink-bleed at stroke ends, gentle camera pan/zoom to the area being drawn, and a highlighter sweep for emphasis. No bouncing, spinning, or confetti.

## Goals

- Upload a PDF and read it page by page, with the board beside it.
- Ask about the page on screen by question number ("explain Q3"), by speaking, or by typing or quoting the line.
- Get a lesson drawn and narrated on the board, in any subject.
- Narration style is free text, chosen at ask time, with preset chips for quick picks. The style changes the tone, jokes and metaphors, never the facts.
- A replay costs nothing: the lesson script and its audio are saved and replayed without new Groq or Gnani calls.
- Past lessons for a PDF can be reopened from a "Saved ▾" list.

## Non-goals

- Server-side storage, accounts, or syncing between devices (prototype; browser-only storage).
- Editing or annotating the PDF.
- OCR quality beyond what Gemini gives from a page image.
- Scanned-PDF search or text selection.
- Multi-page answers. One question maps to one page.
- The "watch me while I write" mode from reel 1.

## Anti-goals (fails even if it works)

- Animations that look generic: flat clip-art, stock icons, PowerPoint-style fly-ins, or anything that doesn't match the reels.
- Narration where the style is just a prefix ("As a gossip, …") instead of being woven through.
- Shapes appearing out of sync with the voice.
- Style changing the facts or the answer.
- A replay that calls Groq or Gnani again.

## Constraints

- **Existing stack:** Next 16, React 19, strict TypeScript, `node --test` on `.ts`.
  - Animation libraries already installed: framer-motion and gsap.
  - New dependencies need the user's OK. A PDF renderer (likely `pdfjs-dist`) will be needed; ask before installing.
- **Models** are as today:
  - Groq writes lesson scripts (`lib/lesson.ts`, `lib/prompts.ts`).
  - Gemini reads images (`/api/solve` photo path).
  - Gnani Vachana handles speech in (`/api/listen`) and speech out (`/api/speak`).
- **Reuse the board:** `lib/board.ts` (BoardScript: steps of `{say, draw[]}` with line, arrow, highlight, circle, ellipse, rect, path, text, label and icon shapes) and `app/board/Board.tsx` and `Player.tsx`.
  - Extend the shape set if the reel look needs it, for example a doodle or margin-note shape, a title card, or per-word timing.
  - Don't fork the board.
- **API keys** stay server-side. Live API tests need the user's OK each time.
- **Phones:** the PDF goes on top and the board below.

## Decided by the user

- **Style:** fully dynamic, free text at runtime.
- **Subjects:** any.
- **How the student picks what to ask about:** by number or index, by voice, or by typing or quoting the line.
- **Sessions:** stored per PDF, in the browser (prototype).
- **Audio:** stored with each lesson, so a replay costs no Gnani call.
- **Layout:** the PDF and the board sit side by side, horizontally.
- **Animation:** follow the two reels above.
- **What "explain Q3" means:** teach the concept behind the question with a reel-style diagram, not a worked solution. No equation rendering on the board and no final answer. Gemini only needs the question text, not a description of the page's figures.

## My calls (please check)

- **Storage:** IndexedDB, keyed by a hash of the PDF. The PDF file itself is stored too, so reopening works without re-uploading. Each lesson holds the question, style, page, script and audio blobs.
- **Layout C, "shifts when you ask":**
  - While reading, the PDF is wide and the board is slim.
  - On ask, it animates to the board wide and the PDF slim.
  - A draggable divider overrides this.
- **Style picker:** preset chips (Normal, Like I'm 5, Gossip, Sports commentator, Exam-crisp) plus a free-text box. The last style used is remembered per PDF.
- **Finding the question:**
  - The current page is rendered to an image, and Gemini receives that image plus the student's request.
  - It returns the exact question text and a rough bounding box, which is highlighted on the PDF.
  - If it can't find it, the student is asked to quote the line.
- **Voice sync:**
  - Each step's `say` is spoken as its own Gnani clip, so the step's drawing starts with its clip.
  - Each shape carries an `at` field: the word or phrase in `say` it belongs to. The shape starts drawing at that phrase's character position in `say`, scaled to the clip's length. Gnani returns no timing data, so this approximation costs no extra calls and lands each label close to its words. Shapes without `at` are spread evenly, as a fallback.
  - shortcut: character position, not real word timing; switch to per-phrase clips if the demo shows visible drift.
- **Voice and language:** one Gnani voice, as today. The style is carried by word choice. The existing language choice (English, Hindi, Kannada, Tamil from `lib/validate.ts`) is kept on the ask bar.
- **Build order:** the demo path first (upload, ask, styled narrated lesson with the reel look), then storage, the Saved list, the divider and phone layout.
- **Audio generation:** clips are fetched in parallel right after the script arrives. Playback starts once step 1's clip is ready.
- **Saved lessons:** shown in a "Saved ▾" list on the PDF pane, newest first.

## Left to the builder

- Exact component split, file names and route names (a `/pdf` page seems natural).
- How to fold the reel-style touches (wobble, doodles, margin notes, title card, camera pan) into the board shape set and renderer.
- Prompt wording that makes styles feel woven-in and produces doodle and margin-note shapes.
- Loading and error states, and the storage-full behaviour.

## Known risks

- Gnani's TTS may sound flat for persona styles. Style then has to carry through word choice, and the demo is weaker.
- Gemini may miss "Q3" on dense pages; the quote-the-line fallback covers it.
- Clearing site data wipes all saved PDFs and lessons, and audio takes a few MB per lesson.
