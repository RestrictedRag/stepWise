import { llmText } from "../../../lib/llm";
import { generateLesson } from "../../../lib/lesson";
import { parseLessonRequest } from "../../../lib/validate";
import { streamLessonManifest } from "../../../lib/pipeline";
import { boardScriptToManifest } from "../../../lib/manifest";

// shortcut: no auth or rate limit yet, add both before a public deploy.
export async function POST(req: Request) {
  const parsed = parseLessonRequest(await req.json().catch(() => null));
  if (parsed.error !== undefined) return Response.json({ error: parsed.error }, { status: 400 });

  // For doubts, use targeted short doubt generator
  if (parsed.doubt) {
    const { script, fallback } = await generateLesson(parsed, (msgs) =>
      llmText(msgs, { temperature: 0.3, json: true, max_tokens: 1536 })
    );
    const manifest = boardScriptToManifest(script);
    return Response.json({ manifest, script, fallback });
  }

  // Multi-Stage Animation Pipeline: Pedagogy Agent -> Parallel TTS/Alignment -> Choreographer Agent -> Validator
  try {
    const ask = (msgs: any[], maxTokens = 2500) => llmText(msgs, { temperature: 0.3, json: true, max_tokens: maxTokens });
    const generator = streamLessonManifest(parsed, ask);

    let result = await generator.next();
    while (!result.done) {
      result = await generator.next();
    }
    const manifest = result.value;
    return Response.json({ manifest });
  } catch (err) {
    console.error("streamLessonManifest FAILED with error:", err);
    // Robust fallback to generateLesson + boardScriptToManifest
    const { script, fallback } = await generateLesson(parsed, (msgs) =>
      llmText(msgs, { temperature: 0.3, json: true, max_tokens: 1200 })
    );
    const manifest = boardScriptToManifest(script);
    return Response.json({ manifest, script, fallback });
  }
}
