import test from "node:test";
import assert from "node:assert/strict";
import { extractJson, generateLesson } from "./lesson.ts";

const req = { topic: "the cell", persona: "teacher", level: "middle", lang: "en", style: "", fromQuestion: false } as const;
const good = JSON.stringify({ title: "T", subtitle: null, steps: [{ say: "Hi.", draw: [{ type: "circle", x: 500, y: 350, r: 50, color: "blue" }] }] });

test("extractJson strips think blocks and prose", () => {
  assert.deepEqual(extractJson('<think>{x}</think>Sure! {"a":1} done'), { a: 1 });
  assert.throws(() => extractJson("no json"));
});

test("generateLesson repairs once, then falls back", async () => {
  const replies = ["oops not json", good];
  const asked: number[] = [];
  const ok = await generateLesson(req, async (m) => (asked.push(m.length), replies.shift()!));
  assert.equal(ok.fallback, false);
  assert.equal(ok.script.title, "T");
  assert.deepEqual(asked, [2, 4]); // repair turn carries the bad reply + error

  const bad = await generateLesson(req, async () => '{"steps":[]}');
  assert.equal(bad.fallback, true);
  assert.equal(bad.script.title, "The cell's group chat");

  const down = await generateLesson({ ...req, topic: "volcanoes" }, async () => { throw new Error("502"); });
  assert.equal(down.fallback, true);
  assert.equal(down.script.steps[0].draw.length, 0);
});
