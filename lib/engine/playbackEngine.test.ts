import { test } from "node:test";
import assert from "node:assert/strict";
import { StepWisePlaybackEngine } from "./playbackEngine.ts";
import type { StepManifest } from "../manifest.ts";

const mockStep: StepManifest = {
  stepIndex: 0,
  speech: {
    durationMs: 4000,
    transcript: "Let's draw a nucleus, highlight it, and then erase it.",
    speechMarks: [],
  },
  commands: [
    {
      id: "elem_nucleus",
      action: "DRAW",
      targetLayer: "dynamicVector",
      startMs: 500,
      durationMs: 1000,
      shape: { type: "circle", x: 500, y: 350, r: 50 },
      style: { color: "purple", showStylus: true },
    },
    {
      id: "elem_highlight",
      action: "HIGHLIGHT",
      targetElementId: "elem_nucleus",
      startMs: 2000,
      durationMs: 1000,
      style: "pulse",
    },
    {
      id: "elem_erase",
      action: "ERASE",
      targetElementIds: ["elem_nucleus"],
      startMs: 3500,
      durationMs: 400,
      technique: "mask_wipe",
    },
  ],
};

test("StepWisePlaybackEngine initializes and evaluates state at t=0", () => {
  const engine = new StepWisePlaybackEngine(mockStep);
  const state = engine.computeStateAt(0);
  assert.equal(state.timeMs, 0);
  assert.equal(state.activeCommandIds.size, 0);
  assert.equal(state.completedCommandIds.size, 0);
  assert.equal(state.erasedElementIds.size, 0);
  assert.equal(state.highlightedElementIds.size, 0);
  engine.destroy();
});

test("StepWisePlaybackEngine activates DRAW and stylus during drawing window", () => {
  const engine = new StepWisePlaybackEngine(mockStep);
  // Nucleus draws between 500ms and 1500ms
  const state = engine.computeStateAt(1000);
  assert.ok(state.activeCommandIds.has("elem_nucleus"));
  assert.ok(state.stylusPosition);
  assert.equal(state.stylusPosition.active, true);
  engine.destroy();
});

test("StepWisePlaybackEngine activates HIGHLIGHT pulse between 2000ms and 3000ms", () => {
  const engine = new StepWisePlaybackEngine(mockStep);
  const state = engine.computeStateAt(2500);
  assert.ok(state.highlightedElementIds.has("elem_nucleus"));
  assert.ok(state.highlightedElementIds.get("elem_nucleus")!.intensity > 0);
  engine.destroy();
});

test("StepWisePlaybackEngine supports bi-directional scrubbing with instant state reconciliation", () => {
  const engine = new StepWisePlaybackEngine(mockStep);
  
  // Scrub forward to past erase (3800ms)
  engine.startScrub();
  engine.scrubToMs(3800);
  const forwardState = engine.computeStateAt(3800);
  assert.ok(forwardState.erasedElementIds.has("elem_nucleus"));

  // Scrub backwards to 1800ms (before erase)
  engine.scrubToMs(1800);
  const backwardState = engine.computeStateAt(1800);
  assert.equal(backwardState.erasedElementIds.has("elem_nucleus"), false);
  assert.ok(backwardState.completedCommandIds.has("elem_nucleus"));

  engine.endScrub(false);
  engine.destroy();
});

