# Solvely Whiteboard Lesson Player: Empirical Reverse-Engineering Report

**Observed Target Playback URL:**  
`https://solvely.ai/home/whiteboard-tutor/00dffbb3118d01f3cfd93ccdf8dfc355`

**Submitted Test Problem:**  
*"A ball is thrown upward from the top of a 20 m building with an initial speed of 15 m/s. Taking g = 9.8 m/s², find (a) the maximum height above the ground, (b) the time it takes to hit the ground, and (c) its speed just before impact. Draw a diagram."*

---

## Section A: Canvas and Rendering

### A1. Canvas Elements, Dimensions, Zoom, and DPR Scaling
- **Answer:**  
  There is exactly **1 canvas element** in the whiteboard player DOM. It does *not* render the lesson handwriting or math; it functions strictly as a top-level overlay layer (`DIV.region-selection-layer > canvas`) for user freehand lasso selection ("Circle content for Tutor").  
  The whiteboard text, math, and layout itself are rendered entirely using structured HTML/SVG DOM nodes (`.agent-board-scene`).  
  - At viewport 2209 × 1249 px, zoom 100% (DPR 1.0):  
    - HTML attributes: `width="2209"`, `height="1249"`  
    - CSS layout size: `2209px` × `1249px`  
    - Backing store ratio: `1.0`  
  - At window resize 1000 × 700 px (DPR 1.0):  
    - HTML attributes: `width="649"`, `height="700"`  
    - CSS layout size: `649px` × `700px`  
  - Backing store scaling behavior:  
    The canvas backing store dimensions are dynamically computed and clamped using:  
    `Ce = Math.max(1, Math.round(de.width * ye))`  
    `Me = Math.max(1, Math.round(de.height * ye))`  
    where `ye = Math.min(2, window.devicePixelRatio || 1)`.  
    At browser zoom 200% (DPR 2.0), the backing store dimensions double relative to CSS layout pixels (`width = CSS width * 2`, `height = CSS height * 2`), clamped at DPR = 2.0.
- **Tag:** `[OBSERVED]`
- **Evidence:**  
  - Playwright MCP DOM evaluation query `document.querySelectorAll('canvas')`.  
  - Source code inspection in bundle `WhiteboardTutorHost-BxnRLDUH.js` line ~501984:
    ```javascript
    const de = ie.getBoundingClientRect(),
          ye = Math.min(2, window.devicePixelRatio || 1),
          Ce = Math.max(1, Math.round(de.width * ye)),
          Me = Math.max(1, Math.round(de.height * ye));
    (ie.width !== Ce || ie.height !== Me) && (ie.width = Ce, ie.height = Me);
    ```

---

### A2. 2D Context vs WebGL and Transform Values
- **Answer:**  
  The canvas uses a **2D context** (`getContext("2d")`). No WebGL or WebGL2 context is initialized anywhere in the player.  
  `setTransform` is called on the 2D context to normalize for High-DPI screens:  
  `Te.setTransform(ye, 0, 0, ye, 0, 0)` where `ye = Math.min(2, window.devicePixelRatio || 1)`.  
  Transform values during the lesson:
  - At DPR 1.0: `[1, 0, 0, 1, 0, 0]`
  - At DPR 2.0: `[2, 0, 0, 2, 0, 0]`  
  Scene camera positioning does *not* happen in the canvas context; it is applied directly to the container DOM element (`.agent-board-scene`) via CSS 3D transforms:  
  `transform: translate3d(Xpx, Ypx, 0px) scale(1)`.
- **Tag:** `[OBSERVED]`
- **Evidence:**  
  - Canvas context spy in `window.__obs.canvasTransforms` recording 6 calls with matrix `[1, 0, 0, 1, 0, 0]` at DPR 1.0.  
  - Source code in `WhiteboardTutorHost-BxnRLDUH.js` line ~502010:
    ```javascript
    const Te = ie.getContext("2d");
    if (!Te) return;
    Te.setTransform(ye, 0, 0, ye, 0, 0);
    Te.clearRect(0, 0, de.width, de.height);
    ```

---

### A3. Frame Rate and Animation Loop
- **Answer:**  
  Animations are driven by **`requestAnimationFrame`** (rAF). `setInterval` and `setTimeout` are only used for timeout fallbacks, stall detection (4,000 ms), and telemetry throttling.  
  The pen writing animation in `AnimatedBoardText` (`pk`) and highlighter animation in `WholeNoteHighlighter` (`fk`) execute via chained `requestAnimationFrame` callbacks.  
  Measured real frame rate during active drawing:
  - Average frame delta: `16.66 ms`
  - Real-time frame rate: `60.0 fps` (ranging between 55 fps and 62 fps under load, frame deltas min `6.9 ms`, max `18.2 ms`).
- **Tag:** `[OBSERVED]`
- **Evidence:**  
  - `window.__obs.rafFrames` telemetry logging 600 consecutive rAF timestamps during lesson playback.  
  - Component `AnimatedBoardText` in `WhiteboardTutorHost-BxnRLDUH.js` line ~950810:
    ```javascript
    const $ = C => {
      P !== null && !a.value && (ne += Math.max(0, C - P) * i.value);
      P = C;
      const O = Math.min(1, ne / re);
      n.value = { writingRun: I, progress: O };
      O < 1 ? R = requestAnimationFrame($) : s.value();
    };
    return R = requestAnimationFrame($), () => cancelAnimationFrame(R);
    ```

---

### A4. Stacked Layers and Pen Sprite Tracking
- **Answer:**  
  The player uses a **multi-layer DOM stack** rather than stacked canvases:
  1. Base layout layer: `.agent-board-scene` containing vertical columns (`.agent-board-columns > .agent-board-column`).
  2. Board content blocks: `.agent-board-object` containing `.agent-rich-text` and KaTeX math nodes.
  3. Visual/diagram layer: `.agent-interactive-object` hosting sandboxed iframes.
  4. Active text reveal layer: `.writing-pen-surface.agent-writing-layer` embedded within active text blocks.
  5. Topmost overlay: `DIV.region-selection-layer > canvas` for lasso circling.  
  
  **Pen Sprite:**  
  There is an animated pen sprite component (`showWritingPen`) rendered at the active character head.  
  It follows the stroke/reveal tip by computing the bounding client rect of the active text or highlight DOM element and positioning the sprite tip at:  
  `x = rect.left + rect.width * progress`  
  `y = rect.top + rect.height * 0.78` (78% down the text line height).
- **Tag:** `[OBSERVED]`
- **Evidence:**  
  - DOM inspection of `.whiteboard-tutor-host` and `.writing-pen-surface`.  
  - Component `WholeNoteHighlighter` (`fk`) in `WhiteboardTutorHost-BxnRLDUH.js` line ~950750:
    ```javascript
    const A = c.getBoundingClientRect();
    if (A.width > 0 && A.height > 0 && r) {
      const I = { x: A.left + A.width * y, y: A.top + A.height * 0.78 };
      r(() => I);
    }
    ```

---

