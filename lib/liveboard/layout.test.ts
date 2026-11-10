import test from "node:test";
import assert from "node:assert/strict";
import { layoutBlocks, COLUMN_WIDTH, COLUMN_GAP, COLUMN_STRIDE, BLOCK_GAP } from "./layout.ts";

test("layoutBlocks places blocks vertically with 48px gap", () => {
  const blocks = [
    { id: "b1", height: 100 },
    { id: "b2", height: 150 },
  ];
  const placed = layoutBlocks(blocks, 0);

  assert.equal(placed.length, 2);
  assert.equal(placed[0].x, 0);
  assert.equal(placed[0].y, 0);
  assert.equal(placed[0].w, COLUMN_WIDTH);
  assert.equal(placed[0].h, 100);

  assert.equal(placed[1].x, 0);
  assert.equal(placed[1].y, 100 + BLOCK_GAP); // 148
  assert.equal(placed[1].w, COLUMN_WIDTH);
  assert.equal(placed[1].h, 150);
});

test("earlier blocks never move when new ones are added", () => {
  const initial = [
    { id: "b1", height: 80 },
    { id: "b2", height: 120 },
  ];
  const placed1 = layoutBlocks(initial, 0);

  const updated = [
    { id: "b1", height: 80 },
    { id: "b2", height: 120 },
    { id: "b3", height: 200 },
  ];
  const placed2 = layoutBlocks(updated, 0);

  assert.equal(placed2[0].x, placed1[0].x);
  assert.equal(placed2[0].y, placed1[0].y);
  assert.equal(placed2[1].x, placed1[1].x);
  assert.equal(placed2[1].y, placed1[1].y);

  assert.equal(placed2[2].y, placed1[1].y + placed1[1].h + BLOCK_GAP);
});

test("columns sit at n * 628 and never overlap horizontally", () => {
  const col0 = layoutBlocks([{ id: "c0_b1", height: 100 }], 0);
  const col1 = layoutBlocks([{ id: "c1_b1", height: 100 }], 1);
  const col2 = layoutBlocks([{ id: "c2_b1", height: 100 }], 2);

  assert.equal(col0[0].x, 0);
  assert.equal(col1[0].x, COLUMN_STRIDE); // 628
  assert.equal(col2[0].x, 2 * COLUMN_STRIDE); // 1256

  // Check gap between column 0 and column 1
  const col0Right = col0[0].x + col0[0].w;
  assert.equal(col0Right, 528);
  assert.equal(col1[0].x - col0Right, COLUMN_GAP); // Exactly 100px gap, no overlap
});

test("measured heights from input or knownHeights take precedence", () => {
  const blocks = [{ id: "b1", measuredHeight: 250 }];
  const placed = layoutBlocks(blocks, 0);
  assert.equal(placed[0].h, 250);

  const placedKnown = layoutBlocks(blocks, 0, { b1: 300 });
  assert.equal(placedKnown[0].h, 300);
});

