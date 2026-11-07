import type { Image } from "./validate.ts";

const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.8-flash";
const GEMINI_FALLBACK = process.env.GEMINI_FALLBACK_MODEL || "gemini-3.6-flash"; // used when the main model stays overloaded

// One Gemini vision call: image + prompt in, text out. Throws on non-OK or empty reply.
export async function geminiText(image: Image, prompt: string, json = false): Promise<string> {
  const call = (model = GEMINI_MODEL) => fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY ?? "" },
      body: JSON.stringify({
        contents: [{ parts: [{ inline_data: { mime_type: image.mediaType, data: image.data } }, { text: prompt }] }],
        ...(json ? { generationConfig: { responseMimeType: "application/json" } } : {}),
      }),
    },
  );
  const busy = (r: Response) => r.status === 503 || r.status === 429;
  let res = await call();
  for (const wait of [1000, 2000]) { // overloaded (503) or rate-limited (429): back off and retry
    if (!busy(res)) break;
    await res.body?.cancel();
    await new Promise((r) => setTimeout(r, wait));
    res = await call();
  }
  if (busy(res) && GEMINI_FALLBACK !== GEMINI_MODEL) { await res.body?.cancel(); res = await call(GEMINI_FALLBACK); }
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const text = (data.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? "").join("").trim();
  if (!text) throw new Error("Gemini returned an empty reply.");
  return text;
}