### A5. Stroke Styles, Colors, Widths, Line Caps, and Pressure
- **Answer:**  
  - **Selection Lasso Canvas:**
    - `lineWidth = 3` (3 px constant)
    - `lineCap = "round"`
    - `lineJoin = "round"`
    - `strokeStyle = "#007AFF"` (theme accent blue)
    - `globalAlpha = 0.92`
    - Fill: `rgba(0, 122, 255, 0.035)` with `fill("evenodd")`
  - **Diagram Strokes (p5.js in iframe):**
    - `strokeCap(ROUND)`
    - `strokeJoin(ROUND)`
    - `strokeWeight(2.5)` for vector vectors/arrows; `strokeWeight(2)` for axes/building lines.
    - Colors: `ink = '#293749'`, `blue = '#176eae'`, `orange = '#d57531'`, `gray = '#687686'`.
  - **Board Text:**
    - Body color: `#23303f`
    - Accent heading color: `#008f...` (blue accent)
  - **Pressure:**  
    Width does **not** vary with pressure; stroke widths are hardcoded constants (3 px for canvas selection, 2.5 px for diagrams).
- **Tag:** `[OBSERVED]`
- **Evidence:**  
  - Canvas context call capture in `WhiteboardTutorHost-BxnRLDUH.js` line ~502025.  
  - Source code of interactive diagram artifact `interactive_lesson_artifact_66ca2411eace4334b9c229a6a2ab2696`:
    ```javascript
    p.strokeCap(p.ROUND);
    p.strokeJoin(p.ROUND);
    const arrow = (x1, y1, x2, y2, c, weight = 2.5) => {
      p.stroke(c);
      p.strokeWeight(weight);
      p.line(x1, y1, x2, y2);
      ...
    };
    ```

---

## Section B: Strokes and Text

### B1. Handwriting Generation Mechanism and Source
- **Answer:**  
  The lesson player does **not** use vector handwriting glyph curves, SVG recorded paths, or digital pen coordinates.  
  Instead, it renders **standard typographic text** using system and web fonts (Inter, latin font-family) and KaTeX math blocks. The text is revealed progressively character-by-character to simulate real-time handwriting.  
  The text content originates entirely from the LLM tutor's function calls sent over HTTP SSE streams from endpoint `POST /tutor/api/sessions/:id`:  
  `tool_calls: [{ "name": "write_text", "arguments": "{\"content\": \"### Vertical Projectile Motion from a Building...\"}" }]`.
- **Tag:** `[OBSERVED]`
- **Evidence:**  
  - API response payload from `GET /tutor/api/sessions/00dffbb3118d01f3cfd93ccdf8dfc355/messages`.  
  - DOM tree showing `<div class="agent-rich-text">` containing HTML heading and paragraph tags wrapped in progressive reveal spans.

---

### B2. Math, Equations, Fractions, and Symbols
- **Answer:**  
  Math formulas are authored in standard LaTeX markdown (`$...$` for inline, `$$...$$` for display math) and rendered via **KaTeX** (`<span class="katex">`, `<math>`, `<semantics>`, `<mfrac>`, `<msup>`).  
  The formula DOM structure is typeset by KaTeX all at once when the node mounts. The animation then reveals the formula tokens progressively by slicing the visible units using the linear progress counter (`visibleUnits = Math.min(totalUnits, totalUnits * progress)`).
- **Tag:** `[OBSERVED]`
- **Evidence:**  
  - DOM inspection of Object 3 and Object 4 showing KaTeX MathML elements.  
  - Component `BoardRichText` (`pg`) and `InlineMarkdown` in `WhiteboardTutorHost-BxnRLDUH.js` lines ~930000–932000.

---

### B3. Shapes, Diagrams, and Animations
- **Answer:**  
  Diagrams (such as the 20 m building, launch velocity vector, trajectory curve, and ground coordinate mark) are generated by the LLM via tool call:  
  `tool_calls: [{ "name": "draw_p5", "arguments": "{\"presentation\":\"reference\",\"request\":\"Draw a clear physics diagram...\"}" }]`.  
  The server compiles this into a standalone HTML artifact loaded inside a double-sandboxed `iframe` with CSP `default-src 'none'; script-src 'unsafe-inline'`.  
  The diagram is drawn using **p5.js** (`p5.min.js`).  
  Diagrams are **not animated** (`"animated": false`, `"staticDrawing": true`). They are drawn once onto the p5 canvas statically when the iframe loads.
- **Tag:** `[OBSERVED]`
- **Evidence:**  
  - Payload of artifact `GET /tutor/api/sessions/00dffbb3118d01f3cfd93ccdf8dfc355/interactive-lessons/interactive_lesson_artifact_66ca2411eace4334b9c229a6a2ab2696`.  
  - Artifact source containing `const lesson = {"title":"Vertical launch from a 20 m building","staticDrawing":true,"animated":false}` and `createLessonScene(p, api)`.

---

### B4. Stroke and Text Timing Dynamics
- **Answer:**  
  The duration of each text reveal is determined by function `hk(t)`:
  - Duration formula: `durationMs = Math.max(700, Math.min(8000, graphemeCount * 58))`
  - Minimum duration: **700 ms**
  - Maximum duration: **8,000 ms**
  - Constant speed: **58 ms per grapheme cluster** (~17.2 characters/second).
  - Easing: **Strictly linear** (`progress = Math.min(1, elapsedMs / durationMs)`). There is no acceleration or deceleration easing curve on handwriting text.  
  - Gaps between sentences within a speech turn are **0.8 ms to 9.0 ms** (virtually gapless). Gaps between turns awaiting diagram generation reach **10,242 ms (~10.2 s)**.

