export type Mode = "solver" | "whiteboard" | "flashcards" | "quiz" | "guide";
export type Entry = { id: string; mode: Mode; prompt: string; image?: { mediaType: string; data: string }; createdAt: number };

const KEY = "solvely.history";

export function newEntry(mode: Mode, prompt: string, image?: Entry["image"]): Entry {
  return { id: crypto.randomUUID(), mode, prompt, ...(image ? { image } : {}), createdAt: Date.now() };
}

// store is resolved inside try: reading globalThis.localStorage itself throws when storage is blocked
export function listEntries(store?: Storage): Entry[] {
  try {
    const v = JSON.parse((store ?? globalThis.localStorage).getItem(KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x) => x && typeof x === "object" && typeof x.id === "string" && typeof x.prompt === "string") : [];
  } catch {
    return [];
  }
}

// returns false when nothing could be stored; on quota overflow older entries lose their images first
export function saveEntry(e: Entry, store?: Storage): boolean {
  let s: Storage;
  try { s = store ?? globalThis.localStorage; } catch { return false; }
  const old = listEntries(s).slice(0, 49);
  const attempts = [[e, ...old], [e, ...old.map(({ image: _, ...rest }) => rest)], [e]];
  for (const list of attempts) {
    try {
      s.setItem(KEY, JSON.stringify(list));
      if (typeof window !== "undefined") window.dispatchEvent(new Event("solvely:history"));
      return true;
    } catch { /* try a smaller list */ }
  }
  return false;
}

export function getEntry(id: string, store?: Storage): Entry | null {
  return listEntries(store).find((x) => x.id === id) ?? null;
}
