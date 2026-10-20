// Shared Evon (OpenAI-compatible) chat call used by /api/solve and /api/lesson.
// shortcut: LLM_PROVIDER=gemini|groq routes through a hosted OpenAI-compatible endpoint until Evon is hosted; remove once EVON_BASE_URL points at the tunnel.
const PROVIDERS = {
  gemini: { url: "https://generativelanguage.googleapis.com/v1beta/openai", model: process.env.GEMINI_MODEL || "gemini-flash-latest", key: process.env.GEMINI_API_KEY },
  groq: { url: "https://api.groq.com/openai/v1", model: process.env.GROQ_MODEL || "openai/gpt-oss-120b", key: process.env.GROQ_API_KEY },
};
const HOSTED: (typeof PROVIDERS)["groq"] | undefined = PROVIDERS[process.env.LLM_PROVIDER as keyof typeof PROVIDERS];
const BASE_URL = HOSTED?.url ?? (process.env.EVON_BASE_URL || "http://localhost:8000/v1");
const MODEL = HOSTED?.model ?? (process.env.EVON_MODEL || "gnani/gnani-evon-v3.3-30B-A3B");
const API_KEY = HOSTED ? HOSTED.key : process.env.EVON_API_KEY;

export type Msg = { role: "system" | "user" | "assistant"; content: string };

// Returns the upstream Response (an SSE stream when stream is true); throws on network or HTTP errors.
export async function evonChat(messages: Msg[], opts: { stream?: boolean; temperature?: number; max_tokens?: number; json?: boolean } = {}) {
  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(API_KEY && { Authorization: `Bearer ${API_KEY}` }),
    },
    body: JSON.stringify({
      model: MODEL,
      stream: opts.stream ?? false,
      temperature: opts.temperature ?? 0.6,
      top_p: 0.95,
      max_tokens: opts.max_tokens ?? 2048,
      // Keep <think> output out of the student's answer; vLLM/SGLang honor this, Gemini and Groq reject it.
      ...(!HOSTED && { chat_template_kwargs: { enable_thinking: false } }),
      ...(opts.json && { response_format: { type: "json_object" } }),
      messages,
    }),
  });
  if (!res.ok) throw new Error(`LLM ${res.status}: ${await res.text()}`);
  return res;
}

// Non-streaming call → the assistant's text.
export async function evonText(messages: Msg[], opts: { temperature?: number; max_tokens?: number; json?: boolean } = {}) {
  const json = await (await evonChat(messages, opts)).json();
  return String(json.choices?.[0]?.message?.content ?? "");
}
