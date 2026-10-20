# Graph Report - solvely clone  (2026-10-20)

## Corpus Check
- Corpus is ~19,949 words - fits in a single context window. You may not need a graph.

## Summary
- 205 nodes · 344 edges · 13 communities (9 shown, 4 thin omitted)
- Extraction: 94% EXTRACTED · 6% INFERRED · 0% AMBIGUOUS · INFERRED: 21 edges (avg confidence: 0.86)
- Token cost: 68,812 input · 0 output

## Community Hubs (Navigation)
- Animated Whiteboard Player
- NPM Dependencies
- LLM API Routes
- Solve Page UI
- Homepage & Layout
- TypeScript Config
- Solvely Research & Product
- PDF Section Design
- Lesson Generation & Parsing
- Clip Fetching (planned)

## God Nodes (most connected - your core abstractions)
1. `compilerOptions` - 16 edges
2. `Solver()` - 12 edges
3. `Player()` - 11 edges
4. `parseBoardScript()` - 11 edges
5. `PDF Section Design Spec` - 9 edges
6. `Board()` - 8 edges
7. `react` - 8 edges
8. `generateLesson()` - 7 edges
9. `parseSolveRequest()` - 6 edges
10. `parseLessonRequest()` - 6 edges

## Surprising Connections (you probably didn't know these)
- `AskBar` --semantically_similar_to--> `Solver()`  [INFERRED] [semantically similar]
  docs/superpowers/plans/2026-10-20-pdf-section.md → app/solve/Solver.tsx
- `Board()` --implements--> `Board Script JSON Format`  [INFERRED]
  app/board/Board.tsx → ROADMAP.md
- `PdfStudio` --references--> `Player()`  [INFERRED]
  docs/superpowers/plans/2026-10-20-pdf-section.md → app/board/Player.tsx
- `Solver()` --implements--> `Proposed Architecture (Next.js + /api/solve)`  [INFERRED]
  app/solve/Solver.tsx → FINDINGS.md
- `parseBoardScript()` --implements--> `Board Script JSON Format`  [INFERRED]
  lib/board.ts → ROADMAP.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **PDF ask -> locate -> lesson -> synced narrated board** — app_pdf_askbar_askbar, app_api_locate_route, lib_prompts_lessonsystem, lib_clips, lib_sync_shapedelays, app_board_player_player, app_board_board_board [INFERRED 0.85]
- **Watch mode trigger-read-judge-act loop** — roadmap_watch_mode, roadmap_student_ink_canvas, readme_gemini_flash, readme_gnani_evon, roadmap_hint_ladder [EXTRACTED 1.00]

## Communities (13 total, 4 thin omitted)

### Community 0 - "Animated Whiteboard Player"
Cohesion: 0.11
Nodes (26): Board(), cost(), ICON_PATHS, Shape(), stepSeconds(), Typed(), BoardPage(), DEMOS (+18 more)

### Community 1 - "NPM Dependencies"
Cohesion: 0.08
Nodes (25): dependencies, framer-motion, gsap, katex, next, react, react-dom, devDependencies (+17 more)

### Community 2 - "LLM API Routes"
Cohesion: 0.14
Nodes (18): POST(), /api/locate route, POST(), readPhoto(), Question Locating via Gemini Page Image, geminiText(), llmChat(), llmText() (+10 more)

### Community 3 - "Solve Page UI"
Cohesion: 0.14
Nodes (11): metadata, SolvePage(), EXAMPLES, Solver(), onPaste(), pickImage(), toggleMic(), esc() (+3 more)

### Community 4 - "Homepage & Layout"
Cohesion: 0.15
Nodes (13): Hero(), metadata, RootLayout(), Nav(), TABS, Home(), SUBJECTS, WHY (+5 more)

### Community 5 - "TypeScript Config"
Cohesion: 0.11
Nodes (18): compilerOptions, allowImportingTsExtensions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib (+10 more)

### Community 6 - "Solvely Research & Product"
Cohesion: 0.13
Nodes (16): Reel-Style Animation Bar (studywith.karen, rosacodes), Inferred Nuxt 3 SSR/SSG Frontend, rea-agents 6.7.0 (REA CLI), SignInterceptor MD5 Request Signing, Solvely 3.0.4 APK Static Analysis, Solvely.ai Public Web App Analysis (REA), Uptodown APK (not Solvely), Google Gemini Flash (+8 more)

### Community 7 - "PDF Section Design"
Cohesion: 0.15
Nodes (16): Layout C: Shifts When You Ask, PDF + Board Side-by-Side Layout Options (A/B/C), PDF Layout Mockup with Animated Board Demo, Layout Settled: PDF Left, Board Right, AskBar, PdfPane, PdfStudio, PDF Section Implementation Plan (+8 more)

### Community 8 - "Lesson Generation & Parsing"
Cohesion: 0.23
Nodes (11): parseBoardScript(), extractJson(), FALLBACKS, generateLesson(), good, req, tryParse(), LANG_NAME (+3 more)

## Knowledge Gaps
- **12 isolated node(s):** `react-dom`, `@types/node`, `@types/react`, `@types/react-dom`, `typescript` (+7 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 79 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `Homepage & Layout` to `Animated Whiteboard Player`, `NPM Dependencies`, `Solve Page UI`?**
  _High betweenness centrality (0.191) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `Solver()` (e.g. with `AskBar` and `Proposed Architecture (Next.js + /api/solve)`) actually correct?**
  _`Solver()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `react-dom`, `@types/node`, `@types/react` to the rest of the system?**
  _12 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Animated Whiteboard Player` be split into smaller, more focused modules?**
  _Cohesion score 0.10756302521008404 - nodes in this community are weakly interconnected._
- **Why does `Solver()` connect `Solve Page UI` to `Solvely Research & Product`, `PDF Section Design`?**
  _High betweenness centrality (0.090) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `PDF Section Design Spec` (e.g. with `PDF Section Implementation Plan` and `Layout C: Shifts When You Ask`) actually correct?**
  _`PDF Section Design Spec` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Should `NPM Dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.07692307692307693 - nodes in this community are weakly interconnected._