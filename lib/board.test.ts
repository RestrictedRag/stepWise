import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { parseBoardScript } from "./board.ts";

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
