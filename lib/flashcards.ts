import { extractJson } from "./lesson.ts";
import type { Msg } from "./llm.ts";

export type Card = { q: string; a: string };

export function parseFlashcards(raw: string): Card[] {
  try {
    const t = raw.replace(/<think>[\s\S]*?<\/think>/g, "");
    const i = t.indexOf("["), o = t.indexOf("{");
    // extractJson is object-only, so a bare array is sliced here
    const v: any = i >= 0 && (o < 0 || i < o) ? JSON.parse(t.slice(i, t.lastIndexOf("]") + 1)) : extractJson(t);
    const items: any[] = Array.isArray(v) ? v : Array.isArray(v?.cards) ? v.cards : [];
    return items
      .filter((c) => typeof c?.q === "string" && typeof c?.a === "string" && c.q.trim() && c.a.trim())
      .map((c) => ({ q: c.q.trim(), a: c.a.trim() }))
      .slice(0, 5);
  } catch {
    return [];
  }
}

export function flashcardMessages(topic: string): Msg[] {
  return [
    { role: "system", content: 'Make exactly 5 concise flashcards (short question, short answer) about the user\'s topic. Reply with JSON only: {"cards":[{"q":"...","a":"..."}]}' },
    { role: "user", content: topic },
  ];
}
