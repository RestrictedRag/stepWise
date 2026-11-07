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
    {
      id: "elem_erase",
      action: "ERASE",
      startMs: 2000,
      durationMs: 400,
      targetIds: ["elem_circle"],
      technique: "fade",
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
  assert.equal(stateMid0.erasedElementIds.has("elem_circle"), false);

  // At t = 1500ms: circle draw completed, before erase at 2000ms
  const stateDoneCircle = engine.computeStateAt(1500);
  assert.ok(stateDoneCircle.completedCommandIds.has("elem_circle"));
  assert.equal(stateDoneCircle.erasedElementIds.has("elem_circle"), false);

  // In step 1 (t = 4500ms): global time 4500ms -> step 1 local time 1500ms
  const stateMid1 = engine.computeStateAt(4500);
  assert.equal(stateMid1.currentStepIndex, 1);
  assert.equal(stateMid1.stepTimeMs, 1500);
  assert.ok(stateMid1.completedCommandIds.has("elem_rect"));

  engine.destroy();
});

test("GlobalPlaybackEngine guarantees deterministic state on bidirectional scrub (seek forward, backward, forward)", () => {
  const engine = new GlobalPlaybackEngine([mockStep0, mockStep1]);

  // Scrub 1: Seek forward to 2500ms (circle is erased)
  engine.startScrub();
  engine.scrubToGlobalMs(2500);
  const stateForward1 = engine.computeStateAt(2500);
  assert.ok(stateForward1.erasedElementIds.has("elem_circle"));

  // Scrub 2: Seek backward to 1500ms (before erase was triggered)
  engine.scrubToGlobalMs(1500);
  const stateBackward = engine.computeStateAt(1500);
  assert.equal(stateBackward.erasedElementIds.has("elem_circle"), false);
  assert.ok(stateBackward.completedCommandIds.has("elem_circle"));

  // Scrub 3: Seek forward again to 2500ms
  engine.scrubToGlobalMs(2500);
  const stateForward2 = engine.computeStateAt(2500);
  // DOM / active state must be strictly equal to fresh seek at 2500ms
  assert.deepEqual(Array.from(stateForward1.completedCommandIds), Array.from(stateForward2.completedCommandIds));
  assert.deepEqual(Array.from(stateForward1.erasedElementIds), Array.from(stateForward2.erasedElementIds));

  engine.endScrub(false);
  engine.destroy();
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
