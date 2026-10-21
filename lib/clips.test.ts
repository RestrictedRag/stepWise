import test from "node:test";
import assert from "node:assert/strict";
import { loadClips } from "./clips.ts";

test("no steps means no clips and no speak calls", () => {
  assert.deepEqual(loadClips([], () => { throw new Error("called"); }), []);
});
test("stored clips never call speak", async () => {
  let calls = 0; const b = new Blob(["a"]);
  const out = await Promise.all(loadClips(["a", "b"], async () => { calls++; return null; }, [b, null]));
  assert.equal(calls, 0); assert.deepEqual(out, [b, null]);
});
test("clip 0 goes first, the rest after it settles, failures become null", async () => {
  const started: string[] = [];
  const ps = loadClips(["a", "b", "c"], (t) => { started.push(t); return t === "b" ? Promise.reject(new Error("x")) : Promise.resolve(new Blob([t])); });
  assert.deepEqual(started, ["a"]);
  await ps[0];
  const out = await Promise.all(ps);
  assert.deepEqual(started.slice().sort(), ["a", "b", "c"]); // each called exactly once
  assert.equal(out[1], null); assert.ok(out[0] instanceof Blob);
});
