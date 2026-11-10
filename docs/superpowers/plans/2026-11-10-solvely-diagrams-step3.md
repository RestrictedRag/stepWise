# Step 3: diagrams that show the real subject

**For:** Antigravity (executor). **Written by:** Claude (planner). **Date:** 2026-11-10.
**Branch:** `feature/animation-engine`. Do not commit, push or switch branch unless the user asks.

## 1. The problem

The user watched a lesson on blood flow in the heart. The board drew a circle.
They expected a picture of a heart with its chambers, vessels and arrows for the blood.

Cause: the choreographer can only pick from fixed primitives (rect, circle, ellipse, line, arrow, label, triangle, number line, plot). A heart has no primitive, so it becomes a circle. No prompt change to the choreographer can fix this.

How Solvely does it (`solvely-findings.md` lines 183-191, 246, 707, 735): the model writes free drawing code for each diagram from a written request ("Draw a clear physics diagram..."). The diagram is static and appears whole.

## 2. The fix in one paragraph

The pedagogy call already plans each step. It will now also write a **drawing brief** for the steps that need a picture. For each brief, one extra LLM call writes a complete **SVG picture**. The server checks the SVG, attaches it to the step, and the board shows it as an image where the shapes are shown today. If anything fails, the board shows the shapes exactly as it does now.

Planner's calls (the user did not decide these; say so in your report if you change one):

| Call | Why |
|---|---|
| SVG, not p5.js | No new dependency and no model-written script running in the browser. |
| Shown with `<img src="data:image/svg+xml,...">` | The browser runs no script and loads no outside file for an SVG inside `<img>`. This is the security boundary. It also sizes itself from the `viewBox`. |
| At most 3 diagrams per lesson | Each one costs an LLM call. |
| Existing shape commands stay in the manifest | They are the fallback. |

## 3. Not in this step

- No p5.js, no animated diagrams, no stroke-by-stroke drawing of the SVG.
- No "a later step updates the same diagram in place" (Solvely does this; add it later if the user asks). Each diagram is independent.
- No change to pacing, audio, note writing, the pen, the choreographer prompt or the layout engine.
- No new npm dependency.

## 4. Rules for the executor

1. Read `graphify-out/GRAPH_REPORT.md` first (project rule). Use `graphify query "<question>"` for "what calls what".
2. Do the tasks in order. Run `npx tsc --noEmit` after every task that edits TypeScript.
3. Every new field is **optional**. Old lessons, fixtures and test mocks have no `diagram` and must behave exactly as before.
4. If a name or line in this plan does not match the code, trust the code, make the smallest matching change, and note it in the report.
5. Start the dev server the way the project already does. Do not add scripts.
6. Report with the format in section 7. Say "not checked" for anything you did not actually run. Do not infer results.

---

## Task 0: read before editing (no edits)

Read these and write down the answers; they go in the report.

| File | What to find |
|---|---|
| `app/api/lesson/route.ts` | How `ask` is built. **Does it force JSON output** (for example `json: true` or a `response_format`)? Which model and provider does it call? What is the default `max_tokens`? How is each yielded step sent to the client (SSE, NDJSON)? |
| `lib/llm.ts` | `llmText(messages, { temperature?, max_tokens?, json? })` around line 73. Confirm the option names. |
| `app/home/whiteboard-tutor/LiveBoard.tsx` | (a) Where a `CompiledStepManifest` becomes a block (search for `BlockInput`, `layoutBlocks`, `block.commands`). (b) `BlockItem`, the JSX that starts `{drawCommands.length > 0 && (` near lines 520-560. |
| `lib/liveboard/layout.ts` | `BlockInput`, `PlacedBlock`, `layoutBlocks`. How is a block's height worked out? Does it add height when the block has draw commands? |
| `app/home/whiteboard-tutor/shapes.tsx` and `app/globals.css` | The hex values the board uses for `ink`, `purple`, `orange`, `green`, `red`, `blue`, and the board background colour. |
| `lib/textDuration.test.ts` | Which test runner and import style the tests use. Copy that style in task 3. |
| Search: `streamLessonManifest` | Every caller and every test or eval that mocks `ask` (`eval/syncEval.ts` is one). |
| Search: `localStorage`, `sessionStorage`, any lesson cache | Whether step manifests are stored anywhere with a size limit. |

Stop and report if `app/api/lesson/route.ts` does not call `streamLessonManifest` at all.

---

## Task 1: types

### 1a. `lib/manifest.ts`

In `CompiledStepManifest`, add one optional field after `commands`:

```ts
  commands: CompiledCommand[];
  /** Model-drawn picture of the step's subject. When present the board shows it instead of the shape commands. */
  diagram?: { svg: string; alt: string };
```

Do not touch `validateLessonManifest` (it only checks title and steps) or `boardScriptToManifest`.

### 1b. `lib/pipeline.ts`

In `PedagogyStep`, add after `note?: string;`:

```ts
  /** Drawing brief for a picture of this step's subject. null or absent: no picture. */
  diagram?: string | null;
```

---

## Task 2: prompts (`lib/prompts.ts`)

### 2a. Pedagogy prompt: ask for the brief

In `pedagogyPrompt(req)` (around lines 45-92):

1. In the JSON shape shown to the model, add a `"diagram"` key to each step, next to `"note"`:

```
"diagram": "<drawing brief, or null>",
```

2. Add this rule block next to the existing note rules. Keep the wording:

```
DIAGRAM RULES
- "diagram" is a brief for an illustrator who will draw a picture of the real thing this step explains.
- Use it when the subject has a shape, a structure, a layout or a flow that a student should SEE: an organ, a cell, a circuit, a force diagram, a geometric figure, a graph, a cycle, a machine, a map of a process.
- Name the subject and the view, list every part to show, list the labels, and say what the arrows show.
  Example: "Front-view cross-section of the human heart. Show four chambers: right atrium, right ventricle, left atrium, left ventricle. Show the vena cava, pulmonary artery, pulmonary veins and aorta. Blue arrows: oxygen-poor blood from the body into the right atrium, down to the right ventricle, out through the pulmonary artery to the lungs. Red arrows: oxygen-rich blood from the lungs into the left atrium, down to the left ventricle, out through the aorta. Label every chamber and vessel."
- Never ask for a generic shape (a circle, a box) to stand in for the subject.
- Use null when a picture adds nothing, for example a step that is only algebra or only a definition.
- At most 3 steps in the lesson have a diagram. Put it on the step where the subject is first explained.
- Write the brief in English, 30 to 90 words.
```

Do not change any other rule in this prompt.

### 2b. New `diagramPrompt`

Add this export at the end of `lib/prompts.ts`. Replace the six `#......` values and the background note with the real board values you found in task 0.

```ts
export function diagramPrompt(lessonTitle: string, say: string, brief: string, lang: string): string {
  return `Draw one teaching diagram as SVG for a whiteboard lesson.

Lesson: ${lessonTitle}
The tutor says while this is on the board: "${say}"
What to draw: ${brief}

Draw the real subject the way a good textbook figure does, so a student recognises it at a glance.

OUTPUT
- Reply with exactly one <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 700"> ... </svg> and nothing else. No markdown fence, no explanation.
- Under 12000 characters.

