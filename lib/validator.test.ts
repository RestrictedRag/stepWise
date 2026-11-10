import { test } from "node:test";
import assert from "node:assert/strict";
import { manifestValidator } from "./validator.ts";
import type { CompiledCommand } from "./manifest.ts";
import type { SpeechMark } from "./tts/provider.ts";

test("manifestValidator parses good choreography schema", () => {
  const goodData = {
    stepIndex: 0,
    labels: { lbl_nuc: "Nucleus" },
    commands: [
      {
        id: "draw_1",
        action: "DRAW",
        anchor: { wordIndex: 1, offsetMs: -150 },
        semanticObject: { type: "circle", size: "md", zone: "center" },
        color: "purple",
      },
    ],
  };

  const { parsed, errors } = manifestValidator.validateChoreography(goodData);
  assert.equal(errors.length, 0);
  assert.ok(parsed);
  assert.equal(parsed.commands.length, 1);
});

test("manifestValidator detects duplicate command IDs", () => {
  const commands: CompiledCommand[] = [
    { id: "elem_1", action: "DRAW", startMs: 200, durationMs: 400, shape: { type: "circle", x: 500, y: 350, r: 80, color: "ink" }, color: "ink" },
    { id: "elem_1", action: "DRAW", startMs: 700, durationMs: 400, shape: { type: "rect", x: 400, y: 300, w: 100, h: 50, color: "ink" }, color: "ink" },
  ];

  const res = manifestValidator.validateCompiledStep(0, commands, undefined, [], "", "en", new Set());
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e) => e.includes("Duplicate command ID 'elem_1'")));
});

test("manifestValidator rejects HIGHLIGHT of undrawn target element", () => {
  const commands: CompiledCommand[] = [
    { id: "hl_1", action: "HIGHLIGHT", startMs: 500, durationMs: 400, targetId: "phantom_element", style: "pulse" },
  ];

  const res = manifestValidator.validateCompiledStep(0, commands, undefined, [], "", "en", new Set());
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e) => e.includes("phantom_element")));
});

test("manifestValidator flags key-term coverage when visual is > 500ms away", () => {
  const marks: SpeechMark[] = [
    { timeMs: 200, type: "word", value: "The", startChar: 0, endChar: 3 },
    { timeMs: 1500, type: "word", value: "nucleus", startChar: 4, endChar: 11 }, // Spoken at 1500ms
  ];

  const commands: CompiledCommand[] = [
    // Visual starts at 100ms (1400ms gap from nucleus at 1500ms!)
    { id: "c1", action: "DRAW", startMs: 100, durationMs: 400, shape: { type: "circle", x: 500, y: 350, r: 80, color: "ink" }, color: "ink" },
  ];

  const res = manifestValidator.validateCompiledStep(
    0,
    commands,
    { concept: "Cell", keyTerms: ["nucleus"] },
    marks,
    "The nucleus",
    "en",
    new Set()
  );

  assert.ok(res.warnings.some((w) => w.includes("Key term 'nucleus'")));
});
