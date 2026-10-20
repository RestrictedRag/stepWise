import { extractJson } from "./lesson.ts";

const MAX_QUESTION = 600;

export type Located = { question: string; bbox: [number, number, number, number] } | { missing: true };

const MISSING: Located = { missing: true };
const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

// Gemini reply (JSON string or object) → question text + bbox as page fractions [x, y, w, h].
export function parseLocate(raw: unknown): Located {
  let v: any = raw;
  if (typeof raw === "string") {
    try { v = extractJson(raw); } catch { return MISSING; }
  }
  const question = typeof v?.question === "string" ? v.question.trim().slice(0, MAX_QUESTION) : "";
  const b = v?.bbox;
  if (!question || !Array.isArray(b) || b.length !== 4 || !b.every((n) => typeof n === "number" && Number.isFinite(n))) return MISSING;
  const [x, y] = [clamp01(b[0]), clamp01(b[1])];
  return { question, bbox: [x, y, Math.min(clamp01(b[2]), 1 - x), Math.min(clamp01(b[3]), 1 - y)] };
}
