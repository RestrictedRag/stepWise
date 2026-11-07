import test from "node:test";
import assert from "node:assert/strict";
import type { Step } from "./board.ts";
import { shapeDelays } from "./sync.ts";

test("anchored shape starts at its phrase's character position", () => {
  const step = { say: "abcdefghij", draw: [{ type: "circle", x: 0, y: 0, r: 1, at: "f" }] } as Step;
  assert.deepEqual(shapeDelays(step, 10), [5]);
});
test("unanchored shapes spread evenly", () => {
  const c = { type: "circle", x: 0, y: 0, r: 1 };
  assert.deepEqual(shapeDelays({ say: "x", draw: [c, c, c, c] } as Step, 8), [0, 2, 4, 6]);
});
test("mixed: anchored uses phrase, others use their slot", () => {
  const step = { say: "one two three four", draw: [{ type: "circle", x: 0, y: 0, r: 1 }, { type: "circle", x: 0, y: 0, r: 1, at: "three" }] } as Step;
  const [a, b] = shapeDelays(step, 18);
  assert.equal(a, 0); assert.equal(b, 8);
});
test("zero-length clip gives all zeros", () => {
  assert.deepEqual(shapeDelays({ say: "hi", draw: [{ type: "circle", x: 0, y: 0, r: 1 }] } as Step, 0), [0]);
});
