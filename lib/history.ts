export type Mode = "solver" | "whiteboard" | "flashcards" | "quiz" | "guide";
export type Entry = { id: string; mode: Mode; prompt: string; image?: { mediaType: string; data: string }; createdAt: number };

const KEY = "solvely.history";

export function newEntry(mode: Mode, prompt: string, image?: Entry["image"]): Entry {
  // image key omitted when absent so entries survive a JSON round-trip unchanged
  return { id: crypto.randomUUID(), mode, prompt, ...(image ? { image } : {}), createdAt: Date.now() };
}

export function listEntries(store: Storage = globalThis.localStorage): Entry[] {
  try {
    const v = JSON.parse(store.getItem(KEY) ?? "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export function saveEntry(e: Entry, store: Storage = globalThis.localStorage): void {
  try {
    store.setItem(KEY, JSON.stringify([e, ...listEntries(store)].slice(0, 50)));
    if (typeof window !== "undefined") window.dispatchEvent(new Event("solvely:history"));
  } catch {
    // storage full or blocked: history is best-effort
  }
}

export function getEntry(id: string, store: Storage = globalThis.localStorage): Entry | null {
  return listEntries(store).find((x) => x.id === id) ?? null;
}
