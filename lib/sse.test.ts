import { test } from "node:test";
import assert from "node:assert/strict";
import { takeDeltas } from "./sse.ts";

test("extracts deltas and keeps partial line", () => {
  const buf =
    'data: {"choices":[{"delta":{"role":"assistant"}}]}\r\n\r\n' +
    'data: {"choices":[{"delta":{"content":"Step 1"}}]}\n\n' +
    ": keep-alive\n" +
    "data: [DONE]\n" +
    'data: {"choices":[{"del';
  const { deltas, rest } = takeDeltas(buf);
  assert.deepEqual(deltas, ["Step 1"]);
  assert.equal(rest, 'data: {"choices":[{"del');
});