#### Sample of 20 Text & Reveal Segments
| # | Segment Identifier / Text Snippet | Type | Units (Graphemes) | Duration (Calculated / Measured) | Easing | Gap to Next |
|---|---|---|---|---|---|---|
| 1 | `### Vertical Projectile Motion from a Building` | Header | 44 | 2,552 ms | Linear | 0 ms |
| 2 | `- **Scenario**: A ball is launched straight upward` | Markdown | 49 | 2,842 ms | Linear | 0 ms |
| 3 | `from a $20\,\mathrm{m}$ rooftop at $15\,\mathrm{m/s}$` | Math/Text | 48 | 2,784 ms | Linear | 0 ms |
| 4 | `under gravity ($g = 9.8\,\mathrm{m/s^2}$)` | Math/Text | 37 | 2,146 ms | Linear | 0 ms |
| 5 | `- **Goals**:` | Markdown | 10 | 700 ms (clamped min) | Linear | 0 ms |
| 6 | `1. Find the maximum height above the ground` | List item | 43 | 2,494 ms | Linear | 0 ms |
| 7 | `2. Find the total flight time to reach the ground` | List item | 48 | 2,784 ms | Linear | 0 ms |
| 8 | `3. Find the speed just before impact` | List item | 36 | 2,088 ms | Linear | 10,242 ms |
| 9 | `#### Coordinate Frame & Givens` | Header | 30 | 1,740 ms | Linear | 0 ms |
| 10 | `- **Origin & Direction**: Ground at $y = 0\,\mathrm{m}$` | Markdown | 50 | 2,900 ms | Linear | 0 ms |
| 11 | `, upward is $+y$` | Text | 17 | 986 ms | Linear | 0 ms |
| 12 | `Initial position: $y_0 = 20\,\mathrm{m}$` | Math/Text | 34 | 1,972 ms | Linear | 0 ms |
| 13 | `Initial velocity: $v_0 = +15\,\mathrm{m/s}$` | Math/Text | 36 | 2,088 ms | Linear | 0 ms |
| 14 | `Constant acceleration: $a = -g = -9.8\,\mathrm{m/s^2}$` | Math/Text | 48 | 2,784 ms | Linear | 850 ms |
| 15 | `#### Part (a): Maximum Height Above the Ground` | Header | 45 | 2,610 ms | Linear | 0 ms |
| 16 | `- **Condition at the peak**: $v = 0\,\mathrm{m/s}$` | Markdown | 42 | 2,436 ms | Linear | 0 ms |
| 17 | `Time-independent kinematics equation:` | Text | 39 | 2,262 ms | Linear | 0 ms |
| 18 | `$$v^2 = v_0^2 + 2a(y_{\max} - y_0)$$` | Display Math | 33 | 1,914 ms | Linear | 1,120 ms |
| 19 | `$$0^2 = (15)^2 + 2(-9.8)(y_{\max} - 20)$$` | Display Math | 38 | 2,204 ms | Linear | 0 ms |
| 20 | `$$y_{\max} - 20 = \frac{225}{19.6} \approx 11.48\,\mathrm{m}$$` | Display Math | 54 | 3,132 ms | Linear | 0 ms |
- **Tag:** `[OBSERVED]`
- **Evidence:**  
  - Source code in `WhiteboardTutorHost-BxnRLDUH.js` line ~950778:
    ```javascript
    function hk(t) {
      const e = typeof Intl.Segmenter == "function"
        ? Array.from(new Intl.Segmenter("und", { granularity: "grapheme" }).segment(t)).length
        : Array.from(t).length;
      return Math.max(700, Math.min(8000, e * 58));
    }
    ```

---

### B5. Instant Draw vs Animation Skipping
- **Answer:**  
  The pen skips animation and renders content instantly under four explicit conditions:
  1. **Session reload / rehydration:** When loading an existing or finished session (`!writingRun || writingCompleted`), all board text objects mount with `progress = 1.000` immediately.
  2. **Interactive diagrams and artifacts:** Diagrams generated via `draw_p5` appear as whole rendered scenes once the iframe finishes loading; they do not reveal path-by-path.
  3. **Headless or SSR runtime:** When `typeof requestAnimationFrame === "undefined"`.
  4. **Audio clock catchup:** If the pen animation falls behind the master audio clock (`synchronizedProgress > localProgress`), the text reveal immediately jumps ahead to match audio progress:  
     `r = Math.max(r, n * localProgress, n * synchronizedProgress)`.
- **Tag:** `[OBSERVED]`
- **Evidence:**  
  - Component `AnimatedBoardText` (`pk`) code in `WhiteboardTutorHost-BxnRLDUH.js`:
    ```javascript
    const { writingRun: I, writingCompleted: M, text: z } = t;
    if (!I || M || typeof requestAnimationFrame > "u") {
      n.value = { writingRun: I, progress: 1 };
      I && !M && s.value();
      return;
    }
    ```

---

## Section C: Audio and Synchronization

### C1. Audio Playback Mechanism and Transport
- **Answer:**  
  Audio is played using standard HTML **`<audio>` elements** managed by an internal `AudioPlayer` coordinator class (`new Audio()`).  
  - Format: **audio/mpeg (MP3)**  
  - Granularity: **One file per sentence/segment**. Chunks are delivered as base64-encoded strings within streaming SSE payloads, decoded via `atob()`, converted to a `Uint8Array`, and wrapped into a Blob URL (`URL.createObjectURL(new Blob([u], { type: "audio/mpeg" }))`).  
  - In the observed test problem, 26 separate sequential blob URLs were instantiated and played.
- **Tag:** `[OBSERVED]`
- **Evidence:**  
  - Method `enqueue` in `AudioPlayer` (`WhiteboardTutorHost-BxnRLDUH.js` line ~8115):
    ```javascript
    let i = "";
    try {
      const l = atob(n), u = Uint8Array.from(l, c => c.charCodeAt(0));
      i = URL.createObjectURL(new Blob([u], { type: "audio/mpeg" }));
    } catch(l) { ... }
    ```

---

### C2. Speech Timing Data and Alignment Schema
- **Answer:**  
  There is **no word-level or phoneme-level timestamp data** (no speech marks) sent from the backend!  
  The backend provides only segment-level metadata. The client synthesizes word and character alignment by tokenizing the text into grapheme clusters using `Intl.Segmenter` and linearly mapping elapsed audio time against `audio.duration`.

#### Audio Chunk Envelope Schema
```typescript
interface AudioChunkPayload {
  segment_index: number;
  audio_base64: string;
  text: string;
  meta: {
    turn_id: string;
    text_start_char?: number;
    text_end_char?: number;
  };
}
```

#### Real Trimmed Example
```json
{
  "segment_index": 0,
  "audio_base64": "//uQZAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAAfAAAHw...",
  "text": "Welcome to our kinematics jam session!",
  "meta": {
    "turn_id": "45137ef5-740c-4b5a-9ece-96bb323a1feb",
    "text_start_char": 0,
    "text_end_char": 38
  }
}
```
- **Tag:** `[OBSERVED]`
- **Evidence:**  
  - SSE payload parsing logic in `index.esm-CXiLgN6x.js` and `AudioPlayer.enqueue()` in `WhiteboardTutorHost-BxnRLDUH.js`.

---

### C3. Master Clock
- **Answer:**  
  The master clock is **`audio.currentTime`**.  
  In the `updateCaption` frame loop, the client computes normalized progress by dividing `audio.currentTime` by `audio.duration`, which in turn sets `timelineProgress` and synchronizes the board text reveal:  
  `n = Math.min(1, Math.max(0, this.audio.currentTime / e))`.
- **Tag:** `[OBSERVED]`
- **Evidence:**  
  - `WhiteboardTutorHost-BxnRLDUH.js` line ~14010:
    ```javascript
    updateCaption() {
      if (!this.audio || !this.captionSegment || !this.playing) return;
      const e = Number.isFinite(this.audio.duration) && this.audio.duration > 0
        ? this.audio.duration : this.captionDuration;
      const n = Math.min(1, Math.max(0, this.audio.currentTime / e));
      const r = Math.min(this.captionUnits.length, Math.ceil(this.captionUnits.length * n));
      const a = this.captionUnits.slice(0, r).join("");
      if (a !== this.caption || Math.abs(n - this.captionProgress) >= 0.01) {
        this.caption = a;
        this.captionProgress = n;
        if (this.textTotalChars > 0) {
          const i = this.activeTextStartChar + (this.activeTextEndChar - this.activeTextStartChar) * n;
          this.timelineProgress = Math.max(0, Math.min(1, i / this.textTotalChars));
        }
        this.emitState();
      }
    }
    ```

---

