import { test } from "node:test";
import assert from "node:assert/strict";
import { compileAnchors } from "./anchorCompiler.ts";
import type { ChoreographerCommand } from "../manifest.ts";
import type { SpeechMark } from "../tts/provider.ts";

const mockMarks: SpeechMark[] = [
  { timeMs: 200, type: "word", value: "The", startChar: 0, endChar: 3 },
  { timeMs: 500, type: "word", value: "nucleus", startChar: 4, endChar: 11 },
  { timeMs: 1200, type: "word", value: "controls", startChar: 12, endChar: 20 },
  { timeMs: 1800, type: "word", value: "everything", startChar: 21, endChar: 31 },
];

test("compileAnchors resolves anchor to word start with negative offset", () => {
  const cmds: ChoreographerCommand[] = [
    {
      id: "c1",
      action: "DRAW",
      anchor: { wordIndex: 1, offsetMs: -150 }, // nucleus at 500ms -> 350ms
      semanticObject: { type: "circle", size: "md", zone: "center" },
      color: "purple",
    },
  ];

  const timings = compileAnchors(cmds, mockMarks, 2500);
  const t1 = timings.get("c1");
  assert.ok(t1);
  assert.equal(t1.startMs, 350);
  assert.ok(t1.durationMs >= 300);
});

test("compileAnchors enforces 300ms minimum duration even when anchors land close together", () => {
  const cmds: ChoreographerCommand[] = [
    {
      id: "c1",
      action: "DRAW",
      anchor: { wordIndex: 0, offsetMs: 0 }, // 200ms
      semanticObject: { type: "circle", size: "sm", zone: "center" },
      color: "ink",
    },
    {
      id: "c2",
      action: "DRAW",
      anchor: { wordIndex: 0, offsetMs: 100 }, // 300ms (gap is only 100ms)
      semanticObject: { type: "label", labelKey: "lbl" },
      color: "ink",
    },
  ];

  const timings = compileAnchors(cmds, mockMarks, 2500);
  const t1 = timings.get("c1")!;
  const t2 = timings.get("c2")!;

  assert.equal(t1.startMs, 200);
  assert.equal(t2.startMs, 300);
  // Both start times kept, t1 shortened to 300ms minimum duration, t2 has >= 300ms
  assert.equal(t1.durationMs, 300);
  assert.ok(t2.durationMs >= 300);
});

test("compileAnchors clamps negative startMs to 0", () => {
  const cmds: ChoreographerCommand[] = [
    {
      id: "c1",
      action: "DRAW",
      anchor: { wordIndex: 0, offsetMs: -500 }, // 200 - 500 = -300 -> clamped to 0
      semanticObject: { type: "circle", size: "sm", zone: "center" },
      color: "ink",
    },
  ];

  const timings = compileAnchors(cmds, mockMarks, 2500);
  assert.equal(timings.get("c1")!.startMs, 0);
});
