import { LANGS } from "../../../lib/validate";
// Vachana (Gnani) text-to-speech: the key stays on the server, the browser gets mp3 bytes.
// shortcut: no auth or rate limit yet, add both before a public deploy.
const LANG_CODE = { en: "en-IN", hi: "hi-IN", kn: "kn-IN", ta: "ta-IN" } as const;

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  if (!text || text.length > 600) return Response.json({ error: "Text must be 1-600 characters." }, { status: 400 });
  const lang = (LANGS as readonly unknown[]).includes(body?.lang) ? (body.lang as keyof typeof LANG_CODE) : "en";
  // shortcut: EVON_API_KEY is the old name, drop the fallback once .env.local says GNANI_API_KEY.
  const key = process.env.GNANI_API_KEY || process.env.EVON_API_KEY;
  if (!key) return Response.json({ error: "Voice is not configured." }, { status: 503 });

  const res = await fetch("https://api.vachana.ai/api/v1/tts/inference", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-Key-ID": key },
    body: JSON.stringify({
      text, model: "timbre-v2.5", voice: "Kaveri", language: LANG_CODE[lang],
      audio_config: { sample_rate: 24000, num_channels: 1, sample_width: 2, encoding: "linear_pcm", container: "mp3", bitrate: "64k" },
    }),
  }).catch(() => null);
  if (!res?.ok || !res.body) {
    if (res) console.error("speak", res.status, await res.text().catch(() => ""));
    return Response.json({ error: "Voice is unavailable right now." }, { status: 502 });
  }
  return new Response(res.body, { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "private, max-age=3600" } });
}