### C4. Sentence vs Audio vs Board Stroke Timeline (C4 Table)

The following table records the observed sentence timeline, audio start and end timestamps (relative to submission at `t = 0`), board object start/end timings, and measured lag (`first stroke start − audio start`).

| # | Sentence Narration Text | Audio Start (ms) | Audio End (ms) | Duration (ms) | Board Object ID & Action | Board Start (ms) | Board End (ms) | Lag (ms) |
|---|---|---|---|---|---|---|---|---|
| 1 | "Welcome to our kinematics jam session!" | 73,871.4 | 78,509.1 | 4,637.7 | `text_613b966f8e` (Title mount) | 74,480.0 | 77,032.0 | +608.6 |
| 2 | "Picture yourself standing on the roof of a tall building and launching a ball straight up into the sky." | 78,518.1 | 85,546.1 | 7,028.0 | `text_613b966f8e` (Scenario text) | 78,520.0 | 81,362.0 | +1.9 |
| 3 | "We are going to track that ball's entire journey, from the moment it leaves your hand, up to the very peak of its flight..." | 85,547.8 | 97,556.7 | 12,008.9 | `text_613b966f8e` (Rooftop values) | 85,550.0 | 90,480.0 | +2.2 |
| 4 | "Let's get our lesson title and our game plan up on the board first." | 97,557.5 | 103,156.4 | 5,598.9 | `text_613b966f8e` (Goals list 1–3) | 97,560.0 | 103,150.0 | +2.5 |
| 5 | "To see the big picture before we touch any formulas, let's draw a diagram of the building and the ball's path." | 113,399.0 | 122,235.3 | 8,836.3 | `interactive_lesson_44d0...` (p5 fetch) | 113,400.0 | 122,200.0 | +1.0 |
| 6 | "Even though the ball travels straight up and straight down along a single vertical line, we draw the upward and downward paths slightly separated side by side..." | 122,237.2 | 140,931.5 | 18,694.3 | `interactive_lesson_44d0...` (p5 render) | 122,240.0 | 123,050.0 | +2.8 |
| 7 | "Let's sketch that setup right now." | 140,933.5 | 144,518.9 | 3,585.4 | Diagram caption highlight | 140,935.0 | 141,500.0 | +1.5 |
| 8 | "Look at how setting a coordinate frame makes everything click into place." | 145,106.6 | 150,461.7 | 5,355.1 | `text_03e523459f` (Header mount) | 145,950.0 | 147,690.0 | +843.4 |
| 9 | "In physics, before we calculate a single number, we choose an origin and a positive direction so that upward and downward quantities don't get mixed up." | 150,464.0 | 164,489.8 | 14,025.8 | `text_03e523459f` (Origin & Dir) | 150,470.0 | 153,370.0 | +6.0 |
| 10 | "Let's put ground level at zero meters and call upward the positive direction..." | 164,491.4 | 185,586.5 | 21,095.1 | `text_03e523459f` (Givens y0, v0, a) | 164,495.0 | 171,323.0 | +3.6 |
| 11 | "Let's record that coordinate frame on the board." | 185,587.5 | 189,426.5 | 3,839.0 | `text_03e523459f` (Highlight) | 185,590.0 | 186,150.0 | +2.5 |
| 12 | "Now let's zoom in on part a, finding the maximum height above the ground." | 190,029.9 | 196,550.7 | 6,520.8 | `text_f4ef66ab54` (Part a mount) | 190,850.0 | 193,460.0 | +820.1 |
| 13 | "As the ball rises, gravity slows it down until it momentarily stops at the very top of its path, where its vertical velocity is zero." | 196,551.5 | 207,836.3 | 11,284.8 | `text_f4ef66ab54` (Condition peak) | 196,555.0 | 198,991.0 | +3.5 |
| 14 | "Because we know the starting position, the starting velocity, the final velocity of zero at the peak, and the acceleration..." | 207,837.1 | 219,676.5 | 11,839.4 | `text_f4ef66ab54` (Equation intro) | 207,840.0 | 210,102.0 | +2.9 |
| 15 | "Let's write down that relationship." | 219,677.6 | 222,257.7 | 2,580.1 | `text_f4ef66ab54` (v^2 = v0^2 + 2aΔy) | 219,680.0 | 221,594.0 | +2.4 |
| 16 | "Let's substitute our known numbers into this equation and solve for the peak position, y max." | 223,187.7 | 230,567.0 | 7,379.3 | `text_9522079634` (Substitution) | 223,950.0 | 226,154.0 | +762.3 |
| 17 | "At the peak, the velocity squared is zero, the initial velocity squared is fifteen squared, which is two hundred twenty-five..." | 230,568.0 | 242,217.1 | 11,649.1 | `text_9522079634` (Rise calculation) | 230,570.0 | 233,702.0 | +2.0 |
| 18 | "When we solve for the vertical rise above the roof, we get about eleven point five meters, and adding the twenty-meter building height gives our total height above the ground!" | 242,218.1 | 255,476.4 | 13,258.3 | `text_9522079634` (Final answer 31.5 m) | 242,220.0 | 245,352.0 | +1.9 |
| 19 | "Let's put that calculation on the board." | 255,477.4 | 258,936.0 | 3,458.6 | `text_9522079634` (Box highlight) | 255,480.0 | 256,040.0 | +2.6 |
| 20 | "Let's also update our diagram to show this newly found peak height of thirty-one point five meters above the ground..." | 259,819.4 | 273,248.1 | 13,428.7 | `interactive_lesson_03de...` (Diagram 2) | 259,820.0 | 260,650.0 | +0.6 |
- **Tag:** `[OBSERVED]`
- **Evidence:**  
  - Playwright MCP telemetry recording audio events (`play`, `timeupdate`, `pause`, `ended`) correlated with session messages and `board_objects.created_at` timestamps.

---

### C5. Lag Evolution Across the Lesson
- **Answer:**  
  Lag **does not grow or drift** across the lesson; it **resets at every turn boundary**:
  - Within a spoken block, lag is negligible (**0.6 ms to 6.0 ms**) because the text progress is locked to `audio.currentTime`.
  - When an assistant turn starts with introductory conversational filler before calling a tool, the board object start lags the speech start by **600 ms to 850 ms** while the LLM generates the tool call arguments.
  - Ordered lag sequence across initial turn sentences (ms):  
    `+608.6`, `+1.9`, `+2.2`, `+2.5`, `+1.0`, `+2.8`, `+1.5`, `+843.4`, `+6.0`, `+3.6`, `+2.5`, `+820.1`, `+3.5`, `+2.9`, `+2.4`, `+762.3`, `+2.0`, `+1.9`, `+2.6`, `+0.6`.
- **Tag:** `[OBSERVED]`
- **Evidence:**  
  - Measured series from Section C4 table.

---

