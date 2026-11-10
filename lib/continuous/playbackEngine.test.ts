import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { solveContinuousLayout } from "./layoutSolver.ts";
import {
  compileContinuousTimeline,
  computeContinuousStateAt,
  evaluateElementVisualAt,
} from "./playbackEngine.ts";
import type { ContinuousLesson } from "./types.ts";

test("playbackEngine: guarantees 100% deterministic state on bidirectional scrub", () => {
  const fixturePath = join(process.cwd(), "eval", "fixtures", "photosynthesis_continuous.json");
  const raw = readFileSync(fixturePath, "utf-8");
  const lesson = JSON.parse(raw) as ContinuousLesson;

  const layout = solveContinuousLayout(lesson);
  const timeline = compileContinuousTimeline(lesson, layout);

  // Sample states across various timestamps
  const timestamps = [0, 500, 1200, 3500, 6000, 9500, 14000];
  const firstPass = timestamps.map((t) => computeContinuousStateAt(timeline, t));

  // Scrub backwards
  const reversedTimestamps = [...timestamps].reverse();
  const backwardsPass = reversedTimestamps.map((t) => computeContinuousStateAt(timeline, t));

  // Scrub forwards again
  const secondPass = timestamps.map((t) => computeContinuousStateAt(timeline, t));

  // Verify firstPass equals secondPass exactly
  for (let i = 0; i < timestamps.length; i++) {
    const s1 = firstPass[i];
    const s2 = secondPass[i];

    assert.equal(s1.tMs, s2.tMs);
    assert.deepEqual(s1.camera, s2.camera, `Camera at ${s1.tMs} must be identical on scrub`);
    assert.equal(s1.elements.length, s2.elements.length, `Element count at ${s1.tMs} must match`);
    assert.equal(s1.connectors.length, s2.connectors.length, `Connector count at ${s1.tMs} must match`);

    for (let e = 0; e < s1.elements.length; e++) {
      assert.equal(s1.elements[e].id, s2.elements[e].id);
      assert.equal(s1.elements[e].opacity, s2.elements[e].opacity);
      assert.equal(s1.elements[e].drawProgress, s2.elements[e].drawProgress);
      assert.equal(s1.elements[e].state, s2.elements[e].state);
    }
  }
});

test("playbackEngine: Rule 6 automatically cascades DIM to connected arrows", () => {
  const fixturePath = join(process.cwd(), "eval", "fixtures", "photosynthesis_continuous.json");
  const raw = readFileSync(fixturePath, "utf-8");
  const lesson = JSON.parse(raw) as ContinuousLesson;

  const layout = solveContinuousLayout(lesson);
  const timeline = compileContinuousTimeline(lesson, layout);

  // In step 5, sun is DIMMED.
  // Find timestamp of DIM op on sun
  const dimOp = timeline.timedOps.find(
    (top) => top.op.op === "DIM" && top.op.targetIds.includes("sun")
  );
  assert.ok(dimOp, "Expected DIM op on sun");

  // Before DIM: sun and conn_sun_leaf should be opacity 1.0
  const stateBefore = computeContinuousStateAt(timeline, dimOp.startMs - 50);
  const sunBefore = stateBefore.elements.find((e) => e.id === "sun");
  const connBefore = stateBefore.connectors.find((c) => c.id === "conn_sun_leaf");

  assert.ok(sunBefore);
  assert.equal(sunBefore.opacity, 1.0);
  assert.ok(connBefore);
  assert.equal(connBefore.opacity, 1.0);

  // 300ms after DIM: sun and its attached arrow conn_sun_leaf must BOTH be dimmed to 0.35!
  const stateAfter = computeContinuousStateAt(timeline, dimOp.startMs + 300);
  const sunAfter = stateAfter.elements.find((e) => e.id === "sun");
  const connAfter = stateAfter.connectors.find((c) => c.id === "conn_sun_leaf");

  assert.ok(sunAfter);
  assert.equal(sunAfter.state, "dimmed");
  assert.equal(sunAfter.opacity, 0.35);

  assert.ok(connAfter, "Connected arrow must exist in state");
  assert.equal(connAfter.state, "dimmed");
  assert.equal(connAfter.opacity, 0.35, "Arrow must automatically cascade to dimmed opacity 0.35");
});

