import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { solveContinuousLayout, solveConnectorEndpoints } from "./layoutSolver.ts";
import type { ContinuousLesson } from "./types.ts";

test("layoutSolver successfully solves the Photosynthesis golden fixture", () => {
  const fixturePath = join(process.cwd(), "eval", "fixtures", "photosynthesis_continuous.json");
  const raw = readFileSync(fixturePath, "utf-8");
  const lesson = JSON.parse(raw) as ContinuousLesson;

  const solved = solveContinuousLayout(lesson);

  // Assert all non-connector elements exist
  const expectedElements = [
    "leaf",
    "sun",
    "co2_in",
    "h2o_in",
    "soil_note",
    "glucose_out",
    "o2_out",
    "eq_word",
    "eq_chemical",
  ];

  for (const id of expectedElements) {
    const el = solved.elements.get(id);
    assert.ok(el, `Expected element ${id} to be solved`);
    assert.ok(Number.isFinite(el.x), `Element ${id} x must be finite`);
    assert.ok(Number.isFinite(el.y), `Element ${id} y must be finite`);
    assert.ok(el.width > 0, `Element ${id} width must be positive`);
    assert.ok(el.height > 0, `Element ${id} height must be positive`);
    // Assert rounding consistency: bounds and center agree
    assert.equal(el.x, el.bounds.x + Math.round(el.width / 2));
    assert.equal(el.y, el.bounds.y + Math.round(el.height / 2));
  }

  // Assert all connectors exist and have valid endpoints
  const expectedConnectors = [
    "conn_sun_leaf",
    "conn_co2_leaf",
    "conn_h2o_leaf",
    "conn_leaf_glucose",
    "conn_leaf_o2",
  ];

  for (const id of expectedConnectors) {
    const conn = solved.connectors.get(id);
    assert.ok(conn, `Expected connector ${id} to be solved`);
    assert.ok(Number.isFinite(conn.fromPoint.x), `Connector ${id} fromPoint.x must be finite`);
    assert.ok(Number.isFinite(conn.fromPoint.y), `Connector ${id} fromPoint.y must be finite`);
    assert.ok(Number.isFinite(conn.toPoint.x), `Connector ${id} toPoint.x must be finite`);
    assert.ok(Number.isFinite(conn.toPoint.y), `Connector ${id} toPoint.y must be finite`);

    // Verify distance > 0 between endpoints
    const dist = Math.hypot(conn.toPoint.x - conn.fromPoint.x, conn.toPoint.y - conn.fromPoint.y);
    assert.ok(dist > 10, `Connector ${id} endpoints must have non-zero separation`);
  }
});

test("layoutSolver: Rule 8 places second root element strictly below the bottom of the prior board", () => {
  const lesson: ContinuousLesson = {
    id: "two_roots",
    topic: "Test Roots",
    steps: [
      {
        id: "s1",
        narration: "First diagram [root1]",
        ops: [
          {
            op: "DRAW",
            anchor: "root1",
            element: {
              id: "root1",
              type: "shape",
              shapeType: "rect",
              size: "lg",
              placement: { type: "root", x: 500, y: 200 },
            },
          },
        ],
      },
      {
        id: "s2",
        narration: "Second diagram in fresh space [root2]",
        ops: [
          {
            op: "DRAW",
            anchor: "root2",
            element: {
              id: "root2",
              type: "shape",
              shapeType: "rect",
              size: "lg",
              placement: { type: "root" },
            },
          },
        ],
      },
    ],
  };

  const solved = solveContinuousLayout(lesson);
  const r1 = solved.elements.get("root1")!;
  const r2 = solved.elements.get("root2")!;

  // r2 top must be strictly below r1 bottom
  assert.ok(
    r2.bounds.y >= r1.bounds.y + r1.bounds.height,
    `Root 2 bounds.y (${r2.bounds.y}) must be >= Root 1 bottom (${r1.bounds.y + r1.bounds.height})`
  );
});

test("layoutSolver: below-aligned-eq aligns on '=' sign accurately with measured inputs", () => {
  const lesson: ContinuousLesson = {
    id: "eq_align",
    topic: "Test Eq Align",
    steps: [
      {
        id: "s1",
        narration: "First equation [eq1]",
        ops: [
          {
            op: "DRAW",
            anchor: "eq1",
            element: {
              id: "eq1",
              type: "latex",
              math: "2x + 5 = 15",
              size: "md",
              placement: { type: "root", x: 500, y: 200 },
            },
          },
          {
            op: "DRAW",
            anchor: "eq1",
            element: {
              id: "eq2",
              type: "latex",
              math: "2x = 10",
              size: "md",
              placement: {
                type: "relative",
                relativeTo: "eq1",
                position: "below-aligned-eq",
                offset: "sm",
              },
            },
          },
        ],
      },
    ],
  };

  const measured = new Map();
  measured.set("eq1", { width: 140, height: 40, eqRelX: 75 });
  measured.set("eq2", { width: 100, height: 40, eqRelX: 45 });

  const solved = solveContinuousLayout(lesson, measured);
  const e1 = solved.elements.get("eq1")!;
  const e2 = solved.elements.get("eq2")!;

  const e1EqAbsX = e1.bounds.x + 75;
  const e2EqAbsX = e2.bounds.x + 45;

  assert.equal(e1EqAbsX, e2EqAbsX, "Absolute X of '=' in eq1 and eq2 must align exactly");
  assert.ok(e2.bounds.y > e1.bounds.y + e1.bounds.height, "eq2 must be below eq1");
});

test("layoutSolver: connector ray-cast reaches ellipse boundary without penetrating center", () => {
  const fromElem = {
    id: "c1",
    x: 200,
    y: 200,
    width: 100,
    height: 100,
    bounds: { x: 150, y: 150, width: 100, height: 100 },
    element: { id: "c1", type: "shape", shapeType: "circle", size: "md", placement: { type: "root" } } as any,
  };

  const toElem = {
    id: "c2",
    x: 400,
    y: 200,
    width: 100,
    height: 100,
    bounds: { x: 350, y: 150, width: 100, height: 100 },
    element: { id: "c2", type: "shape", shapeType: "circle", size: "md", placement: { type: "root" } } as any,
  };

  const { fromPoint, toPoint } = solveConnectorEndpoints(fromElem, toElem);

  assert.equal(fromPoint.x, 250);
  assert.equal(fromPoint.y, 200);
  assert.equal(toPoint.x, 350);
  assert.equal(toPoint.y, 200);
});

test("layoutSolver: safely repairs undeclared parent and drops future connector without crashing", () => {
  const badLesson: ContinuousLesson = {
    id: "bad",
    topic: "Bad",
    steps: [
      {
        id: "s1",
        narration: "Bad [bad]",
        ops: [
          {
            op: "DRAW",
            anchor: "bad",
            element: {
              id: "child",
              type: "shape",
              shapeType: "rect",
              size: "sm",
              placement: { type: "relative", relativeTo: "ghost", position: "below" },
            },
          },
          {
            op: "DRAW",
            anchor: "bad",
            element: {
              id: "future_conn",
              type: "connector",
              from: "child",
              to: "not_yet_created",
            },
          },
        ],
      },
    ],
  };

  // Solver must NOT throw; it repairs the child to root and drops future connector
  const solved = solveContinuousLayout(badLesson);
  assert.ok(solved.elements.has("child"));
  assert.equal(solved.connectors.has("future_conn"), false);
});