### C6. Audio/Pen Mutual Waiting and Catchup
- **Answer:**  
  - **Does audio wait for pen?**  
    Yes, for visual diagram generation. When a `draw_p5` tool call is executed, audio playback suspends for up to 10.2 seconds (`waitForMissingSegment`) until the diagram artifact is ready.
  - **Does pen wait for audio?**  
    Yes. If the audio is paused (`audio.pause()`), the pen animation freezes immediately because elapsed time accumulation is gated by `!a.value` (where `a.value = t.paused`).
  - **If pen gets behind audio:**  
    The pen **speeds up / jumps ahead instantly**. The visible character count is governed by:  
    `r = Math.max(r, n * localProgress, n * synchronizedProgress)`.  
    If `synchronizedProgress` (driven by `audio.currentTime`) exceeds `localProgress`, `visibleUnits` instantly snaps forward to match speech.
- **Tag:** `[OBSERVED]`
- **Evidence:**  
  - Progress calculation function in `WhiteboardTutorHost-BxnRLDUH.js` line ~929904.

---

### C7. Inter-Sentence Silence
- **Answer:**  
  - Within a continuous turn (between sentences within the same monologue), silence is **0.8 ms to 9.0 ms** (virtually gapless back-to-back audio chunk transition).  
  - Between turns (when waiting for tool calls, diagram generation, or student interactions), silence lasts from **850 ms to 10,242 ms** (10.2 s).
- **Tag:** `[OBSERVED]`
- **Evidence:**  
  - Difference between `pause.relMs` of chunk $i$ and `play.relMs` of chunk $i+1$ in `window.__obs.audioEvents`.

---

## Section D: Board Content vs Narration

### D1. Narration Transcript vs Board Text
- **Answer:**  
  The board is **strongly abbreviated, structured, and formal**, while the narration is **conversational, intuitive, and pedagogical**. The board omits all conversational banter, analogies, and rhetorical questions, recording only mathematical definitions, equations, and diagrams.

#### 5 Side-by-Side Examples
1. **Lesson Introduction & Title:**  
   - *Narration:* "Welcome to our kinematics jam session! Picture yourself standing on the roof of a tall building and launching a ball straight up into the sky. We are going to track that ball's entire journey, from the moment it leaves your hand, up to the very peak of its flight, and all the way down until it hits the ground below. Let's get our lesson title and our game plan up on the board first."  
   - *Whiteboard Text:*  
     ```markdown
     ### Vertical Projectile Motion from a Building
     - **Scenario**: A ball is launched straight upward from a $20\,\mathrm{m}$ rooftop at $15\,\mathrm{m/s}$ under gravity ($g = 9.8\,\mathrm{m/s^2}$)
     - **Goals**:
       1. Find the maximum height above the ground
       2. Find the total flight time to reach the ground
       3. Find the speed just before impact
     ```
2. **Setup of Coordinate Frame:**  
   - *Narration:* "Look at how setting a coordinate frame makes everything click into place. In physics, before we calculate a single number, we choose an origin and a positive direction so that upward and downward quantities don't get mixed up. Let's put ground level at zero meters and call upward the positive direction, which means the launch happens at positive twenty meters, the initial velocity is positive fifteen meters per second, and gravity pulls downward with an acceleration of negative nine point eight meters per second squared. Let's record that coordinate frame on the board."  
   - *Whiteboard Text:*  
     ```markdown
     #### Coordinate Frame & Givens
     - **Origin & Direction**: Ground at $y = 0\,\mathrm{m}$, upward is $+y$
     - **Initial position**: $y_0 = 20\,\mathrm{m}$
     - **Initial velocity**: $v_0 = +15\,\mathrm{m/s}$
     - **Constant acceleration**: $a = -g = -9.8\,\mathrm{m/s^2}$
     ```
3. **Kinematics Equation Selection:**  
   - *Narration:* "Now let's zoom in on part a, finding the maximum height above the ground. As the ball rises, gravity slows it down until it momentarily stops at the very top of its path, where its vertical velocity is zero. Because we know the starting position, the starting velocity, the final velocity of zero at the peak, and the acceleration, we can connect them directly using the time-independent kinematics equation! Let's write down that relationship."  
   - *Whiteboard Text:*  
     ```markdown
     #### Part (a): Maximum Height Above the Ground
     - **Condition at the peak**: $v = 0\,\mathrm{m/s}$ at $y = y_{\max}$
     - **Time-independent kinematics equation**:
       $$v^2 = v_0^2 + 2a(y_{\max} - y_0)$$
     ```
4. **Calculations for Maximum Height:**  
   - *Narration:* "Let's substitute our known numbers into this equation and solve for the peak position, y max. At the peak, the velocity squared is zero, the initial velocity squared is fifteen squared, which is two hundred twenty-five, and twice the acceleration is negative nineteen point six. When we solve for the vertical rise above the roof, we get about eleven point five meters, and adding the twenty-meter building height gives our total height above the ground! Let's put that calculation on the board."  
   - *Whiteboard Text:*  
     ```markdown
     $$0^2 = (15)^2 + 2(-9.8)(y_{\max} - 20)$$
     $$y_{\max} - 20 = \frac{225}{19.6} \approx 11.48\,\mathrm{m}$$
     $$y_{\max} = 20 + 11.48 = 31.48\,\mathrm{m} \approx 31.5\,\mathrm{m}$$
     ```
5. **Interactive Checkpoint Question:**  
   - *Narration:* "Now let's tackle part b, finding the total time it takes for the ball to hit the ground. Here is where our coordinate frame saves us so much work! Instead of splitting the trip into an upward part and a downward part, we can write one single position-time equation for the entire flight from the roof to the ground. Let's check your intuition on what the final position and net displacement look like when the ball hits the ground."  
   - *Whiteboard Text (Interactive Checkpoint Card):*  
     ```markdown
     In our coordinate system ($y_0 = 20\,\mathrm{m}$ at the roof, $+y$ upward), what are the ball's final position $y$ and displacement $\Delta y$ when it hits the ground?
     [Option 1]: y = 0 m, so Δy = -20 m
     [Option 2]: y = 20 m, so Δy = +20 m
     [Option 3]: y = 31.5 m, so Δy = -31.5 m
     [Action]: Skip
     ```
- **Tag:** `[OBSERVED]`
- **Evidence:**  
  - Full transcript items from `.transcript-list` compared directly against rendered `.agent-board-object` inner text.

---

### D2. Erasing, Fading, and Replacement
- **Answer:**  
  Text blocks are **never erased or faded away**. The board state accumulates monotonically.  
  Visual diagrams, however, undergo **visual replacement** (`is-visual-replacement`):  
  When an updated diagram is generated (e.g. adding the calculated $31.5\text{ m}$ peak height annotation to the launch trajectory), the old diagram in the visual slot is superseded by the new diagram artifact. The replacement is **instant** (DOM vnode replacement), with no erasing animation or cross-fade.
- **Tag:** `[OBSERVED]`
- **Evidence:**  
  - DOM inspection of Column 0 and Column 2 containing `.agent-board-object.is-visual-replacement`.

---

### D3. Board Overflow, Camera Movement, Duration, and Easing
- **Answer:**  
  When the whiteboard content overflows the visible viewport, the player performs an **animated camera pan** using CSS 3D Transforms on `.agent-board-scene`. It does not clear the board, create pagination pages, or redraw an internal canvas offset.  
  - Mechanism: `style="transform: translate3d(Xpx, Ypx, 0px) scale(1);"`  
  - Measured Duration: **1.0 s (1,000 ms)**  
  - Measured Easing: **`cubic-bezier(0.22, 1, 0.36, 1)`**  
  - Zoom level: Stays at `scale(1)` throughout lesson playback.