ALLOWED
- Elements: svg, g, path, rect, circle, ellipse, line, polyline, polygon, text, tspan, defs, marker, title.
- Nothing else. No style, script, image, use, foreignObject, animate, filter, clipPath or mask elements. No event attributes. No links, no external fonts, no url() except url(#id) for a marker defined in this SVG.

DRAWING
- Build the outline of the subject from <path> curves (C, Q, A commands). Draw its real parts in their real positions and rough proportions.
- A plain circle or box must never stand in for the subject. Use circles and boxes only for things that really are round or square.
- Strokes: stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round".
- Fills: fill="none", or a light tint of a palette colour with fill-opacity at most 0.18.
- Colours, only these: ink #......, purple #......, orange #......, green #......, red #......, blue #....... The board background is light; do not draw a background rectangle.
- Keep everything at least 40 units inside the 1000 by 700 area.

LABELS
- 4 to 10 short labels, written in the language "${lang}".
- <text font-family="sans-serif" font-size="24" fill="ink colour">. Put each label beside its part with a thin leader line (stroke-width="1.5") when it cannot sit on the part.
- Labels must not overlap each other or the drawing. Write & as &amp; and < as &lt;.
- No sentences, no heading, no paragraph text.

FLOW AND DIRECTION
- Show movement with arrows: define one <marker id="arrow"> per arrow colour in <defs> and use marker-end="url(#id)".
- Use colour to separate kinds of flow (for example blue for oxygen-poor blood, red for oxygen-rich blood) and add a small two-line legend in a corner.
`;
}
```

If task 0 found that `ask` **forces JSON output**, change the two OUTPUT lines to: `Reply with one JSON object: {"svg": "<the whole svg as one string>"} and nothing else.` Task 4 already handles both reply forms.

---

## Task 3: the SVG check (`lib/liveboard/diagramSvg.ts`, new file)

Pure function, no imports. It **rejects** bad input; it does not try to repair it.

```ts
// Checks a model-written SVG before it is sent to the board.
// The board shows it through <img>, where the browser runs no script and loads no outside file.
// This check is the second layer and also catches replies that are not a usable drawing.

const MAX_CHARS = 20000;

const ALLOWED_TAGS = new Set([
  "svg", "g", "path", "rect", "circle", "ellipse", "line", "polyline", "polygon",
  "text", "tspan", "defs", "marker", "title", "desc",
]);

export function sanitizeDiagramSvg(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const match = raw.match(/<svg[\s\S]*<\/svg>/i);
  if (!match) return null;

  let svg = match[0].replace(/<!--[\s\S]*?-->/g, "");
  if (svg.length > MAX_CHARS) return null;

  // Doctype, CDATA, processing instructions, entity declarations
  if (/<[!?]/.test(svg)) return null;

  // Every tag must be on the allow-list
  for (const m of svg.matchAll(/<\/?\s*([A-Za-z][\w:.-]*)/g)) {
    if (!ALLOWED_TAGS.has(m[1].toLowerCase())) return null;
  }

  // Event handlers
  if (/\son[a-z]+\s*=/i.test(svg)) return null;

  // Links: only same-document fragments
  for (const m of svg.matchAll(/(?:xlink:)?href\s*=\s*(["'])([\s\S]*?)\1/gi)) {
    if (!m[2].trim().startsWith("#")) return null;
  }

  // url(...): only same-document fragments
  for (const m of svg.matchAll(/url\(\s*(["']?)([^)]*?)\1\s*\)/gi)) {
    if (!m[2].trim().startsWith("#")) return null;
  }

  if (/javascript:|@import|expression\(/i.test(svg)) return null;

  const openTag = svg.match(/<svg[^>]*>/i)![0];
  if (!/\sviewBox\s*=/i.test(openTag)) return null;

  // <img> only renders an SVG that declares the namespace
  if (!/\sxmlns\s*=/i.test(openTag)) {
    svg = svg.replace(/<svg/i, '<svg xmlns="http://www.w3.org/2000/svg"');
  }

  // A drawing needs some drawing
  const marks = svg.match(/<(path|rect|circle|ellipse|line|polyline|polygon)\b/gi);
  if (!marks || marks.length < 3) return null;

  return svg;
}
```

### Test: `lib/liveboard/diagramSvg.test.ts` (new file)

Use the same runner and import style as `lib/textDuration.test.ts`. Cases (each one assertion):

| Input | Expected |
|---|---|
| `GOOD` (below) | returns a string that starts with `<svg` |
| `"Here you go:\n```svg\n" + GOOD + "\n```"` | returns the same as `GOOD` |
| `GOOD` with `xmlns="http://www.w3.org/2000/svg" ` removed | returns a string that contains `xmlns="http://www.w3.org/2000/svg"` |
| `GOOD` with `<script>alert(1)</script>` inserted before `</svg>` | `null` |
| `GOOD` with ` onload="x()"` added to the `<svg` tag | `null` |
| `GOOD` with `<image href="https://example.com/a.png"/>` inserted | `null` |
| `GOOD` with `<path d="M0 0" style="fill:url(https://example.com/x)"/>` inserted | `null` |
| `GOOD` with `<foreignObject></foreignObject>` inserted | `null` |
| `GOOD` with ` viewBox="0 0 1000 700"` removed | `null` |
| `"I cannot draw that."` | `null` |
| `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle r="1"/></svg>` | `null` (fewer than 3 marks) |
| `"<svg>" + "x".repeat(20001) + "</svg>"` | `null` |
| `42` | `null` |

```ts
const GOOD = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 700">
<defs><marker id="arrow" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto"><path d="M0 0 L10 5 L0 10 Z" fill="#c00"/></marker></defs>
<path d="M500 620 C200 420 220 160 400 160 C460 160 500 200 500 240 C500 200 540 160 600 160 C780 160 800 420 500 620 Z" fill="none" stroke="#222" stroke-width="2.5"/>
<line x1="500" y1="240" x2="500" y2="600" stroke="#222" stroke-width="2.5"/>
<path d="M420 300 L420 460" stroke="#c00" stroke-width="2.5" marker-end="url(#arrow)"/>
<text x="330" y="280" font-family="sans-serif" font-size="24" fill="#222">Right atrium</text>
</svg>`;
```

Run the test file and confirm every case passes.

---

## Task 4: pipeline (`lib/pipeline.ts`)

### 4a. Imports

```ts
import { pedagogyPrompt, choreographerPrompt, allStepsChoreographerPrompt, diagramPrompt } from "./prompts.ts";
import { sanitizeDiagramSvg } from "./liveboard/diagramSvg.ts";
```

### 4b. Helper, above `streamLessonManifest`

```ts
const MAX_DIAGRAMS = 3;
const DIAGRAM_TIMEOUT_MS = 45000;
const DIAGRAM_MAX_TOKENS = 6000;

type StepDiagram = { svg: string; alt: string };

// The reply is raw SVG, or {"svg": "..."} when the caller forces JSON.
function pickSvg(reply: string): string {
  try {
    const j = extractJson(reply) as any;
    if (j && typeof j.svg === "string") return j.svg;
  } catch {}
  return reply;
}

function drawDiagram(
  ask: (msgs: Msg[], maxTokens?: number) => Promise<string>,
  title: string,
  say: string,
  brief: string,
  lang: string
): Promise<StepDiagram | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), DIAGRAM_TIMEOUT_MS);
  });
  const job = ask(
    [
      { role: "system", content: "You are an expert scientific illustrator who writes clean, hand-authored SVG." },
      { role: "user", content: diagramPrompt(title, say, brief, lang) },
    ],
    DIAGRAM_MAX_TOKENS
  )
    .then((reply) => {
      const svg = sanitizeDiagramSvg(pickSvg(reply));
      if (!svg) console.warn("[Pipeline] Diagram reply rejected by sanitizeDiagramSvg");
      return svg ? { svg, alt: brief.slice(0, 300) } : null;
    })
    .catch((err) => {
      console.warn("[Pipeline] Diagram generation failed:", err);
      return null;
    });
  return Promise.race([job, timeout]).finally(() => clearTimeout(timer));
}
```

If `extractJson` throws on plain SVG text, the `try/catch` covers it. If it returns something odd instead of throwing, the `typeof j.svg === "string"` guard covers it.

### 4c. Start the drawings early

Directly after the pedagogy JSON is parsed (after the `try { pedData = ... } catch { ... }` block, before `const tts = getTtsProvider(lang);`), add:

```ts
  // Start diagram drawing now so it runs while TTS and choreography work.
  // shortcut: runs up to MAX_DIAGRAMS LLM calls at once; make this sequential if the LLM provider returns 429.
  let diagramCount = 0;
  const diagramJobs: Array<Promise<StepDiagram | null>> = (pedData.steps || []).map((st) => {
    const brief = typeof st.diagram === "string" ? st.diagram.trim() : "";
    if (!brief || diagramCount >= MAX_DIAGRAMS) return Promise.resolve(null);
    diagramCount++;
    return drawDiagram(ask, pedData.title, st.say, brief, lang);
  });
