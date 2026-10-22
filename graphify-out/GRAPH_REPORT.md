# Graph Report - solvely clone  (2026-10-22)

## Corpus Check
- 62 files · ~28,734 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 10 file(s) not represented in the graph (top: (none) 5, .example 1, .pid 1)

## Summary
- 290 nodes · 575 edges · 14 communities (11 shown, 3 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 16 edges (avg confidence: 0.87)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `544fb05b`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Animated Whiteboard Player
- NPM Dependencies
- solve/route.ts
- Solve Page UI
- PdfStudio.tsx
- TypeScript Config
- react
- lesson.ts
- PDF Section Design Spec
- PdfPane.tsx
- Player.tsx
- CLAUDE.md

## God Nodes (most connected - your core abstractions)
1. `PdfStudio()` - 27 edges
2. `compilerOptions` - 16 edges
3. `Player()` - 13 edges
4. `react` - 13 edges
5. `Solver()` - 11 edges
6. `Board()` - 11 edges
7. `parseBoardScript()` - 11 edges
8. `tx()` - 10 edges
9. `PDF Section Design Spec` - 9 edges
10. `generateLesson()` - 8 edges

## Surprising Connections (you probably didn't know these)
- `AskBar()` --implements--> `Free-Text Narration Style`  [INFERRED]
  app/pdf/AskBar.tsx → docs/superpowers/specs/2026-10-20-pdf-section-design.md
- `PdfStudio()` --implements--> `Layout C: Shifts When You Ask`  [INFERRED]
  app/pdf/PdfStudio.tsx → .superpowers/brainstorm/1208-1792479866/content/pdf-layout-horizontal.html
- `Solver()` --implements--> `Proposed Architecture (Next.js + /api/solve)`  [INFERRED]
  app/solve/Solver.tsx → FINDINGS.md
- `Board()` --implements--> `Board Script JSON Format`  [INFERRED]
  app/board/Board.tsx → ROADMAP.md
- `parseBoardScript()` --implements--> `Board Script JSON Format`  [INFERRED]
  lib/board.ts → ROADMAP.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Watch mode trigger-read-judge-act loop** — roadmap_watch_mode, roadmap_student_ink_canvas, readme_gemini_flash, readme_gnani_evon, roadmap_hint_ladder [EXTRACTED 1.00]
- **PDF ask -> locate -> lesson -> synced narrated board** — app_pdf_askbar_askbar, app_api_locate_route, lib_prompts_lessonsystem, lib_clips, lib_sync_shapedelays, app_board_player_player, app_board_board_board [INFERRED 0.85]

## Communities (14 total, 3 thin omitted)

### Community 0 - "Animated Whiteboard Player"
Cohesion: 0.13
Nodes (24): Bleed(), Board(), cost(), ICON_END, ICON_PATHS, pathEnd(), Shape(), Typed() (+16 more)

### Community 1 - "NPM Dependencies"
Cohesion: 0.07
Nodes (26): dependencies, framer-motion, gsap, katex, next, pdfjs-dist, react, react-dom (+18 more)

### Community 2 - "solve/route.ts"
Cohesion: 0.12
Nodes (19): POST(), PROMPT(), POST(), LANG_CODE, geminiText(), extractJson(), llmChat(), clamp01() (+11 more)

### Community 3 - "Solve Page UI"
Cohesion: 0.11
Nodes (20): AskBar(), toggleMic(), Lang, LANG_LABEL, Props, STYLES, metadata, SolvePage() (+12 more)

### Community 4 - "PdfStudio.tsx"
Cohesion: 0.14
Nodes (31): metadata, PdfPage(), Box, Doubt, failure(), PdfStudio(), ask(), askDoubt() (+23 more)

### Community 5 - "TypeScript Config"
Cohesion: 0.11
Nodes (18): compilerOptions, allowImportingTsExtensions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib (+10 more)

### Community 6 - "react"
Cohesion: 0.13
Nodes (14): Hero(), metadata, RootLayout(), EXAMPLES, Home(), SUBJECTS, WHY, ScrollReveal() (+6 more)

### Community 7 - "lesson.ts"
Cohesion: 0.11
Nodes (21): POST(), PDF Section Implementation Plan, parseBoardScript(), doubtMessage(), FALLBACKS, generateLesson(), good, req (+13 more)

### Community 8 - "PDF Section Design Spec"
Cohesion: 0.08
Nodes (27): Layout C: Shifts When You Ask, PDF + Board Side-by-Side Layout Options (A/B/C), PDF Layout Mockup with Animated Board Demo, Layout Settled: PDF Left, Board Right, Free-Text Narration Style, Per-PDF IndexedDB Lesson Storage, PDF Section Design Spec, Question Locating via Gemini Page Image (+19 more)

### Community 11 - "PdfPane.tsx"
Cohesion: 0.36
Nodes (4): PdfPane(), Props, renderScale(), pdfjs-dist

### Community 12 - "Player.tsx"
Cohesion: 0.18
Nodes (11): stepSeconds(), BoardPage(), DEMOS, metadata, Player(), Props, speak(), Teach() (+3 more)

## Knowledge Gaps
- **10 isolated node(s):** `react-dom`, `@types/node`, `@types/react`, `@types/react-dom`, `typescript` (+5 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 100 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `react` to `Animated Whiteboard Player`, `NPM Dependencies`, `Solve Page UI`, `PdfStudio.tsx`, `PdfPane.tsx`, `Player.tsx`?**
  _High betweenness centrality (0.179) - this node is a cross-community bridge._
- **What connects `react-dom`, `@types/node`, `@types/react` to the rest of the system?**
  _10 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Animated Whiteboard Player` be split into smaller, more focused modules?**
  _Cohesion score 0.12903225806451613 - nodes in this community are weakly interconnected._
- **Why does `PdfStudio()` connect `PdfStudio.tsx` to `PDF Section Design Spec`, `PdfPane.tsx`, `Solve Page UI`, `Player.tsx`?**
  _High betweenness centrality (0.084) - this node is a cross-community bridge._
- **Should `NPM Dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.07407407407407407 - nodes in this community are weakly interconnected._
- **Why does `Solver()` connect `Solve Page UI` to `PDF Section Design Spec`?**
  _High betweenness centrality (0.064) - this node is a cross-community bridge._
- **Should `solve/route.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.12413793103448276 - nodes in this community are weakly interconnected._