import { test } from "node:test";
import assert from "node:assert/strict";
import {
  layoutEngine,
  sampleSvgPath,
  intersectRayWithSegment,
  PORT_VECTORS,
  BLUEPRINT_SLOTS,
  type LayoutContext,
  type AABB,
} from "./layoutEngine.ts";
import { manifestValidator } from "../validator.ts";
import { GlobalPlaybackEngine } from "../engine/playbackEngine.ts";
import type { Shape, Pt } from "../board.ts";
import type { CompiledStepManifest, StepChoreography } from "../manifest.ts";

test("outline ray-cast hits exact boundary on circles (tolerance <= 0.1px)", () => {
  const circle: Shape = { type: "circle", x: 500, y: 350, r: 80, color: "ink" };
  const aabb: AABB = { id: "c1", x1: 420, y1: 270, x2: 580, y2: 430 };

  const east = layoutEngine.intersectRayWithShape(circle, aabb, "E");
  assert.equal(east[0], 580);
  assert.equal(east[1], 350);

  const north = layoutEngine.intersectRayWithShape(circle, aabb, "N");
  assert.equal(north[0], 500);
  assert.equal(north[1], 270);

  const west = layoutEngine.intersectRayWithShape(circle, aabb, "W");
  assert.equal(west[0], 420);
  assert.equal(west[1], 350);

  const south = layoutEngine.intersectRayWithShape(circle, aabb, "S");
  assert.equal(south[0], 500);
  assert.equal(south[1], 430);

  // Diagonal SE: center + r * (1/sqrt(2), 1/sqrt(2))
  const se = layoutEngine.intersectRayWithShape(circle, aabb, "SE");
  const expectedX = 500 + 80 * Math.SQRT1_2;
  const expectedY = 350 + 80 * Math.SQRT1_2;
  assert.ok(Math.abs(se[0] - expectedX) <= 0.1);
  assert.ok(Math.abs(se[1] - expectedY) <= 0.1);
});

test("outline ray-cast hits exact boundary on ellipses and rectangles (tolerance <= 0.5px)", () => {
  // Ellipse: rx = 100, ry = 50 at (500, 350)
  const ellipse: Shape = { type: "ellipse", x: 500, y: 350, rx: 100, ry: 50, color: "ink" };
  const aabbE: AABB = { id: "e1", x1: 400, y1: 300, x2: 600, y2: 400 };

  const eEast = layoutEngine.intersectRayWithShape(ellipse, aabbE, "E");
  assert.equal(eEast[0], 600);
  assert.equal(eEast[1], 350);

  const eSouth = layoutEngine.intersectRayWithShape(ellipse, aabbE, "S");
  assert.equal(eSouth[0], 500);
  assert.equal(eSouth[1], 400);

  // Rect: w = 200, h = 100 at (400, 300), center is (500, 350)
  const rect: Shape = { type: "rect", x: 400, y: 300, w: 200, h: 100, color: "ink" };
  const aabbR: AABB = { id: "r1", x1: 400, y1: 300, x2: 600, y2: 400 };

  const rEast = layoutEngine.intersectRayWithShape(rect, aabbR, "E");
  assert.equal(rEast[0], 600);
  assert.equal(rEast[1], 350);

  const rNorth = layoutEngine.intersectRayWithShape(rect, aabbR, "N");
  assert.equal(rNorth[0], 500);
  assert.equal(rNorth[1], 300);
});

test("outline ray-cast accurately samples SVG paths into polygon points", () => {
  // Triangle path: (400, 350) -> (600, 350) -> (500, 200) -> Z
  const d = "M 400 350 L 600 350 L 500 200 Z";
  const pts = sampleSvgPath(d);
  assert.ok(pts.length >= 3);

  const pathShape: Shape = { type: "path", d, color: "green" };
  const aabb: AABB = { id: "p1", x1: 400, y1: 200, x2: 600, y2: 350 };

  const southHit = layoutEngine.intersectRayWithShape(pathShape, aabb, "S");
  // The bottom edge is horizontal at y = 350
  assert.equal(southHit[1], 350);
});

