import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizer } from "./normalizer.ts";

test("normalizer expands numbers and math symbols in English", () => {
  const input = "Change in temperature Δ is 25 °.";
  const res = normalizer.normalize(input, "en");

  assert.ok(res.normalizedText.includes("delta"));
  assert.ok(res.normalizedText.includes("degrees"));
  assert.ok(res.tokenMappings.length > 0);

  // Check mapping for Δ
  const deltaMapping = res.tokenMappings.find((m) => m.originalText === "Δ");
  assert.ok(deltaMapping);
  assert.deepEqual(deltaMapping.normalizedWords, ["delta"]);
});

test("normalizer expands Hindi numerals and symbols", () => {
  const input = "कोशिका में 10 भाग होते हैं";
  const res = normalizer.normalize(input, "hi");

  assert.ok(res.normalizedText.includes("दस"));
  const numMapping = res.tokenMappings.find((m) => m.originalText === "10");
  assert.ok(numMapping);
  assert.deepEqual(numMapping.normalizedWords, ["दस"]);
});