test("playbackEngine: Rule 6 automatically cascades ERASE to connected arrows", () => {
  const lesson: ContinuousLesson = {
    id: "test_erase_cascade",
    topic: "Erase Cascade",
    steps: [
      {
        id: "s1",
        narration: "We draw a box [box] and an arrow [arrow]. Then we erase the box [erase].",
        ops: [
          {
            op: "DRAW",
            anchor: "box",
            element: {
              id: "box_a",
              type: "shape",
              shapeType: "rect",
              size: "sm",
              placement: { type: "root" },
            },
          },
          {
            op: "DRAW",
            anchor: "box",
            element: {
              id: "box_b",
              type: "shape",
              shapeType: "rect",
              size: "sm",
              placement: { type: "relative", relativeTo: "box_a", position: "right" },
            },
          },
          {
            op: "DRAW",
            anchor: "arrow",
            element: {
              id: "conn_ab",
              type: "connector",
              from: "box_a",
              to: "box_b",
            },
          },
          {
            op: "ERASE",
            anchor: "erase",
            targetIds: ["box_a"],
          },
        ],
      },
    ],
  };

  const layout = solveContinuousLayout(lesson);
  const timeline = compileContinuousTimeline(lesson, layout);

  const eraseOp = timeline.timedOps.find((top) => top.op.op === "ERASE")!;
  assert.ok(eraseOp);

  // After erase: box_a is erased (opacity 0), and conn_ab is automatically erased (opacity 0)
  const stateAfter = computeContinuousStateAt(timeline, eraseOp.startMs + 350);
  const connAfter = stateAfter.connectors.find((c) => c.id === "conn_ab");

  // Since opacity is 0, it should not be in the active render list (or have opacity 0)
  if (connAfter) {
    assert.equal(connAfter.opacity, 0.0);
    assert.equal(connAfter.state, "erased");
  } else {
    // Correctly filtered out from visible connectors
    assert.ok(true);
  }
});

test("playbackEngine: Rule 5 camera keyframe moves smoothly without overshoot", () => {
  const fixturePath = join(process.cwd(), "eval", "fixtures", "photosynthesis_continuous.json");
  const raw = readFileSync(fixturePath, "utf-8");
  const lesson = JSON.parse(raw) as ContinuousLesson;

  const layout = solveContinuousLayout(lesson);
  const timeline = compileContinuousTimeline(lesson, layout);

  assert.ok(timeline.cameraSegments.length > 0, "Must generate camera keyframe segments");

  for (const seg of timeline.cameraSegments) {
    // Sample intermediate camera states during transition
    const midT = (seg.startMs + seg.endMs) / 2;
    const midCam = computeContinuousStateAt(timeline, midT).camera;

    // Center X and Y must be monotonically between from and to (no overshoot)
    const minCx = Math.min(seg.from.cx, seg.to.cx);
    const maxCx = Math.max(seg.from.cx, seg.to.cx);
    const minCy = Math.min(seg.from.cy, seg.to.cy);
    const maxCy = Math.max(seg.from.cy, seg.to.cy);

    assert.ok(midCam.cx >= minCx && midCam.cx <= maxCx, `cx ${midCam.cx} must be within [${minCx}, ${maxCx}]`);
    assert.ok(midCam.cy >= minCy && midCam.cy <= maxCy, `cy ${midCam.cy} must be within [${minCy}, ${maxCy}]`);
  }
});

test("playbackEngine: stroke draw progress increases monotonically from 0 to 1", () => {
  const events = [{ tMs: 1000, type: "DRAW" as const, durationMs: 800 }];

  assert.equal(evaluateElementVisualAt(events, 500).drawProgress, 0);
  assert.equal(evaluateElementVisualAt(events, 1000).drawProgress, 0);

  const p1 = evaluateElementVisualAt(events, 1200).drawProgress;
  const p2 = evaluateElementVisualAt(events, 1400).drawProgress;
  const p3 = evaluateElementVisualAt(events, 1600).drawProgress;
  const p4 = evaluateElementVisualAt(events, 1800).drawProgress;

  assert.ok(p1 > 0 && p1 < p2, "p1 < p2");
  assert.ok(p2 < p3, "p2 < p3");
  assert.ok(p3 < p4, "p3 < p4");
  assert.equal(p4, 1);
  assert.equal(evaluateElementVisualAt(events, 2500).drawProgress, 1);
});

