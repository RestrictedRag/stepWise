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

test("I1: blocked localStorage getter does not throw", () => {
  Object.defineProperty(globalThis, "localStorage", { get() { throw new Error("blocked"); }, configurable: true });
  try {
    assert.deepEqual(listEntries(), []);
    assert.doesNotThrow(() => saveEntry(newEntry("solver", "x")));
  } finally {
    delete (globalThis as { localStorage?: Storage }).localStorage;
  }
});

test("I2: non-object items are dropped", () => {
  const ok = { id: "a", prompt: "p", mode: "solver", createdAt: 1 };
  const s = { getItem: () => JSON.stringify([null, 1, "x", ok]), setItem: () => {} } as unknown as Storage;
  assert.deepEqual(listEntries(s), [ok]);
});

test("I4: quota overflow strips old images and keeps the new entry", () => {
  const m = new Map<string, string>();
  const s = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { if (v.length > 5000) throw new Error("quota"); m.set(k, v); } } as unknown as Storage;
  m.set("solvely.history", JSON.stringify([newEntry("solver", "old", { mediaType: "image/png", data: "x".repeat(4000) })]));
  const e = newEntry("solver", "new", { mediaType: "image/png", data: "y".repeat(3000) });
  assert.equal(saveEntry(e, s), true);
  assert.deepEqual(getEntry(e.id, s), e);
  assert.equal(listEntries(s).find((x) => x.prompt === "old")?.image, undefined);
});

test("I4: saveEntry returns false when storage refuses everything", () => {
  const s = { getItem: () => null, setItem: () => { throw new Error("quota"); } } as unknown as Storage;
  assert.equal(saveEntry(newEntry("solver", "x"), s), false);
});

test("saveEntry dispatches solvely:history", () => {
  const g = globalThis as { window?: EventTarget };
  g.window = new EventTarget();
  let fired = false;
  g.window.addEventListener("solvely:history", () => { fired = true; });
  try {
    saveEntry(newEntry("solver", "x"), fakeStore());
    assert.equal(fired, true);
  } finally {
    delete g.window;
  }
});
