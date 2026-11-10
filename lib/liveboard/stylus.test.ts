import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { clampStylusPosition } from "./stylus.ts";

describe("stylus", () => {
  it("keeps position inside bounds", () => {
    const pt = clampStylusPosition({ x: 200, y: 300 }, { minX: 0, maxX: 528, minY: 0, maxY: 1000 });
    assert.deepEqual(pt, { x: 200, y: 300 });
  });

  it("clamps position at boundaries", () => {
    const ptLow = clampStylusPosition({ x: -20, y: -10 }, { minX: 0, maxX: 528, minY: 0, maxY: 1000 });
    assert.deepEqual(ptLow, { x: 0, y: 0 });

    const ptHigh = clampStylusPosition({ x: 600, y: 1200 }, { minX: 0, maxX: 528, minY: 0, maxY: 1000 });
    assert.deepEqual(ptHigh, { x: 528, y: 1000 });
  });
});

