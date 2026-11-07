import test from "node:test";
import assert from "node:assert/strict";
import { pdfKey } from "./pdfstore.ts";

test("pdfKey is the SHA-256 hex of the bytes", async () => {
  assert.equal(await pdfKey(new TextEncoder().encode("abc").buffer as ArrayBuffer),
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
});