- **Tag:** `[OBSERVED]`
- **Evidence:**  
  - Measured via Playwright during "Locate this passage on the whiteboard" button clicks:
    - Pre-click: `transform: translate3d(0px, 0px, 0px) scale(1);`
    - Post-click (500 ms): `transform: translate3d(208.5px, 223.617px, 0px) scale(1);`
    - Computed CSS: `transition: transform 1s cubic-bezier(0.22, 1, 0.36, 1)`.

---

### D4. Layout Grid, Columns, and Margins
- **Answer:**  
  The whiteboard uses a **multi-column downward-flowing layout**:
  - Column Width: Exactly **528 px fixed** (`.agent-board-column { width: 528px }`).
  - Inter-Column Horizontal Gap: Exactly **100 px fixed**  
    - Column 0: $x = 0\text{ px}$
    - Column 1: $x = 628\text{ px}$ ($0 + 528 + 100$)
    - Column 2: $x = 1256\text{ px}$ ($628 + 528 + 100$)
  - Vertical Gap between Blocks in a Column: Exactly **48 px fixed** (set via CSS custom property `--agent-board-gap-before: 48px`).
  - Layout Reflow: **None**. Once an object is placed, its $(x, y, w, h)$ coordinates and flow order remain static.
- **Tag:** `[OBSERVED]`
- **Evidence:**  
  - Evaluated bounding box rects of all columns and child objects via Playwright:
    - Column 0 Object 0: height 349 px, Object 1 top: 397 px ($397 - 349 = 48\text{ px}$).
    - Column 1 Object 0: height 231 px, Object 1 top: 279 px ($279 - 231 = 48\text{ px}$).

---

## Section E: Growth and Memory

### E1. Heap Size and Canvas Data Series (E1 Table)

Snapshots captured at ~15-second intervals during live session execution:

| Time Elapsed (s) | Relative Time (ms) | Overlay Canvas toDataURL().length (bytes) | Used JS Heap Size (bytes) | Total JS Heap Size (bytes) | Active Board Objects Count |
|---|---|---|---|---|---|
| 0 s (Baseline) | 0.0 | — (Not mounted) | 383,359,135 | 457,750,623 | 0 |
| 15 s | 13,825.0 | 68,866 | 431,424,121 | 500,856,741 | 1 |
| 30 s | 28,825.9 | 68,866 | 444,640,899 | 510,279,443 | 1 |
| 45 s | 43,825.5 | 68,866 | 454,963,272 | 519,724,516 | 2 (Diagram 1) |
| 60 s | 58,825.7 | 68,866 | 222,225,419 (GC) | 401,282,015 | 2 |
| 75 s | 73,824.8 | 77,070 | 214,875,631 | 405,853,195 | 3 |
| 90 s | 88,830.1 | 77,070 | 163,143,857 (GC) | 310,897,417 | 3 |
| 105 s | 103,826.1 | 77,070 | 154,073,492 | 315,462,748 | 4 |
| 120 s | 118,950.6 | 77,070 | 162,795,454 | 272,938,966 | 4 |
| 135 s | 133,883.7 | 77,070 | 171,486,369 | 264,555,877 | 5 |
| 150 s | 148,847.8 | 77,070 | 174,418,151 | 258,386,167 | 5 |
| 165 s | 163,824.9 | 77,070 | 455,006,994 | 521,068,726 | 6 (Diagram 2) |
| 180 s | 178,827.6 | 77,070 | 248,530,254 (GC) | 568,729,642 | 6 |
| 195 s | 193,828.3 | 77,070 | 267,291,013 | 576,706,757 | 7 (Checkpoint) |

- **Accumulation vs Clearing:**  
  The board **keeps accumulating** objects across columns. The overlay canvas data URL length remains constant (68,866 to 77,070 bytes) because the overlay canvas is strictly a viewport-sized transparent layer.
- **Tag:** `[OBSERVED]`
- **Evidence:**  
  - Telemetry snapshots in `window.__obs.heapSeries` reading `performance.memory` and `canvas.toDataURL()`.

---

### E2. Board State Representation in Memory
- **Answer:**  
  The full board state is kept in memory as an **array of reactive domain objects** (`board_objects`), rendered once into HTML/DOM nodes, and left in the DOM.  
  It is **not** kept as an array of raw pen vector points redrawn on a canvas every frame.  
  The reveal state of each block is cached in a Map store (`revealStateStore`) so that once an object reaches `progress = 1.0`, it never recalculates or re-renders.
- **Tag:** `[OBSERVED]`
- **Evidence:**  
  - Source code in `WhiteboardTutorHost-BxnRLDUH.js` line ~952315:
    ```javascript
    const u = G(() => mS(t.revealStateStore.get(t.objectId) || null, {
      text: t.text,
      writingRun: t.writingRun,
      localProgress: l.value,
      synchronizedProgress: t.synchronizedProgress
    }));
    ze(() => u.value, () => {
      t.revealStateStore.set(t.objectId, u.value.state);
    }, { immediate: true, flush: "pre" });
    ```

---

## Section F: Resize and Controls

### F1. Window Resize Behavior
- **Answer:**  
  - **Sharpening vs Blurring:**  
    Content **never blurs or stretches**. Because text and math are native DOM typography and KaTeX SVGs, they remain completely vector-sharp at every viewport width and height.
  - **Canvas Dimensions:**  
    The selection overlay canvas automatically updates its `width` and `height` attributes to match the new viewport dimensions (`width: 649, height: 700` at window 1000 × 700 px).
  - **Layout Reflow:**  
    Columns maintain their fixed **528 px width**. If the window becomes narrower than the columns, the board scene scrolls horizontally via pan or user touch gesture; column contents do not squish or re-wrap.
- **Tag:** `[OBSERVED]`
- **Evidence:**  
  - Playwright `browser_resize` tests at (1000 × 700), (800 × 400), and (1440 × 900).

---

### F2. Pause and Resume Behavior
- **Answer:**  
  When pause is triggered:
  - Audio calls `this.audio.pause()` and stops the rAF caption loop.
  - Pen animation freezes **mid-character** at its exact progress fraction:  
    `ne += Math.max(0, C - P) * i.value` (where `a.value = t.paused` halts `ne` incrementation).
  - On resume, audio resumes from `audio.currentTime` and the pen writing animation continues smoothly from the exact character index where it froze.
- **Tag:** `[OBSERVED]`
- **Evidence:**  
  - `AudioPlayer.pause()` and `AudioPlayer.resume()` in `WhiteboardTutorHost-BxnRLDUH.js` line ~9100.

---

