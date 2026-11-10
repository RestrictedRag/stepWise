import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { interpolateClock } from "./clockInterpolator.ts";

describe("clockInterpolator", () => {
  it("interpolates elapsed ms based on delta time and playback speed", () => {
    // lastAudioMs: 1000, lastTickT: 5000, nowT: 5050 (50ms elapsed), speed: 1.0
    const t = interpolateClock(1000, 5000, 5050, 1.0, 350);
    assert.equal(t, 1050);
  });

  it("scales interpolation with playback speed", () => {
    // 50ms elapsed at 1.5x speed = 75ms advanced
    const t = interpolateClock(1000, 5000, 5050, 1.5, 350);
    assert.equal(t, 1075);
  });

  it("clamps to maxDriftMs to prevent unbounded drift if audio stalls", () => {
    // 500ms elapsed, but maxDrift is 350ms
    const t = interpolateClock(1000, 5000, 5500, 1.0, 350);
    assert.equal(t, 1350);
  });

  it("never goes backward if nowT is earlier than lastTickT", () => {
    const t = interpolateClock(1000, 5000, 4990, 1.0, 350);
    assert.equal(t, 1000);
  });
});

