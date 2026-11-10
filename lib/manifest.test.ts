import { test } from "node:test";
import assert from "node:assert/strict";
import { boardScriptToManifest, validateLessonManifest, CANVAS_W, CANVAS_H } from "./manifest.ts";
import cell from "./fixtures/cell.json" with { type: "json" };
import type { BoardScript } from "./board.ts";

test("boardScriptToManifest converts legacy fixtures accurately", () => {
  const manifest = boardScriptToManifest(cell as unknown as BoardScript);
  assert.equal(manifest.title, cell.title);
  assert.equal(manifest.steps.length, cell.steps.length);
  assert.equal(manifest.metadata.virtualCanvas.width, CANVAS_W);
  assert.equal(manifest.metadata.virtualCanvas.height, CANVAS_H);

  // Check first step
  const s0 = manifest.steps[0];
  assert.ok(s0.speech.durationMs > 0);
  assert.ok(s0.speech.speechMarks.length > 0);
  assert.equal(s0.commands.length, cell.steps[0].draw.length);
  assert.equal(s0.commands[0].action, "DRAW");
  assert.equal(s0.commands[0].id, "s0_elem0");
});

test("validateLessonManifest validates good manifest", () => {
  const manifest = boardScriptToManifest(cell as unknown as BoardScript);
  const { manifest: validated, errors } = validateLessonManifest(manifest);
  assert.equal(errors.length, 0);
  assert.ok(validated);
  assert.equal(validated.title, cell.title);
});

test("validateLessonManifest rejects empty or corrupt manifests", () => {
  const { manifest, errors } = validateLessonManifest({});
  assert.equal(manifest, null);
  assert.ok(errors.length > 0);
});