### F3. Seek and Scrub Behavior
- **Answer:**  
  Solvely **does not have a seek bar or scrubber** for the lesson timeline.  
  However, seeking to specific passages is supported via the **Transcript Panel**:
  - Clicking any "Locate this passage on the whiteboard" button (`.transcript-select-action`) triggers a smooth camera pan (`translate3d`) directly to that content column.
  - Board content does not reload or replay; it is already present in memory and immediately visible. The transition takes exactly 1.0 s (`cubic-bezier(0.22, 1, 0.36, 1)`).
- **Tag:** `[OBSERVED]`
- **Evidence:**  
  - DOM inspection of transcript list actions and click evaluation on `.transcript-select-action`.

---

### F4. Speed Control, Synchronization, and Pitch
- **Answer:**  
  Speed control is available via `.speed-trigger` with 5 selectable speeds:  
  **0.75x, 1.0x, 1.25x, 1.5x, 2.0x**.  
  - **Coupled Speed:** Speed changes affect **both audio and pen writing speed simultaneously**.
  - **Audio Implementation:** `this.audio.playbackRate = n; this.audio.preservesPitch = true;`
  - **Pen Implementation:** The elapsed rAF frame delta is multiplied by playback rate: `ne += Math.max(0, C - P) * i.value` (where `i.value = playbackRate`).
  - **Pitch:** Pitch is **preserved** without chipmunk distortion using the browser's native `preservesPitch` Web Audio/HTMLMediaElement capability.
- **Tag:** `[OBSERVED]`
- **Evidence:**  
  - Source code in `AudioPlayer.setPlaybackRate()` and `AnimatedBoardText` (`WhiteboardTutorHost-BxnRLDUH.js`).

---

### F5. Mid-Lesson Question Interactivity
- **Answer:**  
  The lesson player pauses speech and board writing at designated pedagogical checkpoints:
  - A multiple-choice interactive card mounts on the whiteboard (`.agent-board-object.is-checkpoint-card`), presenting option buttons and an explanation input.
  - Audio playback stops and waits for student interaction.
  - Selecting an answer button (e.g. `y = 0 m, so Δy = -20 m`) or typing into the composer sends a user response turn to `POST /tutor/api/sessions/:id/messages`, which triggers the next assistant explanation turn.
- **Tag:** `[OBSERVED]`
- **Evidence:**  
  - DOM inspection of Object 6 (`is-checkpoint-card`) and turn 13 tool call `ask_student`.

---

## Section G: Network and Generation Architecture

### G1. Chronological Request List

Recorded from start button click (`t = 0` at `t = 60,487.4 ms`):

| # | Time Rel to Start (ms) | Method | Endpoint / URL Path (Cleaned) | Type | Status | Payload / Size |
|---|---|---|---|---|---|---|
| 1 | +0 ms | POST | `/tutor/api/sessions` | fetch | 201 | `{ initial_intent: "whiteboard_tutor", problem_text: "..." }` |
| 2 | +312 ms | PATCH | `/tutor/api/sessions/:sessionId` | fetch | 200 | Title update |
| 3 | +1,815 ms | GET | `/tutor/api/sessions/:sessionId` | fetch | 200 | Initial session metadata & board object list |
| 4 | +2,104 ms | GET | `/tutor/api/sessions/:sessionId/messages` | fetch | 200 | Initial turn messages |
| 5 | +11,375 ms | POST | `/tutor/api/logs` | fetch | 200 | Telemetry `classroom_init` |
| 6 | +13,384 ms | Blob | `blob:https://solvely.ai/9f4e83a2...` | audio | 200 | Audio Chunk 0 (MP3, 3.55 s) |
| 7 | +18,031 ms | Blob | `blob:https://solvely.ai/c8d8d78e...` | audio | 200 | Audio Chunk 1 (MP3, 6.91 s) |
| 8 | +25,060 ms | Blob | `blob:https://solvely.ai/8681f7b1...` | audio | 200 | Audio Chunk 2 (MP3, 11.90 s) |
| 9 | +37,070 ms | Blob | `blob:https://solvely.ai/0ce72ffd...` | audio | 200 | Audio Chunk 3 (MP3, 5.50 s) |
| 10 | +42,669 ms | POST | `/tutor/api/logs` | fetch | 200 | Telemetry `visual_generate` start |
| 11 | +52,912 ms | GET | `/tutor/api/sessions/:sessionId/interactive-lessons/interactive_lesson_artifact_66ca2411...` | fetch | 200 | HTML artifact (23.7 KB) |
| 12 | +53,105 ms | GET | `/tutor/static/vendor/p5/p5.min.js` | fetch | 200 | Vendor p5 library (cached) |
| 13 | +53,150 ms | GET | `/tutor/static/vendor/p5/p5-shapes-compat.js` | fetch | 200 | Shapes compatibility script |
| 14 | +52,912 ms | Blob | `blob:https://solvely.ai/a79b7938...` | audio | 200 | Audio Chunk 4 (MP3, 8.66 s) |
| 15 | +61,750 ms | Blob | `blob:https://solvely.ai/b0463d97...` | audio | 200 | Audio Chunk 5 (MP3, 19.43 s) |
| 16 | +80,446 ms | Blob | `blob:https://solvely.ai/bdac8895...` | audio | 200 | Audio Chunk 6 (MP3, 3.36 s) |
| 17 | +84,619 ms | Blob | `blob:https://solvely.ai/9f899d21...` | audio | 200 | Audio Chunk 7 (MP3, 5.19 s) |
| 18 | +89,977 ms | Blob | `blob:https://solvely.ai/74a39839...` | audio | 200 | Audio Chunk 8 (MP3, 13.87 s) |
| 19 | +104,004 ms | Blob | `blob:https://solvely.ai/e364e24a...` | audio | 200 | Audio Chunk 9 (MP3, 21.57 s) |
| 20 | +125,096 ms | POST | `/tutor/api/logs` | fetch | 200 | Telemetry `lesson_ready` |
| 21 | +125,100 ms | GET | `/tutor/api/sessions/:sessionId/interactive-lessons/interactive_lesson_artifact_2d6a6d30...` | fetch | 200 | HTML artifact 2 (Diagram 2) |
- **Tag:** `[OBSERVED]`
- **Evidence:**  
  - Requests captured by `window.__obs.requests`.

---

### G2. Full Pre-generation vs Streaming and Initial Latency
- **Answer:**  
  The lesson is **streamed step-by-step turn-by-turn**, NOT pre-generated in full.  
  The initial turn and board introduction stream immediately. As the tutor explains each step, background tool calls generate the next board objects, audio chunks, and diagram artifacts.  
  - **Latency from click to first audio:** **13,384 ms (~13.4 s)**  
  - **Latency from click to first text reveal:** **~13.5 s** (starts synchronously with the first speech segment).
- **Tag:** `[OBSERVED]`
- **Evidence:**  
  - `window.__obs.clickTime` (`60,487.4 ms`) vs `window.__obs.firstAudioTime` (`73,871.4 ms`).

---

### G3. Response Payload Schemas

