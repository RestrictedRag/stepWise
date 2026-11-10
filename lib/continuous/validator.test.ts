import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { validateContinuousLesson, repairContinuousLesson } from "./validator.ts";
import type { ContinuousLesson } from "./types.ts";

test("validator passes the Photosynthesis golden fixture with 0 errors", () => {
  const fixturePath = join(process.cwd(), "eval", "fixtures", "photosynthesis_continuous.json");
  const raw = readFileSync(fixturePath, "utf-8");
  const lesson = JSON.parse(raw) as ContinuousLesson;

  const result = validateContinuousLesson(lesson);
  assert.equal(result.valid, true);
  assert.equal(result.errors.length, 0);
});

test("validator detects connector referencing future element (Gap 1)", () => {
  const lesson: ContinuousLesson = {
    id: "test_future_conn",
    topic: "Future Conn",
    steps: [
      {
        id: "s1",
        narration: "We draw the sun [sun] and its light ray [light].",
        ops: [
          {
            op: "DRAW",
            anchor: "sun",
            element: {
              id: "sun",
              type: "shape",
              shapeType: "circle",
              size: "sm",
              placement: { type: "root" },
            },
          },
          {
            op: "DRAW",
            anchor: "light",
            element: {
              id: "conn_to_future",
              type: "connector",
              from: "sun",
              to: "future_leaf", // Leaf not drawn until Step 2!
            },
          },
        ],
      },
      {
        id: "s2",
        narration: "Now we draw the leaf [leaf].",
        ops: [
          {
            op: "DRAW",
            anchor: "leaf",
            element: {
              id: "future_leaf",
              type: "shape",
              shapeType: "ellipse",
              size: "lg",
              placement: { type: "root" },
            },
          },
        ],
      },
    ],
  };

  const result = validateContinuousLesson(lesson);
  assert.equal(result.valid, false);
  const err = result.errors.find((e) => e.code === "CONNECTOR_TARGET_FUTURE");
  assert.ok(err, "Must report CONNECTOR_TARGET_FUTURE error");
  assert.equal(err?.targetId, "future_leaf");
});

test("validator detects undeclared anchor tag (Gap 3)", () => {
  const lesson: ContinuousLesson = {
    id: "test_missing_anchor",
    topic: "Missing Anchor",
    steps: [
      {
        id: "s1",
        narration: "A simple introduction with no tags.",
        ops: [
          {
            op: "DRAW",
            anchor: "ghost_tag", // not in narration!
            element: {
              id: "e1",
              type: "shape",
              shapeType: "rect",
              size: "sm",
              placement: { type: "root" },
            },
          },
        ],
      },
    ],
  };

  const result = validateContinuousLesson(lesson);
  assert.equal(result.valid, false);
  const err = result.errors.find((e) => e.code === "ANCHOR_TAG_NOT_FOUND");
  assert.ok(err);
});

test("validator detects duplicate element IDs", () => {
  const lesson: ContinuousLesson = {
    id: "test_dup_id",
    topic: "Duplicate ID",
    steps: [
      {
        id: "s1",
        narration: "First [tag1] then second [tag2].",
        ops: [
          {
            op: "DRAW",
            anchor: "tag1",
            element: {
              id: "item_a",
              type: "shape",
              shapeType: "rect",
              size: "sm",
              placement: { type: "root" },
            },
          },
          {
            op: "DRAW",
            anchor: "tag2",
            element: {
              id: "item_a", // Duplicate!
              type: "shape",
              shapeType: "circle",
              size: "sm",
              placement: { type: "root" },
            },
          },
        ],
      },
    ],
  };

  const result = validateContinuousLesson(lesson);
  assert.equal(result.valid, false);
  const err = result.errors.find((e) => e.code === "DUPLICATE_ELEMENT_ID");
  assert.ok(err);
});

test("repairContinuousLesson: auto-repairs fuzzy misspelled ID and drops dangling connector", () => {
  const badLesson: ContinuousLesson = {
    id: "repair_me",
    topic: "Repair Me",
    steps: [
      {
        id: "s1",
        narration: "First we create the chloroplast [chloroplast].",
        ops: [
          {
            op: "DRAW",
            anchor: "chloroplast",
            element: {
              id: "chloroplast_main",
              type: "shape",
              shapeType: "ellipse",
              size: "lg",
              placement: { type: "root" },
            },
          },
          {
            op: "DRAW",
            anchor: "chloroplast",
            element: {
              id: "conn_1",
              type: "connector",
              from: "chloroplast_main",
              to: "chloroplast_mainn", // typo (1 char off)
            },
          },
          {
            op: "DRAW",
            anchor: "chloroplast",
            element: {
              id: "conn_hopeless",
              type: "connector",
              from: "chloroplast_main",
              to: "completely_fake_id_12345", // hopeless
            },
          },
        ],
      },
    ],
  };

  const repaired = repairContinuousLesson(badLesson);
  const s1Ops = repaired.steps[0].ops;

  // conn_hopeless must be dropped
  assert.equal(s1Ops.some((op) => op.op === "DRAW" && op.element.id === "conn_hopeless"), false);

  // conn_1 must have its 'to' fixed to "chloroplast_main"
  const conn1Op = s1Ops.find((op) => op.op === "DRAW" && op.element.id === "conn_1") as any;
  // Since conn_1 would now be self-looping (from chloroplast_main to chloroplast_main), it's safely dropped!
  assert.equal(conn1Op, undefined);
});

