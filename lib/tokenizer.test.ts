import { test } from "node:test";
import assert from "node:assert/strict";
import { tokenizeScript, findTermWordIndex } from "./tokenizer.ts";

test("tokenizeScript handles English with spaces and punctuation", () => {
  const res = tokenizeScript("The nucleus? It thinks she runs the place.", "en");
  assert.ok(res.tokens.length >= 8);
  assert.equal(res.tokens[0].text, "The");
  assert.equal(res.tokens[1].text, "nucleus");
  assert.equal(res.tokens[1].wordIndex, 1);

  const idx = findTermWordIndex(res.tokens, "nucleus", "en");
  assert.equal(idx, 1);
});

test("tokenizeScript handles Hindi (Devanagari)", () => {
  const res = tokenizeScript("कोशिका के केंद्र में नाभिक होता है।", "hi");
  assert.ok(res.tokens.length >= 6);
  assert.equal(res.tokens[0].text, "कोशिका");
  assert.equal(res.tokens[0].wordIndex, 0);

  const idx = findTermWordIndex(res.tokens, "नाभिक", "hi");
  assert.ok(idx !== null && idx >= 0);
});

test("tokenizeScript handles Chinese with character span mapping", () => {
  const text = "细胞的核心是细胞核。";
  const zhRes = tokenizeScript(text, "zh");
  assert.ok(zhRes.tokens.length >= 3);

  // Check character span mapping
  const firstToken = zhRes.tokens[0];
  assert.ok(firstToken.characterSpans.length > 0);
  assert.equal(firstToken.characterSpans[0].char, text[firstToken.startChar]);

  const zhIdx = findTermWordIndex(zhRes.tokens, "细胞核", "zh");
  assert.ok(zhIdx !== null && zhIdx >= 0);
});

test("tokenizeScript handles Japanese with character span mapping", () => {
  const text = "細胞の中心には核があります。";
  const jaRes = tokenizeScript(text, "ja");
  assert.ok(jaRes.tokens.length >= 3);

  const nucleusToken = jaRes.tokens.find((t) => t.text === "核");
  assert.ok(nucleusToken);
  assert.equal(nucleusToken.characterSpans[0].char, "核");

  const jaIdx = findTermWordIndex(jaRes.tokens, "核", "ja");
  assert.ok(jaIdx !== null && jaIdx >= 0);
});

test("tokenizeScript handles RTL languages (Arabic)", () => {
  const arRes = tokenizeScript("النواة هي مركز التحكم في الخلية.", "ar");
  assert.ok(arRes.tokens.length >= 5);
  const arIdx = findTermWordIndex(arRes.tokens, "الخلية", "ar");
  assert.ok(arIdx !== null && arIdx >= 0);
});
