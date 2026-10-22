# Graph Report - solvely clone  (2026-10-22)

## Corpus Check
- 61 files · ~28,526 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 10 file(s) not represented in the graph (top: (none) 5, .example 1, .pid 1)

## Summary
- 286 nodes · 573 edges · 13 communities (9 shown, 4 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 15 edges (avg confidence: 0.87)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `dd11a08f`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Animated Whiteboard Player
- NPM Dependencies
- solve/route.ts
- Solve Page UI
- PdfStudio.tsx
- TypeScript Config
- Player.tsx
- lesson.ts
- PDF Section Design Spec
- PdfPane.tsx
- CLAUDE.md

## God Nodes (most connected - your core abstractions)
1. `PdfStudio()` - 27 edges
2. `compilerOptions` - 16 edges
3. `Player()` - 15 edges
4. `Solver()` - 12 edges
5. `react` - 12 edges
6. `Board()` - 11 edges
7. `parseBoardScript()` - 11 edges
8. `tx()` - 10 edges
9. `PDF Section Design Spec` - 9 edges
10. `generateLesson()` - 8 edges

## Surprising Connections (you probably didn't know these)
- `Board()` --implements--> `Board Script JSON Format`  [INFERRED]
  app/board/Board.tsx → ROADMAP.md
- `AskBar()` --implements--> `Free-Text Narration Style`  [INFERRED]
  app/pdf/AskBar.tsx → docs/superpowers/specs/2026-10-20-pdf-section-design.md
- `PdfStudio()` --implements--> `Layout C: Shifts When You Ask`  [INFERRED]
  app/pdf/PdfStudio.tsx → .superpowers/brainstorm/1208-1792479866/content/pdf-layout-horizontal.html
- `Solver()` --implements--> `Proposed Architecture (Next.js + /api/solve)`  [INFERRED]
  app/solve/Solver.tsx → FINDINGS.md
- `parseBoardScript()` --implements--> `Board Script JSON Format`  [INFERRED]
  lib/board.ts → ROADMAP.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Watch mode trigger-read-judge-act loop** — roadmap_watch_mode, roadmap_student_ink_canvas, readme_gemini_flash, readme_gnani_evon, roadmap_hint_ladder [EXTRACTED 1.00]
- **PDF ask -> locate -> lesson -> synced narrated board** — app_pdf_askbar_askbar, app_api_locate_route, lib_prompts_lessonsystem, lib_clips, lib_sync_shapedelays, app_board_player_player, app_board_board_board [INFERRED 0.85]

## Communities (13 total, 4 thin omitted)

### Community 0 - "Animated Whiteboard Player"
Cohesion: 0.13
Nodes (24): Bleed(), Board(), cost(), ICON_END, ICON_PATHS, pathEnd(), Shape(), Typed() (+16 more)

### Community 1 - "NPM Dependencies"
Cohesion: 0.07
Nodes (28): dependencies, framer-motion, gsap, katex, next, pdfjs-dist, react, react-dom (+20 more)

### Community 2 - "solve/route.ts"
Cohesion: 0.11
Nodes (22): POST(), PROMPT(), POST(), LANG_CODE, geminiText(), llmChat(), clamp01(), Located (+14 more)

### Community 3 - "Solve Page UI"
Cohesion: 0.12
Nodes (18): AskBar(), toggleMic(), Lang, LANG_LABEL, Props, STYLES, metadata, SolvePage() (+10 more)

### Community 4 - "PdfStudio.tsx"
Cohesion: 0.14
Nodes (32): metadata, PdfPage(), PdfPane(), Box, Doubt, failure(), PdfStudio(), ask() (+24 more)

### Community 5 - "TypeScript Config"
Cohesion: 0.11
Nodes (18): compilerOptions, allowImportingTsExtensions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib (+10 more)

### Community 6 - "Player.tsx"
Cohesion: 0.09
Nodes (25): stepSeconds(), BoardPage(), DEMOS, metadata, Player(), Props, speak(), Teach() (+17 more)

### Community 7 - "lesson.ts"
Cohesion: 0.15
Nodes (15): POST(), parseBoardScript(), doubtMessage(), extractJson(), FALLBACKS, generateLesson(), good, req (+7 more)

### Community 8 - "PDF Section Design Spec"
Cohesion: 0.08
Nodes (28): Layout C: Shifts When You Ask, PDF + Board Side-by-Side Layout Options (A/B/C), PDF Layout Mockup with Animated Board Demo, Layout Settled: PDF Left, Board Right, PDF Section Implementation Plan, Free-Text Narration Style, Per-PDF IndexedDB Lesson Storage, PDF Section Design Spec (+20 more)

## Knowledge Gaps
- **10 isolated node(s):** `react-dom`, `@types/node`, `@types/react`, `@types/react-dom`, `typescript` (+5 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 98 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `Player.tsx` to `Animated Whiteboard Player`, `NPM Dependencies`, `Solve Page UI`, `PdfStudio.tsx`, `PdfPane.tsx`?**
  _High betweenness centrality (0.167) - this node is a cross-community bridge._
- **What connects `react-dom`, `@types/node`, `@types/react` to the rest of the system?**
  _10 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Animated Whiteboard Player` be split into smaller, more focused modules?**
  _Cohesion score 0.12903225806451613 - nodes in this community are weakly interconnected._
- **Why does `PdfStudio()` connect `PdfStudio.tsx` to `PDF Section Design Spec`, `Solve Page UI`, `Player.tsx`?**
  _High betweenness centrality (0.080) - this node is a cross-community bridge._
- **Should `NPM Dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.06896551724137931 - nodes in this community are weakly interconnected._
- **Why does `Solver()` connect `Solve Page UI` to `PDF Section Design Spec`?**
  _High betweenness centrality (0.065) - this node is a cross-community bridge._
- **Should `solve/route.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.11051693404634581 - nodes in this community are weakly interconnected._