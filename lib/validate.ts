const MAX_TEXT = 4000;
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

export type Image = { mediaType: string; data: string };
type SolveRequest = { text: string; image: Image | null; error?: undefined } | { error: string; text?: undefined; image?: undefined };

// Returns { text, image: {mediaType, data} | null } or { error }.
export function parseSolveRequest(body: any): SolveRequest {
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  if (text.length > MAX_TEXT) return { error: `Question is longer than ${MAX_TEXT} characters.` };

  let image: Image | null = null;
  if (body?.image != null) {
    const m = /^data:([^;]+);base64,([A-Za-z0-9+/=]+)$/.exec(String(body.image));
    if (!m || !IMAGE_TYPES.includes(m[1])) return { error: "Image must be PNG, JPEG, WebP or GIF." };
    if (m[2].length * 0.75 > MAX_IMAGE_BYTES) return { error: "Image must be under 4 MB." };
    image = { mediaType: m[1], data: m[2] };
  }

  if (!text && !image) return { error: "Type a question or add an image." };
  return { text, image };
}

export const PERSONAS = ["teacher", "gossip", "coach", "story"] as const;
export const LEVELS = ["primary", "middle", "high", "college"] as const;
export const LANGS = ["en", "hi", "kn", "ta"] as const;
const MAX_TOPIC = 300;

export type LessonRequest = { topic: string; persona: (typeof PERSONAS)[number]; level: (typeof LEVELS)[number]; lang: (typeof LANGS)[number] };
const pick = <T extends string>(list: readonly T[], v: unknown, dflt: T): T | null =>
  v == null || v === "" ? dflt : (list as readonly unknown[]).includes(v) ? (v as T) : null;

// Returns { topic, persona, level, lang } with defaults filled in, or { error }.
export function parseLessonRequest(body: any): (LessonRequest & { error?: undefined }) | { error: string } {
  const topic = typeof body?.topic === "string" ? body.topic.trim() : "";
  if (!topic) return { error: "Type a topic to learn." };
  if (topic.length > MAX_TOPIC) return { error: `Topic is longer than ${MAX_TOPIC} characters.` };
  const persona = pick(PERSONAS, body?.persona, "teacher");
  const level = pick(LEVELS, body?.level, "middle");
  const lang = pick(LANGS, body?.lang, "en");
  if (!persona || !level || !lang) return { error: "Unknown persona, level or language." };
  return { topic, persona, level, lang };
}
