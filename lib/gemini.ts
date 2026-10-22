import type { Image } from "./validate.ts";

const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.8-flash";

// One Gemini vision call: image + prompt in, text out. Throws on non-OK or empty reply.
export async function geminiText(image: Image, prompt: string, json = false): Promise<string> {
  const call = () => fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY ?? "" },
      body: JSON.stringify({
        contents: [{ parts: [{ inline_data: { mime_type: image.mediaType, data: image.data } }, { text: prompt }] }],
        ...(json ? { generationConfig: { responseMimeType: "application/json" } } : {}),
      }),
    },
  );
  let res = await call();
  for (const wait of [1000, 2000]) { // overloaded (503) or rate-limited (429): back off and retry
    if (res.status !== 503 && res.status !== 429) break;
    await new Promise((r) => setTimeout(r, wait));
    res = await call();
  }
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const text = (data.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? "").join("").trim();
  if (!text) throw new Error("Gemini returned an empty reply.");
  return text;
}
