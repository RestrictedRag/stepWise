import test from "node:test";
import assert from "node:assert/strict";
import { lessonSystem } from "./prompts.ts";

const base = { persona: "teacher", level: "middle", lang: "en" } as const;

test("style is quoted and woven, not prefixed", () => {
  const p = lessonSystem({ ...base, style: "like a cricket commentator", fromQuestion: false });
  assert.match(p, /"like a cricket commentator"/); assert.match(p, /As a/); // the ban is stated
});

test("question mode forbids equations and final answers", () => {
  const p = lessonSystem({ ...base, style: "", fromQuestion: true });
  assert.match(p, /no equations/i); assert.match(p, /final answer/i);
});

test("prompt asks for at phrases", () => {
  assert.match(lessonSystem({ ...base, style: "", fromQuestion: false }), /"at"/);
});
