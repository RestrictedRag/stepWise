## Executor rules (Solvely teaching plan)

1. Read `docs/superpowers/plans/2026-11-09-solvely-teaching-plan.md` first, all of it. Section 0 is binding.
2. Do exactly ONE task (`T<n>`) per prompt. Never start the next task on your own.
3. Touch only the files that task lists. Obey the DO-NOT-TOUCH list in section 0.
4. No new dependencies, no refactors, no renames, no "improvements". Decisions D1–D12 are final; do not redesign them.
5. Find code by the quoted snippet in the plan, not by line number. If the snippet is not found exactly, STOP and ask.
6. Your diff must match the "desired output" shape the task shows. If it cannot, STOP and say why.
7. After the task, run and paste the full output of:
   - `npx tsc --noEmit`
   - `node --test --experimental-strip-types lib/**/*.test.ts`
   - `git diff --stat`
   Then STOP and wait.
8. If anything is ambiguous, STOP and ask. Do not guess.
9. Never commit, push, or run git commands that change history unless asked.
