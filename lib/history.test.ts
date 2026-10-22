import { test } from "node:test";
import assert from "node:assert/strict";
import { newEntry, saveEntry, listEntries, getEntry } from "./history.ts";

function fakeStore(): Storage {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) } as Storage;
}

test("saveEntry then getEntry returns it", () => {
  const s = fakeStore();
  const e = newEntry("solver", "2+2");
  saveEntry(e, s);
  assert.deepEqual(getEntry(e.id, s), e);
});

test("listEntries is newest first and capped at 50", () => {
  const s = fakeStore();
  let last;
  for (let i = 0; i < 51; i++) saveEntry((last = newEntry("solver", `q${i}`)), s);
  const list = listEntries(s);
  assert.equal(list.length, 50);
  assert.deepEqual(list[0], last);
});

test("getEntry unknown id returns null", () => {
  assert.equal(getEntry("nope", fakeStore()), null);
});

test("corrupt JSON yields []", () => {
  const s = { getItem: () => "{oops", setItem: () => {} } as unknown as Storage;
  assert.deepEqual(listEntries(s), []);
});

test("throwing store is ignored", () => {
  const boom = () => { throw new Error("denied"); };
  const s = { getItem: boom, setItem: boom } as unknown as Storage;
  assert.deepEqual(listEntries(s), []);
  assert.doesNotThrow(() => saveEntry(newEntry("quiz", "x"), s));
});
