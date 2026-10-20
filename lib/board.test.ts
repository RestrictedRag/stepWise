import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { parseBoardScript, ICONS, seedFrom, focusBox, W, H } from "./board.ts";

test("parseBoardScript rejects bad scripts", () => {
  assert.ok(parseBoardScript(null).error);
  assert.ok(parseBoardScript({ steps: [] }).error);
  assert.ok(parseBoardScript({ steps: [{ draw: [] }] }).error);
});

test("parseBoardScript cleans shapes", () => {
  const { script } = parseBoardScript({
    steps: [{
      say: " hi ",
      draw: [
        { type: "circle", x: 2000, y: -5, r: 10, color: "hotpink" },
        { type: "laser", x: 1, y: 1 },
        { type: "circle", x: 1, y: 1 },
        { type: "path", d: "M0 0 L10 10\"><script>" },
        { type: "icon", x: 5, y: 5, name: "crown" },
      ],
    }],
  });
  assert.equal(script!.title, "Untitled");
  assert.equal(script!.steps[0].say, "hi");
  assert.deepEqual(script!.steps[0].draw, [
    { type: "circle", x: 1000, y: 0, r: 10, color: "ink" },
    { type: "icon", x: 5, y: 5, name: "crown", color: "ink" },
  ]);
});

test("parseBoardScript trims oversized scripts", () => {
  const dot = { type: "circle", x: 1, y: 1, r: 1 };
  const { script } = parseBoardScript({ steps: Array(20).fill({ say: "x".repeat(500), draw: Array(20).fill(dot) }) });
  assert.equal(script!.steps.length, 12);
  assert.equal(script!.steps[0].draw.length, 8);
  assert.equal(script!.steps[0].say.length, 300);
});

test("fixtures are valid and lose no shapes", () => {
  const dir = new URL("./fixtures/", import.meta.url);
  for (const f of readdirSync(dir).filter((f) => f.endsWith(".json"))) {
    const raw = JSON.parse(readFileSync(new URL(f, dir), "utf8"));
    const { script, error } = parseBoardScript(raw);
    assert.ok(script, `${f}: ${error}`);
    script!.steps.forEach((s, i: number) => assert.equal(s.draw.length, raw.steps[i].draw.length, `${f} step ${i + 1} dropped a shape`));
  }
});

test("keeps an at phrase that appears in say, case-insensitive, capped at 60", () => {
  const { script } = parseBoardScript({ title: "t", steps: [{ say: "The Nucleus is the boss", draw: [{ type: "circle", x: 1, y: 1, r: 5, at: "nucleus" }] }] });
  assert.equal(script!.steps[0].draw[0].at, "nucleus");
});
test("drops an at phrase that is not in say", () => {
  const { script } = parseBoardScript({ title: "t", steps: [{ say: "hello", draw: [{ type: "circle", x: 1, y: 1, r: 5, at: "nucleus" }] }] });
  assert.equal(script!.steps[0].draw[0].at, undefined);
  assert.equal(script!.steps[0].draw.length, 1);
});
test("accepts the new doodle icons", () => {
  for (const name of ["heart", "speech", "fire"]) assert.ok((ICONS as readonly string[]).includes(name));
});
test("seedFrom is deterministic and in range", () => {
  assert.equal(seedFrom("The cell's group chat"), seedFrom("The cell's group chat"));
  assert.notEqual(seedFrom("a"), seedFrom("b"));
  const n = seedFrom("x"); assert.ok(n >= 1 && n <= 9999);
});
test("focusBox is at least 60% of the board and clamped", () => {
  const [x, y, w, h] = focusBox([{ type: "circle", x: 990, y: 690, r: 5 } as any]);
  assert.ok(w >= 600 && h >= 420);
  assert.ok(x >= 0 && y >= 0 && x + w <= W && y + h <= H);
  assert.deepEqual(focusBox([]), [0, 0, W, H]);
});
