// Shared Groq (OpenAI-compatible) chat call used by /api/solve and /api/lesson.
const BASE_URL = "https://api.groq.com/openai/v1";
const MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-120b";
const API_KEY = process.env.GROQ_API_KEY;

export type Msg = { role: "system" | "user" | "assistant"; content: string };

// Returns the upstream Response (an SSE stream when stream is true); throws on network or HTTP errors.
export async function llmChat(messages: Msg[], opts: { stream?: boolean; temperature?: number; max_tokens?: number; json?: boolean } = {}) {
  if (!API_KEY) throw new Error("GROQ_API_KEY is not set");
  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${API_KEY}` },
    body: JSON.stringify({
      model: MODEL,
      stream: opts.stream ?? false,
      temperature: opts.temperature ?? 0.6,
      top_p: 0.95,
      max_tokens: opts.max_tokens ?? 2048,
      ...(opts.json && { response_format: { type: "json_object" } }),
      messages,
    }),
  });
  if (!res.ok) throw new Error(`LLM ${res.status}: ${await res.text()}`);
  return res;
}

// Non-streaming call → the assistant's text.
export async function llmText(messages: Msg[], opts: { temperature?: number; max_tokens?: number; json?: boolean } = {}) {
  const json = await (await llmChat(messages, opts)).json();
  return String(json.choices?.[0]?.message?.content ?? "");
}
