import { test } from "node:test";
import assert from "node:assert/strict";
import { HybridAlignerClient } from "./alignerClient.ts";
import { tokenizeScript } from "../tokenizer.ts";

test("HybridAlignerClient falls back to syllable estimate when service is unreachable", async () => {
  const client = new HybridAlignerClient("http://127.0.0.1:9999"); // dummy port
  const { tokens } = tokenizeScript("The nucleus is the cell brain", "en");
  const audio = new Uint8Array([0, 1, 2, 3]);

  const res = await client.align(tokens, audio, 3000, "en");

  assert.equal(res.timingSource, "syllable_estimate");
  assert.equal(res.alignmentConfidence, 0.5);
  assert.equal(res.marks.length, tokens.length);

  // Verify monotonicity
  for (let i = 0; i < res.marks.length - 1; i++) {
    assert.ok(res.marks[i].timeMs <= res.marks[i + 1].timeMs);
  }
});

test("HybridAlignerClient validates token count assertion", () => {
  const client = new HybridAlignerClient();
  const { tokens } = tokenizeScript("One two three", "en");

  // Attempting to sanitize marks of unequal count must throw or mismatch
  assert.throws(() => {
    // @ts-ignore
    client["enforceSanityChecks"]([{ timeMs: 0 }], tokens, 1000);
  });
});