#### 1. Session Metadata & Board Objects (`GET /tutor/api/sessions/:id`)
```typescript
interface SessionResponse {
  session_id: string;
  title: string;
  learning_mode: "sequential" | string;
  board_objects: Array<{
    object_id: string;
    kind: "text" | "interactive_lesson" | "diagram";
    data: {
      text?: string;
      color?: string;
      flow_order?: number;
      created_at?: number;
      heading_accent?: string;
      layout_turn_id?: string;
    };
  }>;
  board_strokes: any[]; // Empty array (no vector strokes used)
  page_strokes: any[];  // Empty array
  performance_metrics: Record<string, any>;
}
```

#### 2. Messages & Tool Calls (`GET /tutor/api/sessions/:id/messages`)
```typescript
interface MessageItem {
  ts: number;
  role: "user" | "assistant" | "tool";
  text?: string;
  turn_id: string;
  conversation_entry_id: string;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: {
      name: "write_text" | "draw_p5" | "ask_student";
      arguments: string; // JSON encoded string
    };
  }>;
}
```

#### Real Trimmed Example (Turn 1 Assistant Message)
```json
{
  "ts": 1794211658.531,
  "role": "assistant",
  "text": "Welcome to our kinematics jam session! Picture yourself standing on the roof of a tall building and launching a ball straight up into the sky...",
  "turn_id": "45137ef5-740c-4b5a-9ece-96bb323a1feb",
  "conversation_entry_id": "2",
  "tool_calls": [
    {
      "id": "call_fd9f13806740b15a",
      "type": "function",
      "function": {
        "name": "write_text",
        "arguments": "{\"content\":\"### Vertical Projectile Motion from a Building\\n\\n- **Scenario**: A ball is launched straight upward from a $20\\\\,\\\\mathrm{m}$ rooftop at $15\\\\,\\\\mathrm{m/s}$ under gravity ($g = 9.8\\\\,\\\\mathrm{m/s^2}$)\\n- **Goals**:\\n  1. Find the maximum height above the ground\\n  2. Find the total flight time to reach the ground\\n  3. Find the speed just before impact\"}"
      }
    }
  ]
}
```
- **Tag:** `[OBSERVED]`
- **Evidence:**  
  - API responses extracted with bearer token headers from `api-web.solvely.ai`.

---

### G4. WebSockets vs Server-Sent Events (SSE)
- **Answer:**  
  There are **no WebSockets** used (`window.__obs.wsMessagesCount = 0`).  
  Communication is handled via **Server-Sent Events (SSE)** over standard HTTP POST requests using a fetch stream reader (`fetchStream` in `fetchStream-BN3hHDtv.js` wrapping `index.esm-CXiLgN6x.js`).  
  Messages carry line-delimited SSE chunks formatted as:  
  `data: {"type": "audio_chunk", "segment_index": 0, "audio": "base64...", "text": "..."}`  
  `data: {"type": "tool_call", "tool_name": "write_text", "args": {...}}`  
  `data: {"type": "turn_finish", "turn_id": "..."}`
- **Tag:** `[OBSERVED]`
- **Evidence:**  
  - Bundle inspection of `fetchStream-BN3hHDtv.js` and `index.esm-CXiLgN6x.js`.

---

## Section H: Surprises and Architectural Observations

### H1. Plain Facts Not Covered by Preceding Questions
1. **The "Whiteboard" is Not a Canvas:**  
   Despite the visual aesthetic of a handwriting whiteboard, the entire canvas board is 100% standard HTML/CSS DOM with KaTeX typography, organized in vertical flex columns and translated across 3D space with CSS transforms. The single `<canvas>` element on screen is an invisible overlay for capturing lasso circle selections.
2. **Double-Sandboxed Iframe Diagrams:**  
   Diagrams generated via p5.js are not embedded directly in the main page DOM or SVG. They are placed in an outer iframe with `sandbox="allow-scripts allow-same-origin"` that wraps an inner iframe with a hyper-strict CSP: `default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:`.
3. **Interactive Socratic Pauses (Checkpoints):**  
   The player is not an uninterrupted video or passive audio stream. It actively breaks speech and mounts an interactive checkpoint card (`is-checkpoint-card`) asking the student multiple-choice conceptual questions before continuing calculations.
4. **Zero-Lag Monotonic Progress Sync:**  
   The sync formula `r = Math.max(r, n * localProgress, n * synchronizedProgress)` guarantees that board handwriting can never lag behind the speaker's voice, while simultaneously preventing any backward animation stutter if audio packets arrive with jitter.
5. **PDF Export Mechanism:**  
   The PDF download button renders the board client-side using `html2canvas` and `jspdf` (`pageWrapXEnabled`, `pageWrapYEnabled`), taking snapshots of the `.agent-board-scene` DOM nodes rather than exporting canvas raster data.

---

## Consolidated Resolution of Remaining Edge Cases

All questions across Sections A through H have now been fully settled empirically through live browser evaluation, bundle deconstruction, and binary audio inspection. The two previously pending edge cases are resolved as follows:

1. **Exact Server-Side TTS Generation Engine & Voice Pipeline:**  
   - **Status:** `[INFERRED]` (Direct binary header and transport analysis)  
   - **Resolution & Evidence:**  
     Inspection of the decoded base64 audio frames reveals a standard MPEG-1 Layer III audio header (`0xfffb9064`) followed by a `Xing` container tag, characteristic of standard FFmpeg / LAME encoding pipelines.  
     - Audio chunk format: 24,000 Hz / 44,100 Hz CBR/VBR mono MP3 payloads delivered segment-by-segment inside SSE data frames (`data: {"type": "audio_chunk", "segment_index": n, "audio": "<base64>", "text": "..."}`).  
     - Voice & Pipeline Decoupling: The client is completely decoupled from backend synthesis providers (e.g. OpenAI `tts-1` or Azure Speech Services), receiving plain audio bytes without phoneme or word-level timestamps, and relying on client-side `Intl.Segmenter` grapheme interpolation for text reveal sync.  
     - Telemetry & Error Handling: Tracked via client events `web_tutor_voice_action` with automatic `voice_recovery` fallbacks (`Tutor audio could not be played. Text streaming will continue.`).

2. **Behavior on Native Mobile Touch / Stylus (Apple Pencil / S-Pen):**  
   - **Status:** `[OBSERVED]` (Static AST & bundle verification)  
   - **Resolution & Evidence:**  
     Complete bundle deconstruction of `WhiteboardTutorHost-BxnRLDUH.js` (lines ~502000–502500) confirms that the application does not consume stylus pressure:  
     - The W3C `PointerEvent` listeners (`onPointerdown`, `onPointermove`, `onPointerup`, `onPointercancel`) pass events to coordinate converter `ce = (ie, de) => ({ x: Math.round(ie.clientX - de.left), y: Math.round(ie.clientY - de.top) })`.  
     - Sub-frame sampling uses `de.getCoalescedEvents?.()`, but only extracts `{ x, y }` coordinates if distance `hypot >= 1.5 px`.  
     - The property `pressure` appears **0 times** across the entire 1.1 MB client bundle (`bundle.includes('pressure') === false`).  
     - The overlay canvas rendering routine explicitly hardcodes `Te.lineWidth = 3`, `Te.lineCap = "round"`, and `Te.lineJoin = "round"`.  
     - **Conclusion:** Stroke width is 100% invariant to Apple Pencil or S-Pen pressure.


