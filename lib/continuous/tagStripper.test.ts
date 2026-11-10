import test from "node:test";
import assert from "node:assert/strict";
import { stripTagsAndExtractAnchors } from "./tagStripper.ts";

test("tagStripper strips tags and maps each tag to the following word", () => {
  const narration = "The leaf [leaf] absorbs sunlight [sun] from above.";
  const res = stripTagsAndExtractAnchors(narration);

  // cleanText must not contain brackets
  assert.equal(res.cleanText, "The leaf absorbs sunlight from above.");
  assert.equal(res.declaredTags.has("leaf"), true);
  assert.equal(res.declaredTags.has("sun"), true);

  // [leaf] is followed by "absorbs"
  const leafTag = res.tagMap.get("leaf");
  assert.ok(leafTag);
  assert.equal(leafTag.word, "absorbs");
  assert.equal(leafTag.wordIndex, 2); // "The"(0) "leaf"(1) "absorbs"(2)

  // [sun] is followed by "from"
  const sunTag = res.tagMap.get("sun");
  assert.ok(sunTag);
  assert.equal(sunTag.word, "from");
  assert.equal(sunTag.wordIndex, 4); // "The"(0) "leaf"(1) "absorbs"(2) "sunlight"(3) "from"(4)
});

test("tagStripper handles tag at sentence start", () => {
  const narration = "[intro] Welcome to the whiteboard lesson.";
  const res = stripTagsAndExtractAnchors(narration);

  assert.equal(res.cleanText, "Welcome to the whiteboard lesson.");
  const tag = res.tagMap.get("intro");
  assert.ok(tag);
  assert.equal(tag.word, "Welcome");
  assert.equal(tag.wordIndex, 0);
});

test("tagStripper handles tag at the very end of sentence", () => {
  const narration = "We arrive at the balanced equation [balanced].";
  const res = stripTagsAndExtractAnchors(narration);

  assert.equal(res.cleanText, "We arrive at the balanced equation.");
  const tag = res.tagMap.get("balanced");
  assert.ok(tag);
  assert.equal(tag.word, "equation.");
  assert.equal(tag.wordIndex, 5); // "We"(0) "arrive"(1) "at"(2) "the"(3) "balanced"(4) "equation."(5)
});

test("tagStripper handles multiple consecutive tags", () => {
  const narration = "[tag1] [tag2] Both tags precede this action.";
  const res = stripTagsAndExtractAnchors(narration);

  assert.equal(res.cleanText, "Both tags precede this action.");
  assert.equal(res.tagMap.get("tag1")?.wordIndex, 0);
  assert.equal(res.tagMap.get("tag2")?.wordIndex, 0);
  assert.equal(res.tagMap.get("tag1")?.word, "Both");
  assert.equal(res.tagMap.get("tag2")?.word, "Both");
});

test("tagStripper handles empty string gracefully", () => {
  const res = stripTagsAndExtractAnchors("");
  assert.equal(res.cleanText, "");
  assert.equal(res.words.length, 0);
  assert.equal(res.declaredTags.size, 0);
});

