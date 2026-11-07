// Shared Groq (OpenAI-compatible) chat call used by /api/solve and /api/lesson.
const BASE_URL = "https://api.groq.com/openai/v1";
const MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-120b";
const API_KEY = process.env.GROQ_API_KEY;

export type Msg = { role: "system" | "user" | "assistant"; content: string };

function parseGroqWaitMs(errText: string): number | null {
  const mMatch = errText.match(/try again in (?:(\d+)m)?(\d+(?:\.\d+)?)s/i);
  if (mMatch) {
    const mins = mMatch[1] ? parseInt(mMatch[1], 10) : 0;
    const secs = parseFloat(mMatch[2]);
    return Math.ceil((mins * 60 + secs) * 1000);
  }
  const msMatch = errText.match(/try again in (\d+(?:\.\d+)?)ms/i);
  if (msMatch) {
    return Math.ceil(parseFloat(msMatch[1]));
  }
  return null;
}

// Returns the upstream Response (an SSE stream when stream is true); throws on network or HTTP errors.
export async function llmChat(messages: Msg[], opts: { stream?: boolean; temperature?: number; max_tokens?: number; json?: boolean } = {}) {
  if (!API_KEY) throw new Error("GROQ_API_KEY is not set");

  const call = (json?: boolean) => fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${API_KEY}` },
    body: JSON.stringify({
      model: MODEL,
      stream: opts.stream ?? false,
      temperature: opts.temperature ?? 0.6,
      top_p: 0.95,
      max_tokens: opts.max_tokens ?? 1024,
      ...(json && { response_format: { type: "json_object" } }),
      messages,
    }),
  });

  for (let attempt = 0; attempt < 5; attempt++) {
    let res = await call(opts.json);

    // Groq json_validate_failed (400): retry as free text, extractJson parses it
    if (opts.json && res.status === 400) {
      await res.body?.cancel();
      res = await call(false);
    }

    // Rate-limited (429) or overloaded (503): back off and retry with exact duration
    if (res.status === 429 || res.status === 503) {
      const errText = await res.text().catch(() => "");
      const waitMs = parseGroqWaitMs(errText) ?? (attempt + 1) * 1000;
      console.warn(`[LLM] Groq 429 rate limit hit. Waiting ${waitMs}ms before retry (attempt ${attempt + 1}/5)...`);
      await new Promise((r) => setTimeout(r, Math.max(100, waitMs + 200)));
      continue;
    }

    if (!res.ok) throw new Error(`LLM ${res.status}: ${await res.text()}`);
    return res;
  }

  throw new Error("LLM request failed after retries.");
}

// Non-streaming call → the assistant's text.
export async function llmText(messages: Msg[], opts: { temperature?: number; max_tokens?: number; json?: boolean } = {}) {
  const json = await (await llmChat(messages, opts)).json();
  return String(json.choices?.[0]?.message?.content ?? "");
}
