// Gnani (Vachana) speech-to-text: the browser posts a WAV, gets {text}. The key stays on the server.
// shortcut: no auth or rate limit yet, add both before a public deploy.
export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  const audio = form?.get("audio");
  if (!(audio instanceof Blob) || !audio.size || audio.size > 4_000_000) return Response.json({ error: "Send one recording under 4 MB." }, { status: 400 });
  const key = process.env.GNANI_API_KEY || process.env.EVON_API_KEY;
  if (!key) return Response.json({ error: "Voice input is not configured." }, { status: 503 });
  const body = new FormData();
  body.append("audio_file", audio, "question.wav");
  body.append("language_code", "en-IN");
  body.append("format", "transcribe");
  const res = await fetch("https://api.vachana.ai/stt/v3", { method: "POST", headers: { "X-API-Key-ID": key }, body }).catch(() => null);
  const json = await res?.json().catch(() => null);
  if (!res?.ok || !json?.success) return Response.json({ error: "Could not hear that. Try again." }, { status: 502 });
  return Response.json({ text: String(json.transcript ?? "").trim() });
}
