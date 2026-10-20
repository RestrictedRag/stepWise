import test from "node:test";
import assert from "node:assert/strict";
import { parseSolveRequest, parseLessonRequest } from "./validate.ts";

test("parseSolveRequest", () => {
  assert.deepEqual(parseSolveRequest({ text: " 2x+3=7 " }), { text: "2x+3=7", image: null });
  assert.ok(parseSolveRequest({}).error);
  assert.ok(parseSolveRequest({ text: "x".repeat(4001) }).error);
  assert.ok(parseSolveRequest({ image: "data:text/html;base64,AAAA" }).error);
  assert.deepEqual(parseSolveRequest({ image: "data:image/png;base64,AAAA" }).image, { mediaType: "image/png", data: "AAAA" });
});

test("parseLessonRequest", () => {
  assert.deepEqual(parseLessonRequest({ topic: " cells " }), { topic: "cells", persona: "teacher", level: "middle", lang: "en" });
  assert.equal((parseLessonRequest({ topic: "cells", persona: "gossip", lang: "kn" }) as any).persona, "gossip");
  assert.ok(parseLessonRequest({}).error);
  assert.ok(parseLessonRequest({ topic: "x".repeat(301) }).error);
  assert.ok(parseLessonRequest({ topic: "cells", persona: "pirate" }).error);
});
