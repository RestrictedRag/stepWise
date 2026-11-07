import test from "node:test";
import assert from "node:assert/strict";
import { parseLocate } from "./locate.ts";

test("parses a good reply", () => {
  assert.deepEqual(parseLocate('{"question":"Q3. Why is the sky blue?","bbox":[0.1,0.2,0.5,0.1]}'),
    { question: "Q3. Why is the sky blue?", bbox: [0.1, 0.2, 0.5, 0.1] });
});
test("clamps an out-of-range bbox", () => {
  const r = parseLocate({ question: "q", bbox: [-0.2, 0.9, 2, 0.5] }) as any;
  assert.deepEqual(r.bbox.slice(0, 3), [0, 0.9, 1]); assert.ok(Math.abs(r.bbox[3] - 0.1) < 1e-9);
});
test("garbage, empty question, or pixel strings are missing", () => {
  for (const raw of ["sorry I cannot", "{}", '{"question":""}', { question: "q", bbox: "12,30" }, { question: "q", bbox: [1, "a", 2, 3] }, null])
    assert.deepEqual(parseLocate(raw), { missing: true });
});
