import { test } from "node:test";
import assert from "node:assert/strict";
import { parseFlashcards } from "./flashcards.ts";

test("bare array", () => {
  assert.deepEqual(parseFlashcards('[{"q":"A","a":"B"}]'), [{ q: "A", a: "B" }]);
});

test("fenced object", () => {
  assert.equal(parseFlashcards('```json\n{"cards":[{"q":"A","a":"B"}]}\n```').length, 1);
});

test("drops invalid and caps at 5", () => {
  const items = [{ q: "1", a: "x" }, { q: "2", a: "" }, { a: "x" }, { q: "3", a: "x" }, { q: "4", a: "x" }, { q: "5", a: "x" }, { q: "6", a: "x" }];
  assert.equal(parseFlashcards(JSON.stringify(items)).length, 5);
});

test("garbage gives []", () => {
  assert.deepEqual(parseFlashcards("nope"), []);
});
