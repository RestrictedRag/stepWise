import { test } from "node:test";
import assert from "node:assert";
import { textRevealMs } from "./pipeline.ts";

test("short text floors at 700", () => assert.equal(textRevealMs("x=2"), 700));
test("58ms per grapheme", () => assert.equal(textRevealMs("a".repeat(20)), 1160));
test("caps at 8000", () => assert.equal(textRevealMs("a".repeat(500)), 8000));
test("emoji counts as one grapheme", () => assert.equal(textRevealMs("👍🏽".repeat(20)), 1160));

