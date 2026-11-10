import test from "node:test";
import assert from "node:assert/strict";
import { followCamera, zoomAt, panBy, locate, MIN_SCALE, MAX_SCALE } from "./camera.ts";

test("zoomAt clamps scale to 0.5 - 2.0", () => {
  const cam = { x: 0, y: 0, scale: 1.0 };
  const pointer = { x: 200, y: 200 };

  const zoomedOut = zoomAt(cam, pointer, -10);
  assert.equal(zoomedOut.scale, MIN_SCALE); // 0.5

  const zoomedIn = zoomAt(cam, pointer, 10);
  assert.equal(zoomedIn.scale, MAX_SCALE); // 2.0
});

test("zoomAt keeps the world point under the cursor fixed", () => {
  const cam = { x: 50, y: 100, scale: 1.2 };
  const pointer = { x: 300, y: 400 };

  // World point before zoom
  const wxBefore = (pointer.x - cam.x) / cam.scale;
  const wyBefore = (pointer.y - cam.y) / cam.scale;

  // Zoom by +0.3
  const newCam = zoomAt(cam, pointer, 0.3);

  // World point under the same pointer after zoom
  const wxAfter = (pointer.x - newCam.x) / newCam.scale;
  const wyAfter = (pointer.y - newCam.y) / newCam.scale;

  assert.ok(Math.abs(wxAfter - wxBefore) < 1e-9);
  assert.ok(Math.abs(wyAfter - wyBefore) < 1e-9);
});

test("panBy shifts camera by screen delta dx and dy", () => {
  const cam = { x: 100, y: 200, scale: 1.5 };
  const panned = panBy(cam, -30, 50);

  assert.equal(panned.x, 70);
  assert.equal(panned.y, 250);
  assert.equal(panned.scale, 1.5);
});

test("followCamera keeps block in view about 1/3 down from the top", () => {
  const block = { x: 0, y: 300, w: 528, h: 200 };
  const viewport = { width: 1000, height: 900 };
  const cam = followCamera(block, viewport, 1.0);

  // Screen Y of block top: cam.y + block.y * scale
  const screenY = cam.y + block.y * cam.scale;
  // 1/3 of 900 is 300
  assert.equal(screenY, 300);

  // Screen X should center the block horizontally: (1000 - 528) / 2 = 236
  const screenX = cam.x + block.x * cam.scale;
  assert.equal(screenX, 236);
});

test("locate centers a given block in the viewport", () => {
  const block = { x: 628, y: 100, w: 528, h: 200 };
  const viewport = { width: 1000, height: 800 };
  const cam = locate(block, viewport, { x: 0, y: 0, scale: 1.0 });

  // Center of block in world: x = 628 + 264 = 892, y = 100 + 100 = 200
  // Screen center: cam.x + 892 = 500 => cam.x = -392
  // cam.y + 200 = 400 => cam.y = 200
  assert.equal(cam.x, 500 - 892);
  assert.equal(cam.y, 400 - 200);
});

