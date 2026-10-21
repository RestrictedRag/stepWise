import type { BoardScript } from "./board.ts";

export type Lesson = {
  id: string; pdfKey: string; question: string; style: string; page: number; lang: string;
  script: BoardScript; clips: (Blob | null)[]; step: number; createdAt: number;
};

const req = <T,>(r: IDBRequest<T>) => new Promise<T>((ok, no) => { r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error); });
const done = (t: IDBTransaction) => new Promise<void>((ok, no) => { t.oncomplete = () => ok(); t.onerror = () => no(t.error); t.onabort = () => no(t.error); });

// shortcut: one connection opened per call, fine at prototype volume; cache it if calls get chatty.
function open() {
  const r = indexedDB.open("stepwise-pdf", 1);
  r.onupgradeneeded = () => {
    const db = r.result;
    db.createObjectStore("pdfs", { keyPath: "key" });
    db.createObjectStore("lessons", { keyPath: "id" }).createIndex("pdfKey", "pdfKey");
    db.createObjectStore("prefs", { keyPath: "pdfKey" });
  };
  return req(r);
}

async function tx<T>(store: string, mode: IDBTransactionMode, run: (s: IDBObjectStore) => Promise<T> | T): Promise<T> {
  const db = await open();
  try {
    const t = db.transaction(store, mode);
    const finished = done(t);
    const out = await run(t.objectStore(store));
    await finished;
    return out;
  } finally { db.close(); }
}

export async function pdfKey(bytes: ArrayBuffer): Promise<string> {
  const h = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return Array.from(h, (b) => b.toString(16).padStart(2, "0")).join("");
}

export const savePdf = (key: string, name: string, bytes: ArrayBuffer) =>
  tx("pdfs", "readwrite", (s) => { s.put({ key, name, bytes, savedAt: Date.now() }); });

export const getPdf = (key: string): Promise<{ name: string; bytes: ArrayBuffer } | null> =>
  tx("pdfs", "readonly", (s) => req(s.get(key))).then((r) => r ?? null);

export async function listPdfs(): Promise<{ key: string; name: string }[]> {
  const all: { key: string; name: string; savedAt: number }[] = await tx("pdfs", "readonly", (s) => req(s.getAll()));
  return all.sort((a, b) => b.savedAt - a.savedAt).map(({ key, name }) => ({ key, name }));
}

export async function saveLesson(l: Lesson): Promise<boolean> {
  try {
    await tx("lessons", "readwrite", (s) => { s.put(l); });
    return true;
  } catch (e) {
    if ((e as DOMException)?.name === "QuotaExceededError") return false;
    throw e;
  }
}

export async function listLessons(key: string): Promise<Lesson[]> {
  const all: Lesson[] = await tx("lessons", "readonly", (s) => req(s.index("pdfKey").getAll(key)));
  return all.sort((a, b) => b.createdAt - a.createdAt);
}

export const setLessonStep = (id: string, step: number) =>
  tx("lessons", "readwrite", async (s) => {
    const l: Lesson | undefined = await req(s.get(id));
    if (l) s.put({ ...l, step });
  });

export const getLastStyle = (key: string): Promise<string> =>
  tx("prefs", "readonly", (s) => req(s.get(key))).then((r) => r?.style ?? "");

export const setLastStyle = (key: string, style: string) =>
  tx("prefs", "readwrite", (s) => { s.put({ pdfKey: key, style }); });
