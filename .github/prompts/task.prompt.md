---
description: Run exactly one task from the Solvely teaching plan, then stop
agent: agent
---
Do task ${input:task:T1} from `docs/superpowers/plans/2026-11-09-solvely-teaching-plan.md`.

Rules (binding, from AGENTS.md "Executor rules"):
- Read section 0 of the plan first. Touch only the files this task lists. Obey DO-NOT-TOUCH.
- Find code by the quoted snippet, not line number. Snippet missing → STOP and ask.
- No new deps, refactors, renames or extras. D1–D12 are final.
- The diff must match the task's "desired output" shape.
- Then run and paste: `npx tsc --noEmit`, `node --test --experimental-strip-types lib/**/*.test.ts`, `git diff --stat`.
- STOP. Do not start the next task. Do not commit.
