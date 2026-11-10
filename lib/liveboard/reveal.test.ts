import test from "node:test";
import assert from "node:assert/strict";
import { revealCount, paceMs, pacedCount, cleanNote, boardText } from "./reveal.ts";

test("revealCount scales speech marks by realDuration / manifestDuration", () => {
  // Manifest duration = 2000ms, real audio duration = 4000ms (audio is 2x slower)
  const marks = [
    { timeMs: 500, endChar: 10 },
    { timeMs: 1000, endChar: 25 },
    { timeMs: 1500, endChar: 40 },
  ];

  // At 800ms real audio (scaled time for mark 1 is 500*2 = 1000ms): not yet reached
  assert.equal(revealCount(marks, 800, 4000, 2000), 0);

  // At 1000ms real audio: mark 1 reached (endChar = 10)
  assert.equal(revealCount(marks, 1000, 4000, 2000), 10);

  // At 2000ms real audio: mark 2 reached (endChar = 25)
  assert.equal(revealCount(marks, 2000, 4000, 2000), 25);

  // At 3000ms real audio: mark 3 reached (endChar = 40)
  assert.equal(revealCount(marks, 3000, 4000, 2000), 40);
});

test("revealCount is strictly monotonic even if audio time fluctuates", () => {
  const marks = [
    { timeMs: 100, endChar: 5 },
    { timeMs: 200, endChar: 15 },
    { timeMs: 300, endChar: 25 },
  ];

  let current = 0;
  // Progressing forward
  current = revealCount(marks, 150, 1000, 1000, current);
  assert.equal(current, 5);

  current = revealCount(marks, 250, 1000, 1000, current);
  assert.equal(current, 15);

  // Sudden time drop (jitter or seeking backwards slightly)
  const afterDrop = revealCount(marks, 120, 1000, 1000, current);
  assert.equal(afterDrop, 15); // Never decreases!

  // Reaching the end
  current = revealCount(marks, 1000, 1000, 1000, current);
  assert.equal(current, 25);
});

test("revealCount works with number arrays and word marks", () => {
  const marks = [100, 200, 300];
  assert.equal(revealCount(marks, 50, 500, 500), 0);
  assert.equal(revealCount(marks, 150, 500, 500), 1);
  assert.equal(revealCount(marks, 250, 500, 500), 2);
  assert.equal(revealCount(marks, 350, 500, 500), 3);
});

test("paceMs: 58 ms per character, clamped to 700–8000", () => {
  assert.equal(paceMs(3), 700);
  assert.equal(paceMs(20), 1160);
  assert.equal(paceMs(500), 8000);
});

test("pacedCount: own pace, voice lead, never backwards", () => {
  assert.equal(pacedCount(100, 2900), 50); // 2900 / 5800
  assert.equal(pacedCount(100, 0, 0.8), 80); // voice is ahead
  assert.equal(pacedCount(100, 100, 0, 60), 60); // keeps previous
  assert.equal(pacedCount(0, 5000), 0); // empty text
});

test("revealCount without marks uses text length, not ratio * 1000", () => {
  assert.equal(revealCount(undefined, 2900, 10000, 10000, 0, 100), 50);
  assert.equal(revealCount(undefined, 10000, 10000, 10000, 0, 100), 100);
});

test("cleanNote keeps a short note, trims it, rejects junk", () => {
  assert.equal(cleanNote("  Light + water → sugar  "), "Light + water → sugar");
  assert.equal(cleanNote(""), undefined);
  assert.equal(cleanNote("   "), undefined);
  assert.equal(cleanNote(undefined), undefined);
  assert.equal(cleanNote(42), undefined);
  assert.equal(cleanNote("x".repeat(161)), undefined);
});

test("boardText prefers the note and falls back to the transcript", () => {
  assert.equal(boardText({ transcript: "long narration", note: "Short" }), "Short");
  assert.equal(boardText({ transcript: "long narration" }), "long narration");
  assert.equal(boardText({ transcript: "long narration", note: "  " }), "long narration");
  assert.equal(boardText({}), "");
});