test("autoPorts selects facing cardinal directions across 8 quadrants", () => {
  const shapeA: Shape = { type: "circle", x: 200, y: 350, r: 40, color: "ink" };
  const aabbA: AABB = { id: "a", x1: 160, y1: 310, x2: 240, y2: 390 };

  // 1. Directly East: shapeB is at (600, 350) -> A faces E, B faces W
  const shapeBEast: Shape = { type: "circle", x: 600, y: 350, r: 40, color: "ink" };
  const aabbBEast: AABB = { id: "b1", x1: 560, y1: 310, x2: 640, y2: 390 };
  const portsE = layoutEngine.autoPorts(shapeA, aabbA, shapeBEast, aabbBEast);
  assert.equal(portsE.fromPort, "E");
  assert.equal(portsE.toPort, "W");

  // 2. Directly South: shapeB is at (200, 600) -> A faces S, B faces N
  const shapeBSouth: Shape = { type: "circle", x: 200, y: 600, r: 40, color: "ink" };
  const aabbBSouth: AABB = { id: "b2", x1: 160, y1: 560, x2: 240, y2: 640 };
  const portsS = layoutEngine.autoPorts(shapeA, aabbA, shapeBSouth, aabbBSouth);
  assert.equal(portsS.fromPort, "S");
  assert.equal(portsS.toPort, "N");

  // 3. Diagonal South-East: shapeB is at (500, 650) -> A faces SE, B faces NW
  const shapeBSE: Shape = { type: "circle", x: 500, y: 650, r: 40, color: "ink" };
  const aabbBSE: AABB = { id: "b3", x1: 460, y1: 610, x2: 540, y2: 690 };
  const portsSE = layoutEngine.autoPorts(shapeA, aabbA, shapeBSE, aabbBSE);
  assert.equal(portsSE.fromPort, "SE");
  assert.equal(portsSE.toPort, "NW");
});

test("fanOut spreads multiple connectors sharing the same port", () => {
  const basePt: Pt = [580, 350]; // Port "E"
  const pt0 = layoutEngine.fanOut(basePt, "E", 0, 3, 24);
  const pt1 = layoutEngine.fanOut(basePt, "E", 1, 3, 24);
  const pt2 = layoutEngine.fanOut(basePt, "E", 2, 3, 24);

  // X coordinate should stay on the eastern boundary (580)
  assert.equal(pt0[0], 580);
  assert.equal(pt1[0], 580);
  assert.equal(pt2[0], 580);

  // Y coordinates should spread vertically with pt1 at center
  assert.equal(pt1[1], 350);
  assert.ok(pt0[1] < 350);
  assert.ok(pt2[1] > 350);
  assert.equal(pt2[1] - pt1[1], pt1[1] - pt0[1]);
});

test("validator enforces 3-stage repair: fuzzy match, report error, drop connector", () => {
  const choreography: StepChoreography = {
    stepIndex: 0,
    labels: {},
    commands: [
      {
        id: "elem_leaf",
        action: "DRAW",
        anchor: { wordIndex: 0, offsetMs: -150 },
        semanticObject: { type: "circle", size: "lg", slotId: "core_subject" },
        color: "green",
      },
      // Connector 1: endpoints "leaf" (fuzzy match to elem_leaf) and "sun" (unknown)
      {
        id: "conn_1",
        action: "DRAW",
        anchor: { wordIndex: 1, offsetMs: -150 },
        semanticObject: {
          type: "arrow",
          from: { elementId: "leaf", port: "W" },
          to: { elementId: "completely_unknown_element", port: "E" },
        },
        color: "orange",
      },
    ],
  };

  const validIds = new Set<string>();
  const res = manifestValidator.repairChoreography(choreography, validIds);

  // conn_1 has an unrepairable endpoint, so it must be DROPPED, never snapped to dominant subject!
  assert.equal(res.droppedCount, 1);
  assert.equal(res.repaired.commands.length, 1);
  assert.equal(res.repaired.commands[0].id, "elem_leaf");
  assert.ok(res.errors.some((e) => e.includes("Dropping connector")));
});

test("slot overflow places object below, no error", () => {
  // process_flow inputs slot has capacity 3
  const commands: any[] = [
    { id: "in_1", action: "DRAW", startMs: 100, durationMs: 400, slotId: "inputs", shape: { type: "rect", x: 100, y: 130, w: 200, h: 50, color: "ink" }, color: "ink" },
    { id: "in_2", action: "DRAW", startMs: 200, durationMs: 400, slotId: "inputs", shape: { type: "rect", x: 100, y: 200, w: 200, h: 50, color: "ink" }, color: "ink" },
    { id: "in_3", action: "DRAW", startMs: 300, durationMs: 400, slotId: "inputs", shape: { type: "rect", x: 100, y: 270, w: 200, h: 50, color: "ink" }, color: "ink" },
    // 4th element exceeds capacity 3!
    { id: "in_4", action: "DRAW", startMs: 400, durationMs: 400, slotId: "inputs", shape: { type: "rect", x: 100, y: 340, w: 200, h: 50, color: "ink" }, color: "ink" },
  ];

  const res = manifestValidator.validateCompiledStep(
    0,
    commands,
    { concept: "Photosynthesis", keyTerms: [], macroBlueprint: "process_flow" },
    [],
    "",
    "en",
    new Set(),
    "process_flow"
  );

  assert.equal(res.errors.length, 0);
  assert.equal(res.valid, true);
  const placed = commands.map((c) => c.shape);
  const last = placed.at(-1)!;
  const maxBottom = Math.max(...placed.slice(0, -1).map((p: any) => p.y + p.h));
  assert.ok(last.y >= maxBottom + 48);
});
