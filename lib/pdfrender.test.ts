import test from "node:test";
import assert from "node:assert/strict";
import { renderScale } from "./pdfrender.ts";

test("renderScale caps at 2x and keeps big pages near 1400px wide", () => {
  assert.equal(renderScale(1000), 1.4); // wide page: 1400px target
  assert.equal(renderScale(300), 2);
  assert.ok(renderScale(2000) * 2000 <= 1400); // A2 poster stays small
});
