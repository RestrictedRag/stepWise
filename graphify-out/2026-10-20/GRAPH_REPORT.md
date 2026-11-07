# Graph Report - solvely clone  (2026-10-20)

## Corpus Check
- 50 files · ~22,252 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 10 file(s) not represented in the graph (top: (none) 5, .example 1, .pid 1)

## Summary
- 222 nodes · 407 edges · 14 communities (10 shown, 4 thin omitted)
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 19 edges (avg confidence: 0.87)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `126ca7c7`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Animated Whiteboard Player
- NPM Dependencies
- solve/route.ts
- Solve Page UI
- app/page.tsx
- TypeScript Config
- StepWise Board Roadmap
- lesson.ts
- board/page.tsx
- Clip Fetching (planned)
- PdfStudio

## God Nodes (most connected - your core abstractions)
1. `compilerOptions` - 16 edges
2. `Solver()` - 12 edges
3. `Board()` - 11 edges
4. `Player()` - 11 edges
5. `parseBoardScript()` - 11 edges
6. `react` - 9 edges
7. `PDF Section Design Spec` - 9 edges
8. `parseSolveRequest()` - 7 edges
9. `generateLesson()` - 7 edges
10. `parseLocate()` - 6 edges

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
- **Watch mode trigger-read-judge-act loop** — roadmap_watch_mode, roadmap_student_ink_canvas, readme_gemini_flash, readme_gnani_evon, roadmap_hint_ladder [EXTRACTED 1.00]
- **PDF ask -> locate -> lesson -> synced narrated board** — app_pdf_askbar_askbar, app_api_locate_route, lib_prompts_lessonsystem, lib_clips, lib_sync_shapedelays, app_board_player_player, app_board_board_board [INFERRED 0.85]

## Communities (14 total, 4 thin omitted)

### Community 0 - "Animated Whiteboard Player"
Cohesion: 0.14
Nodes (25): Bleed(), Board(), cost(), ICON_PATHS, pathEnd(), Shape(), stepSeconds(), Typed() (+17 more)

### Community 1 - "NPM Dependencies"
Cohesion: 0.06
Nodes (31): metadata, RootLayout(), Nav(), TABS, dependencies, framer-motion, gsap, katex (+23 more)

### Community 2 - "solve/route.ts"
Cohesion: 0.13
Nodes (19): POST(), PROMPT(), POST(), Question Locating via Gemini Page Image, BoardScript, geminiText(), clamp01(), Located (+11 more)

### Community 3 - "Solve Page UI"
Cohesion: 0.18
Nodes (11): metadata, SolvePage(), EXAMPLES, Solver(), onPaste(), pickImage(), toggleMic(), esc() (+3 more)

### Community 4 - "app/page.tsx"
Cohesion: 0.31
Nodes (6): Hero(), Home(), SUBJECTS, WHY, ScrollReveal(), gsap

### Community 5 - "TypeScript Config"
Cohesion: 0.11
Nodes (18): compilerOptions, allowImportingTsExtensions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib (+10 more)

### Community 6 - "StepWise Board Roadmap"
Cohesion: 0.12
Nodes (17): Voice-Synced Reveals via `at` Phrase, Inferred Nuxt 3 SSR/SSG Frontend, rea-agents 6.7.0 (REA CLI), SignInterceptor MD5 Request Signing, Solvely 3.0.4 APK Static Analysis, Solvely.ai Public Web App Analysis (REA), Uptodown APK (not Solvely), Google Gemini Flash (+9 more)

### Community 7 - "lesson.ts"
Cohesion: 0.11
Nodes (22): POST(), PDF Section Implementation Plan, ICONS, parseBoardScript(), Step, extractJson(), FALLBACKS, generateLesson() (+14 more)

### Community 8 - "board/page.tsx"
Cohesion: 0.29
Nodes (4): BoardPage(), DEMOS, metadata, Teach()

### Community 13 - "PdfStudio"
Cohesion: 0.20
Nodes (11): Layout C: Shifts When You Ask, PDF + Board Side-by-Side Layout Options (A/B/C), PDF Layout Mockup with Animated Board Demo, Layout Settled: PDF Left, Board Right, AskBar, PdfPane, PdfStudio, Free-Text Narration Style (+3 more)

## Knowledge Gaps
- **12 isolated node(s):** `react-dom`, `@types/node`, `@types/react`, `@types/react-dom`, `typescript` (+7 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 81 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `Animated Whiteboard Player` to `NPM Dependencies`, `solve/route.ts`, `Solve Page UI`, `app/page.tsx`?**
  _High betweenness centrality (0.182) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `Solver()` (e.g. with `AskBar` and `Proposed Architecture (Next.js + /api/solve)`) actually correct?**
  _`Solver()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `react-dom`, `@types/node`, `@types/react` to the rest of the system?**
  _12 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Animated Whiteboard Player` be split into smaller, more focused modules?**
  _Cohesion score 0.13548387096774195 - nodes in this community are weakly interconnected._
- **Why does `Solver()` connect `Solve Page UI` to `PdfStudio`, `StepWise Board Roadmap`?**
  _High betweenness centrality (0.081) - this node is a cross-community bridge._
- **Should `NPM Dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.06218487394957983 - nodes in this community are weakly interconnected._
- **Why does `PDF Section Design Spec` connect `Animated Whiteboard Player` to `solve/route.ts`, `PdfStudio`, `StepWise Board Roadmap`, `lesson.ts`?**
  _High betweenness centrality (0.058) - this node is a cross-community bridge._