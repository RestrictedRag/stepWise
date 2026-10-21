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
export const MAX_TOPIC = 600;
const MAX_STYLE = 80;

export type Doubt = { question: string; say: string; titles: string[]; prev?: string };
export type LessonRequest = { topic: string; persona: (typeof PERSONAS)[number]; level: (typeof LEVELS)[number]; lang: (typeof LANGS)[number]; style: string; fromQuestion: boolean; doubt?: Doubt };
const pick = <T extends string>(list: readonly T[], v: unknown, dflt: T): T | null =>
  v == null || v === "" ? dflt : (list as readonly unknown[]).includes(v) ? (v as T) : null;

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
// Malformed doubt → undefined (the request is then an ordinary lesson).
function parseDoubt(d: any): Doubt | undefined {
  const question = str(d?.question, MAX_TOPIC);
  if (!question) return undefined;
  const titles = Array.isArray(d.titles) ? d.titles.slice(0, 8).map((t: unknown) => str(t, 80)).filter(Boolean) : [];
  return { question, say: str(d.say, 600), titles, ...(str(d.prev, MAX_TOPIC) && { prev: str(d.prev, MAX_TOPIC) }) };
}

// Returns { topic, persona, level, lang, style, fromQuestion, doubt? } with defaults filled in, or { error }.
export function parseLessonRequest(body: any): (LessonRequest & { error?: undefined }) | { error: string } {
  const topic = typeof body?.topic === "string" ? body.topic.trim() : "";
  if (!topic) return { error: "Type a topic to learn." };
  if (topic.length > MAX_TOPIC) return { error: `Topic is longer than ${MAX_TOPIC} characters.` };
  const persona = pick(PERSONAS, body?.persona, "teacher");
  const level = pick(LEVELS, body?.level, "middle");
  const lang = pick(LANGS, body?.lang, "en");
  if (!persona || !level || !lang) return { error: "Unknown persona, level or language." };
  const style = typeof body?.style === "string" ? body.style.replace(/\s+/g, " ").trim().slice(0, MAX_STYLE) : "";
  const doubt = parseDoubt(body?.doubt);
  return { topic, persona, level, lang, style, fromQuestion: body?.fromQuestion === true, ...(doubt && { doubt }) };
}
