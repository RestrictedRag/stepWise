import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  calcTextRevealUnits,
  calcMathClipPercent,
  countGraphemes,
  splitTextSegments,
} from "./textPacing.ts";

describe("textPacing", () => {
  it("counts graphemes including multi-byte emoji correctly", () => {
    assert.equal(countGraphemes("Hello"), 5);
    // Family emoji or accented grapheme
    assert.equal(countGraphemes("e\u0301"), 1); // e + acute accent
    assert.equal(countGraphemes(""), 0);
  });

  it("calculates text reveal units based on 58ms grapheme cadence", () => {
    // 10 graphemes, 580ms elapsed -> 10 units
    const units = calcTextRevealUnits(20, 580, 1.0, 58);
    assert.equal(units, 10);
  });

  it("scales reveal units with playback speed", () => {
    // 580ms at 1.5x speed -> 15 units
    const units = calcTextRevealUnits(20, 580, 1.5, 58);
    assert.equal(units, 15);
  });

  it("clamps units to graphemeCount", () => {
    const units = calcTextRevealUnits(10, 2000, 1.0, 58);
    assert.equal(units, 10);
  });

  it("returns 0 when elapsed is non-positive", () => {
    assert.equal(calcTextRevealUnits(10, -50, 1.0, 58), 0);
    assert.equal(calcTextRevealUnits(10, 0, 1.0, 58), 0);
  });

  it("calculates math clip percent between 0 and 1", () => {
    assert.equal(calcMathClipPercent(0, 1000), 0);
    assert.equal(calcMathClipPercent(500, 1000), 0.5);
    assert.equal(calcMathClipPercent(1000, 1000), 1.0);
    assert.equal(calcMathClipPercent(1500, 1000), 1.0);
  });

  it("handles non-zero startMs in math clip", () => {
    assert.equal(calcMathClipPercent(200, 1000, 500), 0);
    assert.equal(calcMathClipPercent(1000, 1000, 500), 0.5);
    assert.equal(calcMathClipPercent(2000, 1000, 500), 1.0);
  });

  it("splits text into text and math segments", () => {
    const segments = splitTextSegments("Formula $$x^2 + y^2 = r^2$$ for a circle.");
    assert.equal(segments.length, 3);
    assert.equal(segments[0].type, "text");
    assert.equal(segments[0].raw, "Formula ");
    assert.equal(segments[1].type, "math");
    assert.equal(segments[1].mathContent, "x^2 + y^2 = r^2");
    assert.equal(segments[2].type, "text");
    assert.equal(segments[2].raw, " for a circle.");
  });

  it("handles text with no math", () => {
    const segments = splitTextSegments("Just plain text");
    assert.equal(segments.length, 1);
    assert.equal(segments[0].type, "text");
    assert.equal(segments[0].raw, "Just plain text");
  });
});
