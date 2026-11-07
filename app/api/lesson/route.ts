import { llmText } from "../../../lib/llm";
import { generateLesson } from "../../../lib/lesson";
import { parseLessonRequest } from "../../../lib/validate";

// shortcut: no auth or rate limit yet, add both before a public deploy.
export async function POST(req: Request) {
  const parsed = parseLessonRequest(await req.json().catch(() => null));
  if (parsed.error !== undefined) return Response.json({ error: parsed.error }, { status: 400 });
  // 8192: the reasoning model spends tokens thinking first; 2048 cut lessons short.
  // generateLesson never throws on model failure: it falls back to a fixture or a text-only board.
  const { script, fallback } = await generateLesson(parsed, (msgs) => llmText(msgs, { temperature: 0.3, json: true, max_tokens: 8192 }));
  return Response.json({ script, fallback });
}
