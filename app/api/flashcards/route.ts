import { llmText } from "../../../lib/llm";
import { parseFlashcards, flashcardMessages } from "../../../lib/flashcards";
import { MAX_TOPIC } from "../../../lib/validate";

// shortcut: no auth or rate limit yet, add both before a public deploy.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const topic = typeof body?.topic === "string" ? body.topic.trim() : "";
  if (!topic) return Response.json({ error: "Topic is required." }, { status: 400 });
  if (topic.length > MAX_TOPIC) return Response.json({ error: `Topic is longer than ${MAX_TOPIC} characters.` }, { status: 400 });
  try {
    const cards = parseFlashcards(await llmText(flashcardMessages(topic), { temperature: 0.3, json: true, max_tokens: 2048 }));
    if (!cards.length) return Response.json({ error: "No flashcards." }, { status: 502 });
    return Response.json({ cards });
  } catch {
    return Response.json({ error: "Model failed." }, { status: 502 });
  }
}
