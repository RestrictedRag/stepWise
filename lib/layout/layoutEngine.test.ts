import { test } from "node:test";
import assert from "node:assert/strict";
import { layoutEngine, type LayoutContext } from "./layoutEngine.ts";

function createMockContext(lang: string = "en", labels: Record<string, string> = {}): LayoutContext {
  return {
    language: lang,
    labels,
    occupiedBoxes: [],
    drawnElements: new Map(),
  };
}

test("layoutEngine places circles deterministically in the 1000x700 canvas", () => {
  const ctx = createMockContext("en");
  const shape = layoutEngine.resolveObject("c1", { type: "circle", size: "md", zone: "center" }, "purple", ctx);

  assert.equal(shape.type, "circle");
  if (shape.type === "circle") {
    assert.equal(shape.x, 500);
    assert.equal(shape.y, 350);
    assert.equal(shape.r, 80);
    assert.equal(shape.color, "purple");
  }
  assert.ok(ctx.drawnElements.has("c1"));
});

test("layoutEngine flips zone placement in RTL languages (Arabic)", () => {
  const ctxEn = createMockContext("en");
  const shapeEn = layoutEngine.resolveObject("left_en", { type: "circle", size: "sm", zone: "left" }, "ink", ctxEn);

  const ctxAr = createMockContext("ar");
  const shapeAr = layoutEngine.resolveObject("left_ar", { type: "circle", size: "sm", zone: "left" }, "ink", ctxAr);

  if (shapeEn.type === "circle" && shapeAr.type === "circle") {
    // In English (LTR), "left" is at x=350
    assert.equal(shapeEn.x, 350);
    // In Arabic (RTL), "left" flips to x=650
    assert.equal(shapeAr.x, 650);
  }
});

test("layoutEngine nudges overlapping labels using AABB collision avoidance", () => {
  const ctx = createMockContext("en", { label1: "Nucleus", label2: "Mitochondria" });

  const l1 = layoutEngine.resolveObject("lbl1", { type: "label", labelKey: "label1", position: "center" }, "ink", ctx);
  const l2 = layoutEngine.resolveObject("lbl2", { type: "label", labelKey: "label2", position: "center" }, "ink", ctx);

  assert.equal(l1.type, "label");
  assert.equal(l2.type, "label");

  if (l1.type === "label" && l2.type === "label") {
    assert.equal(l1.text, "Nucleus");
    assert.equal(l2.text, "Mitochondria");
    // Ensure l2 was nudged so their y coordinates differ
    assert.notEqual(l1.y, l2.y);
  }
});

test("layoutEngine generates correct geometry for number lines and triangles", () => {
  const ctx = createMockContext("en");
  const nl = layoutEngine.resolveObject("nl1", { type: "number_line", min: -5, max: 5, step: 1 }, "blue", ctx);
  assert.equal(nl.type, "path");

  const tri = layoutEngine.resolveObject("tri1", { type: "triangle", kind: "right" }, "green", ctx);
  assert.equal(tri.type, "path");
});

test("layoutEngine plots mathematical functions and coordinate planes", () => {
  const ctx = createMockContext("en");

  // Parabola: f(x) = x^2 - 4
  const plot = layoutEngine.resolveObject(
    "plot1",
    { type: "function_plotter", f: "x^2 - 4", xDomain: [-3, 3], yDomain: [-5, 5], zone: "center" },
    "purple",
    ctx
  );
  assert.equal(plot.type, "path");
  if (plot.type === "path") {
    assert.ok(plot.d.startsWith("M"));
    assert.ok(plot.d.includes("L"));
    assert.equal(plot.color, "purple");
  }

  // Coordinate plane with points
  const plane = layoutEngine.resolveObject(
    "plane1",
    { type: "coordinate_plane", xDomain: [-5, 5], yDomain: [-5, 5], grid: true, points: [[0, 0], [3, 4]], zone: "center" },
    "ink",
    ctx
  );
  assert.equal(plane.type, "path");
  if (plane.type === "path") {
    assert.ok(plane.d.includes("M"));
    assert.ok(plane.d.includes("L"));
    assert.equal(plane.color, "ink");
  }
});
