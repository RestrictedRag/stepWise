import { test } from "node:test";
import assert from "node:assert/strict";
import { nextSpeed, spliceSteps, fallbackMs, speedLabel } from "./playback.ts";

test("nextSpeed cycles and wraps", () => {
  assert.equal(nextSpeed(0.75), 1);
  assert.equal(nextSpeed(1), 1.25);
  assert.equal(nextSpeed(1.5), 2);
  assert.equal(nextSpeed(2), 0.75);
  assert.equal(nextSpeed(3), 0.75);
});

test("spliceSteps inserts after the given index", () => {
  assert.deepEqual(spliceSteps([1, 2, 3], 0, [9]), [1, 9, 2, 3]);
  assert.deepEqual(spliceSteps([1, 2, 3], 2, [8, 9]), [1, 2, 3, 8, 9]);
});

test("fallbackMs scales with text and speed", () => {
  assert.equal(fallbackMs("abcd", 1), 240);
  assert.equal(fallbackMs("abcd", 2), 120);
});

test("speedLabel keeps 0.75 exact", () => {
  assert.equal(speedLabel(1), "1.0x Speed");
  assert.equal(speedLabel(0.75), "0.75x Speed");
  assert.equal(speedLabel(1.25), "1.25x Speed");
});
