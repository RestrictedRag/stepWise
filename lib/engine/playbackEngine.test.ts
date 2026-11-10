import { test } from "node:test";
import assert from "node:assert/strict";
import { GlobalPlaybackEngine } from "./playbackEngine.ts";
import type { CompiledStepManifest } from "../manifest.ts";

const mockStep0: CompiledStepManifest = {
  stepIndex: 0,
  speech: {
    durationMs: 3000,
    transcript: "Step zero text.",
    timingSource: "forced_alignment",
    alignmentConfidence: 1.0,
    speechMarks: [],
  },
  commands: [
    {
      id: "elem_circle",
      action: "DRAW",
      startMs: 500,
      durationMs: 800,
      shape: { type: "circle", x: 500, y: 350, r: 80, color: "purple" },
      color: "purple",
    },
  ],
};

const stepWithOneDraw: CompiledStepManifest = {
  stepIndex: 0,
  speech: {
    durationMs: 3000,
    transcript: "Step zero text.",
    timingSource: "forced_alignment",
    alignmentConfidence: 1.0,
    speechMarks: [],
  },
  commands: [
    {
      id: "d1",
      action: "DRAW",
      startMs: 500,
      durationMs: 800,
      shape: { type: "circle", x: 500, y: 350, r: 80, color: "purple" },
      color: "purple",
    },
  ],
};

const mockStep1: CompiledStepManifest = {
  stepIndex: 1,
  speech: {
    durationMs: 4000,
    transcript: "Step one text.",
    timingSource: "forced_alignment",
    alignmentConfidence: 1.0,
    speechMarks: [],
  },
  commands: [
    {
      id: "elem_rect",
      action: "DRAW",
      startMs: 400,
      durationMs: 800,
      shape: { type: "rect", x: 400, y: 300, w: 200, h: 100, color: "blue" },
      color: "blue",
    },
  ],
};

test("GlobalPlaybackEngine calculates global timeline and step offsets across steps", () => {
  const engine = new GlobalPlaybackEngine([mockStep0, mockStep1]);
  const s0 = engine.computeStateAt(0);
  assert.equal(s0.totalDurationMs, 7000);
  assert.equal(s0.stepOffsets[0], 0);
  assert.equal(s0.stepOffsets[1], 3000);

  // In step 0 (t = 1000ms): circle is actively animating
  const stateMid0 = engine.computeStateAt(1000);
  assert.equal(stateMid0.currentStepIndex, 0);
  assert.ok(stateMid0.activeCommandIds.has("elem_circle"));

  // At t = 1500ms: circle draw completed
  const stateDoneCircle = engine.computeStateAt(1500);
  assert.ok(stateDoneCircle.completedCommandIds.has("elem_circle"));

  // In step 1 (t = 4500ms): global time 4500ms -> step 1 local time 1500ms
  const stateMid1 = engine.computeStateAt(4500);
  assert.equal(stateMid1.currentStepIndex, 1);
  assert.equal(stateMid1.stepTimeMs, 1500);
  assert.ok(stateMid1.completedCommandIds.has("elem_rect"));

  engine.destroy();
});

test("GlobalPlaybackEngine guarantees deterministic state on bidirectional scrub (seek forward, backward, forward)", () => {
  const engine = new GlobalPlaybackEngine([mockStep0, mockStep1]);

  // Scrub 1: Seek forward to 2500ms
  engine.startScrub();
  engine.scrubToGlobalMs(2500);
  const stateForward1 = engine.computeStateAt(2500);
  assert.ok(stateForward1.completedCommandIds.has("elem_circle"));

  // Scrub 2: Seek backward to 1500ms
  engine.scrubToGlobalMs(1500);
  const stateBackward = engine.computeStateAt(1500);
  assert.ok(stateBackward.completedCommandIds.has("elem_circle"));

  // Scrub 3: Seek forward again to 2500ms
  engine.scrubToGlobalMs(2500);
  const stateForward2 = engine.computeStateAt(2500);

  // Compare against a completely fresh instance that sought straight to 2500ms
  const freshEngine = new GlobalPlaybackEngine([mockStep0, mockStep1]);
  const freshState = freshEngine.computeStateAt(2500);

  assert.deepEqual(Array.from(stateForward2.completedCommandIds), Array.from(freshState.completedCommandIds));
  assert.deepEqual(Array.from(stateForward2.activeCommandIds), Array.from(freshState.activeCommandIds));
  assert.deepEqual(Array.from(stateForward2.commandProgress.entries()), Array.from(freshState.commandProgress.entries()));

  freshEngine.destroy();
  engine.endScrub(false);
  engine.destroy();
});

test("completed commands never fade or erase", () => {
  const engine = new GlobalPlaybackEngine([stepWithOneDraw]);
  const s = engine.computeStateAt(999_999);
  assert.equal(s.commandProgress.get("d1"), 1);
  assert.equal(s.eraseProgress.size, 0);
  assert.equal(s.erasedElementIds.size, 0);
});

test("progress is non-decreasing over time", () => {
  const engine = new GlobalPlaybackEngine([stepWithOneDraw]);
  let prev = -1;
  for (let t = 0; t <= 3000; t += 16) {
    const p = engine.computeStateAt(t).commandProgress.get("d1")!;
    assert.ok(p >= prev && p <= 1);
    prev = p;
  }
});

test("GlobalPlaybackEngine supports streaming stall and resume when next step arrives", () => {
  const engine = new GlobalPlaybackEngine([mockStep0]);
  assert.equal(engine.computeStateAt(0).totalDurationMs, 3000);

  // Append step 1 dynamically as stream arrives
  engine.appendStep(mockStep1);
  assert.equal(engine.computeStateAt(0).totalDurationMs, 7000);
  assert.equal(engine.computeStateAt(0).stepOffsets[1], 3000);

  engine.destroy();
});
