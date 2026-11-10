import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { calcCommandProgress, calcStrokeDashoffset, getShapesViewBox } from "./vectorProgress.ts";

describe("vectorProgress", () => {
  it("calculates progress 0 before startMs", () => {
    const p = calcCommandProgress(100, 200, 500);
    assert.equal(p, 0);
  });

  it("calculates partial progress midway between startMs and startMs + durationMs", () => {
    const p = calcCommandProgress(450, 200, 500);
    assert.equal(p, 0.5);
  });

  it("clamps progress to 1.0 after startMs + durationMs", () => {
    const p = calcCommandProgress(900, 200, 500);
    assert.equal(p, 1.0);
  });

  it("returns 1.0 immediately if durationMs is 0 or negative", () => {
    const p = calcCommandProgress(200, 200, 0);
    assert.equal(p, 1.0);
  });

  it("calculates strokeDashoffset correctly", () => {
    const offset0 = calcStrokeDashoffset(100, 0);
    assert.equal(offset0, 100);

    const offsetHalf = calcStrokeDashoffset(100, 0.5);
    assert.equal(offsetHalf, 50);

    const offsetFull = calcStrokeDashoffset(100, 1.0);
    assert.equal(offsetFull, 0);
  });

  it("computes padded viewBox from shapes accurately", () => {
    const shapes = [
      { type: "circle", x: 200, y: 300, r: 50 },
      { type: "rect", x: 100, y: 150, w: 200, h: 80 }
    ];
    const vb = getShapesViewBox(shapes as any);
    assert.ok(vb.minX <= 100);
    assert.ok(vb.minY <= 150);
    assert.ok(vb.width > 0);
    assert.ok(vb.height > 0);
    assert.match(vb.viewBox, /^\d+ \d+ \d+ \d+$/);
  });

  it("calculates wide enough viewBox for long text and labels to prevent clipping", () => {
    const textShape = {
      type: "label",
      x: 500,
      y: 100,
      text: "Understanding the Water Cycle",
      size: 24,
    };
    const vb = getShapesViewBox([textShape as any]);
    // 29 characters at 24px should span at least ~220px, so minX must be <= 380
    assert.ok(vb.minX <= 380, `Expected minX <= 380, got ${vb.minX}`);
    // And width must span the full text plus padding (>= 240px)
    assert.ok(vb.width >= 240, `Expected width >= 240, got ${vb.width}`);
  });
});
