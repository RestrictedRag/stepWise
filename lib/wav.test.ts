import test from "node:test";
import assert from "node:assert/strict";
import { encodeWav } from "./wav.ts";

test("writes a 16 kHz mono PCM header and clamps samples", () => {
  const v = new DataView(encodeWav(new Float32Array([0, 1, -2]), 16000));
  assert.equal(v.byteLength, 50);
  assert.equal(String.fromCharCode(v.getUint8(0), v.getUint8(1), v.getUint8(2), v.getUint8(3)), "RIFF");
  assert.equal(v.getUint32(24, true), 16000);
  assert.equal(v.getUint32(40, true), 6);
  assert.deepEqual([v.getInt16(44, true), v.getInt16(46, true), v.getInt16(48, true)], [0, 32767, -32767]);
});