```

`drawDiagram` never rejects, so there is no unhandled rejection while the jobs wait.

### 4d. Attach to the step

In the per-step loop, change the `stepManifest` literal:

```ts
    const diagram = await diagramJobs[i];

    const stepManifest: CompiledStepManifest = {
      stepIndex: i,
      speech: { /* unchanged */ },
      commands: compiledCommands,
      ...(diagram ? { diagram } : {}),
    };
```

Change nothing else in the loop. The shape commands are still compiled.

### 4e. Callers and mocks

Check each caller and mock found in task 0:

- A mock `ask` that returns canned replies **in order** is safe as long as its pedagogy reply has no `"diagram"` key: no extra call is made.
- If a mock picks its reply by reading the prompt text, confirm the diagram prompt ("Draw one teaching diagram as SVG") does not match another branch.
- If `app/api/lesson/route.ts` clamps `maxTokens` below 6000, note the clamp in the report. Do not raise a provider limit without saying so.

Run the whole test suite. The count must be the old count plus the new cases from task 3, with no failures.

---

## Task 5: board (`LiveBoard.tsx` and `lib/liveboard/layout.ts`)

### 5a. Carry the field to the block

Where a step manifest becomes a block input (found in task 0), pass the diagram through:

```ts
diagram: step.diagram,
```

Add `diagram?: { svg: string; alt: string }` to `BlockInput` (and to `PlacedBlock` if it does not extend or spread `BlockInput`).

### 5b. Block height

In `layoutBlocks`, find how height is added for a block that has draw commands. A block with a `diagram` needs the same space as a block with shapes.

- If the code reads something like `hasDrawing = commands.some(c => c.action === "DRAW")`, change it to `hasDrawing = !!input.diagram || commands.some(...)`.
- If height is measured from the DOM after render, change nothing.
- The picture is 1000 by 700, shown at the block width `w`, capped at 480 px high: its height is `Math.min(480, w * 0.7)`. Use that only if the layout needs a number.

### 5c. Render in `BlockItem`

Add near the other hooks in `BlockItem`:

```tsx
const [diagramFailed, setDiagramFailed] = useState(false);
const diagram = diagramFailed ? undefined : block.diagram;
const diagramSrc = useMemo(
  () => (diagram ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(diagram.svg)}` : ""),
  [diagram]
);
```

Replace the start of the existing drawing JSX so the picture wins and the shapes are the fallback:

```tsx
{diagram ? (
  <div style={{ marginTop: 16 }}>
    {/* <img> on purpose: the browser runs no script and loads no outside file for an SVG shown this way. */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img
      src={diagramSrc}
      alt={diagram.alt}
      onError={() => setDiagramFailed(true)}
      style={{
        display: "block",
        width: "100%",
        height: "auto",
        maxHeight: 480,
        objectFit: "contain",
        animation: "board-fade-in 400ms ease-out both",
      }}
    />
  </div>
) : drawCommands.length > 0 && (
  /* the existing <div> ... <svg> ... <AnimatedVector .../> ... </svg> ... </div>, unchanged */
)}
```

Rules:

- **Never** put the SVG string into the page with `dangerouslySetInnerHTML`, an inline `<svg>`, an `<iframe>` or an `<object>`. Only `<img>`.
- `onError` covers SVG that is not well-formed XML: the block falls back to the shapes.
- Leave `AnimatedVector`, `getShapesViewBox`, the pen and the highlighter untouched.
- If the pen or highlighter reads positions from draw commands of a block that now shows a picture, and that makes it point at empty space, skip those targets for blocks with a `diagram` and say so in the report.

---

## Task 6: check it for real

1. `npx tsc --noEmit`: zero errors.
2. Full test suite: zero failures.
3. Start the dev server. Generate these three lessons in the whiteboard tutor and take a screenshot of each diagram step:

| Prompt | Pass when |
|---|---|
| "Explain how blood flows through the heart" | A recognisable heart: four labelled chambers, vessels, blue and red arrows. Not a circle. |
| "Explain photosynthesis in a leaf" | A leaf or chloroplast with labelled inputs and outputs and arrows. |
| "Solve 2x + 3 = 11" | No diagram (brief was null) or an unchanged lesson. Notes and pacing as before. |

4. For the heart lesson also record:
   - Server log: any `[Pipeline] Diagram` warnings.
   - Seconds from submit to the first step appearing, compared with a run before your change if you have one.
   - Browser console: no errors. Network tab: the picture causes **no** outside request.
   - Labels readable, not overlapping, nothing cut off at the block edge.
5. Force the fallback once: temporarily make `sanitizeDiagramSvg` return `null`, generate a lesson, confirm the old shapes show and nothing crashes, then **revert** that edit.
6. Run `graphify update`.

If the heart looks wrong (a blob, overlapping labels), do **one** round of prompt tuning in `diagramPrompt` at most. If it is still wrong, stop and report the model name from task 0. Drawing quality depends mostly on the model, and choosing a different model is the user's decision.

---

## 7. Report format

```
STEP 3 REPORT

Task 0 findings
- ask(): provider / model / forces JSON? / default max_tokens / maxTokens clamp
- Block built in: <file:line>
- Block height: <how, and whether you changed it>
- Board colours used in diagramPrompt: <six hex values>
- Lesson storage or cache with a size limit: <yes/no, where>

Files changed
- <path>: <one line each>

Checks (write RAN or NOT CHECKED for each, with the real output)
- tsc:
- tests: <passed>/<total>
- Heart lesson: <screenshot path> / diagram steps: <n> / warnings: <text or none>
- Photosynthesis lesson: <screenshot path>
- Algebra lesson: <result>
- Time to first step: before <s> / after <s>
- No outside network request from the picture:
- Forced fallback, then reverted:
- graphify update:

Differences from the plan
- <each one, with the reason>

Open problems
- <each one>
```

## 8. Known risks (planner's notes)

- One extra LLM call per diagram (up to 3 per lesson) adds cost. A step that carries a diagram can arrive later, by up to 45 s in the worst case, because the step waits for its picture.
- Picture quality depends on the model behind `ask`. A weak model will draw a poor heart however good the prompt is.
- The planner did not read `app/api/lesson/route.ts`, the block-building code in `LiveBoard.tsx`, `lib/liveboard/layout.ts` or `lib/validator.ts`. Task 0 exists to close that gap.
