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

test("tokenizeScript handles Tamil (Dravidian script)", () => {
  const text = "செல்லின் கட்டுப்பாட்டு மையம் உட்கரு ஆகும்.";
  const taRes = tokenizeScript(text, "ta");
  assert.ok(taRes.tokens.length >= 4);
  assert.equal(taRes.tokens[0].text, "செல்லின்");

  const taIdx = findTermWordIndex(taRes.tokens, "உட்கரு", "ta");
  assert.ok(taIdx !== null && taIdx >= 0);
});

test("tokenizeScript handles Kannada and Telugu", () => {
  const knText = "ಜೀವಕೋಶದ ನಿಯಂತ್ರಣ ಕೇಂದ್ರ ನ್ಯೂಕ್ಲಿಯಸ್ ಆಗಿದೆ.";
  const knRes = tokenizeScript(knText, "kn");
  assert.ok(knRes.tokens.length >= 4);
  assert.equal(knRes.tokens[0].text, "ಜೀವಕೋಶದ");

  const teText = "కణం యొక్క నియంత్రణ కేంద్రం కేంద్రకం.";
  const teRes = tokenizeScript(teText, "te");
  assert.ok(teRes.tokens.length >= 4);
  assert.equal(teRes.tokens[0].text, "కణం");
});

test("tokenizeScript handles RTL Indian language (Urdu)", () => {
  const urRes = tokenizeScript("خلیے کا کنٹرول سینٹر نیوکلیئس ہے۔", "ur");
  assert.ok(urRes.tokens.length >= 5);
  const urIdx = findTermWordIndex(urRes.tokens, "نیوکلیئس", "ur");
  assert.ok(urIdx !== null && urIdx >= 0);
});
