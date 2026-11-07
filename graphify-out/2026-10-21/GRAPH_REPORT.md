# Graph Report - solvely clone  (2026-10-21)

## Corpus Check
- 58 files · ~26,285 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 10 file(s) not represented in the graph (top: (none) 5, .example 1, .pid 1)

## Summary
- 259 nodes · 483 edges · 15 communities (11 shown, 4 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 16 edges (avg confidence: 0.87)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `8a9558f0`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Animated Whiteboard Player
- NPM Dependencies
- solve/route.ts
- Solve Page UI
- PdfStudio.tsx
- TypeScript Config
- dependencies
- lesson.ts
- PDF Section Design Spec
- Player.tsx
- CLAUDE.md
- Solvely.ai Public Web App Analysis (REA)

## God Nodes (most connected - your core abstractions)
1. `compilerOptions` - 16 edges
2. `Player()` - 14 edges
3. `react` - 12 edges
4. `Solver()` - 12 edges
5. `PdfStudio()` - 11 edges
6. `parseBoardScript()` - 11 edges
7. `Board()` - 10 edges
8. `PDF Section Design Spec` - 9 edges
9. `generateLesson()` - 8 edges
10. `encodeWav()` - 8 edges

## Surprising Connections (you probably didn't know these)
- `AskBar()` --implements--> `Free-Text Narration Style`  [INFERRED]
  app/pdf/AskBar.tsx → docs/superpowers/specs/2026-10-20-pdf-section-design.md
- `PdfStudio()` --implements--> `Layout C: Shifts When You Ask`  [INFERRED]
  app/pdf/PdfStudio.tsx → .superpowers/brainstorm/1208-1792479866/content/pdf-layout-horizontal.html
- `Board()` --implements--> `Board Script JSON Format`  [INFERRED]
  app/board/Board.tsx → ROADMAP.md
- `Solver()` --implements--> `Proposed Architecture (Next.js + /api/solve)`  [INFERRED]
  app/solve/Solver.tsx → FINDINGS.md
- `parseBoardScript()` --implements--> `Board Script JSON Format`  [INFERRED]
  lib/board.ts → ROADMAP.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Watch mode trigger-read-judge-act loop** — roadmap_watch_mode, roadmap_student_ink_canvas, readme_gemini_flash, readme_gnani_evon, roadmap_hint_ladder [EXTRACTED 1.00]
- **PDF ask -> locate -> lesson -> synced narrated board** — app_pdf_askbar_askbar, app_api_locate_route, lib_prompts_lessonsystem, lib_clips, lib_sync_shapedelays, app_board_player_player, app_board_board_board [INFERRED 0.85]

## Communities (15 total, 4 thin omitted)

### Community 0 - "Animated Whiteboard Player"
Cohesion: 0.13
Nodes (24): Bleed(), Board(), cost(), ICON_END, ICON_PATHS, pathEnd(), Shape(), stepSeconds() (+16 more)

### Community 1 - "NPM Dependencies"
Cohesion: 0.07
Nodes (31): Hero(), metadata, RootLayout(), Nav(), TABS, Home(), SUBJECTS, WHY (+23 more)

### Community 2 - "solve/route.ts"
Cohesion: 0.11
Nodes (23): POST(), PROMPT(), POST(), geminiText(), extractJson(), good, req, clamp01() (+15 more)

### Community 3 - "Solve Page UI"
Cohesion: 0.12
Nodes (18): AskBar(), toggleMic(), Lang, LANG_LABEL, Props, STYLES, metadata, SolvePage() (+10 more)

### Community 4 - "PdfStudio.tsx"
Cohesion: 0.15
Nodes (13): metadata, PdfPage(), PdfPane(), Props, Box, Doubt, failure(), PdfStudio() (+5 more)

### Community 5 - "TypeScript Config"
Cohesion: 0.11
Nodes (18): compilerOptions, allowImportingTsExtensions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib (+10 more)

### Community 6 - "dependencies"
Cohesion: 0.25
Nodes (8): dependencies, framer-motion, gsap, katex, next, pdfjs-dist, react, react-dom

### Community 7 - "lesson.ts"
Cohesion: 0.20
Nodes (13): POST(), ICONS, parseBoardScript(), doubtMessage(), FALLBACKS, generateLesson(), tryParse(), llmChat() (+5 more)

### Community 8 - "PDF Section Design Spec"
Cohesion: 0.11
Nodes (23): Layout C: Shifts When You Ask, PDF + Board Side-by-Side Layout Options (A/B/C), PDF Layout Mockup with Animated Board Demo, Layout Settled: PDF Left, Board Right, PDF Section Implementation Plan, Free-Text Narration Style, Per-PDF IndexedDB Lesson Storage, PDF Section Design Spec (+15 more)

### Community 12 - "Player.tsx"
Cohesion: 0.18
Nodes (11): BoardPage(), DEMOS, metadata, Player(), Props, speak(), Teach(), BoardScript (+3 more)

### Community 14 - "Solvely.ai Public Web App Analysis (REA)"
Cohesion: 0.29
Nodes (6): Inferred Nuxt 3 SSR/SSG Frontend, rea-agents 6.7.0 (REA CLI), SignInterceptor MD5 Request Signing, Solvely 3.0.4 APK Static Analysis, Solvely.ai Public Web App Analysis (REA), Uptodown APK (not Solvely)

## Knowledge Gaps
- **11 isolated node(s):** `react-dom`, `@types/node`, `@types/react`, `@types/react-dom`, `typescript` (+6 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 96 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `NPM Dependencies` to `Animated Whiteboard Player`, `Solve Page UI`, `Player.tsx`, `PdfStudio.tsx`?**
  _High betweenness centrality (0.185) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `Solver()` (e.g. with `AskBar()` and `Proposed Architecture (Next.js + /api/solve)`) actually correct?**
  _`Solver()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `react-dom`, `@types/node`, `@types/react` to the rest of the system?**
  _11 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Animated Whiteboard Player` be split into smaller, more focused modules?**
  _Cohesion score 0.12903225806451613 - nodes in this community are weakly interconnected._
- **Why does `Solver()` connect `Solve Page UI` to `Solvely.ai Public Web App Analysis (REA)`?**
  _High betweenness centrality (0.067) - this node is a cross-community bridge._
- **Should `NPM Dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.06882591093117409 - nodes in this community are weakly interconnected._
- **Why does `AskBar()` connect `Solve Page UI` to `PDF Section Design Spec`, `PdfStudio.tsx`?**
  _High betweenness centrality (0.048) - this node is a cross-community bridge._