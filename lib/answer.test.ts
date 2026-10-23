import { test } from "node:test";
import assert from "node:assert/strict";
import { parseAnswer } from "./answer.ts";

test("parses steps and answer", () => {
  const r = parseAnswer("Intro\n1. Differentiate\nUse power rule\n2. Simplify\n2x\nAnswer: 2x");
  assert.equal(r.summary, "Intro");
  assert.deepEqual(r.steps.map((s) => s.title), ["Differentiate", "Simplify"]);
  assert.equal(r.answer, "2x");
});

test("partial stream has no answer", () => {
  const r = parseAnswer("1. Differentiate\nUse");
  assert.equal(r.steps.length, 1);
  assert.equal(r.answer, null);
});

test("error suffix flagged and stripped", () => {
  const r = parseAnswer("1. A\nb\n\n[Error: could not finish solving. Try again.]");
  assert.equal(r.error, true);
  assert.equal(r.steps[0].body, "b");
});

test("no numbered steps", () => {
  const r = parseAnswer("Just text");
  assert.equal(r.summary, "Just text");
  assert.equal(r.steps.length, 0);
});

test("bold markdown steps and answer", () => {
  const r = parseAnswer("**Step 1: Write it.**  \nf(x)=x^2\n\n**Step 2: Apply rule.**  \n2x\n\n**Answer:** 2x");
  assert.equal(r.steps.length, 2);
  assert.equal(r.steps[0].title, "Write it.");
  assert.equal(r.steps[0].body, "f(x)=x^2");
  assert.equal(r.answer, "2x");
});
