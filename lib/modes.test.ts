import { test } from "node:test";
import assert from "node:assert/strict";
import { hrefFor, canSubmit } from "./modes.ts";
import { newEntry } from "./history.ts";

test("hrefFor routes whiteboard to the lesson page, others to chat", () => {
  assert.ok(hrefFor(newEntry("whiteboard", "x")).startsWith("/home/whiteboard-tutor/"));
  assert.ok(hrefFor(newEntry("solver", "x")).startsWith("/chat/"));
});

test("canSubmit needs text or an image, within MAX_TOPIC", () => {
  assert.equal(canSubmit("", false), false);
  assert.equal(canSubmit("   ", false), false);
  assert.equal(canSubmit("x".repeat(601), false), false);
  assert.equal(canSubmit("2+2", false), true);
  assert.equal(canSubmit("", true), true);
});
