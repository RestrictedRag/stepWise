import { parseSolveRequest } from "../../../lib/validate";
import { takeDeltas } from "../../../lib/sse";
import { llmChat } from "../../../lib/llm";
import { geminiText } from "../../../lib/gemini";

const SYSTEM =
  "Solve the student's problem step by step, explain why each step works, and finish with a line starting 'Answer:'. " +
  "Start directly with the content: no greeting, no persona name, and no restating the question. " +
  "Write each step header on its own line starting with its number and a short noun phrase (for example '1. Define the Variables'), with no 'Step N:' prefix and no '#' characters—the UI renders step numbers. " +
  "Inside the summary, step bodies, and answer, use $...$ for inline math, $$...$$ on its own line for display math, '- ' for bullet points (never numbered lists inside steps), and **bold** for key terms. No headings inside a step body, no tables, and no code fences. " +
  "If the question is unclear, say what you can read and ask for clarification.";

// shortcut: no auth or rate limit yet, add per-IP/device limits before public deploy.
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON." }, { status: 400 });
  }
  const parsed = parseSolveRequest(body);
  if (parsed.error) return Response.json({ error: parsed.error }, { status: 400 });

  let question = parsed.text ?? "";
  if (parsed.image) {
    try {
      // The Groq model is text-only, so Gemini Flash turns the photo into text first.
      const transcript = await geminiText(parsed.image, "Transcribe the homework problem in this image exactly, as plain text. Write math inline (e.g. x^2 + 3x = 10). Output only the transcription; if unreadable, say so.");
      question = `Problem from the photo:\n${transcript}` + (parsed.text ? `\n\nStudent's note: ${parsed.text}` : "");
    } catch (err) {
      console.error(err);
      return Response.json({ error: "Could not read the photo. Try again or type the problem." }, { status: 502 });
    }
  }

  let upstream: Response;
  try {
    upstream = await llmChat([
      { role: "system", content: SYSTEM },
      { role: "user", content: question },
    ], { stream: true });
  } catch (err) {
    console.error(err);
    const limited = String(err).includes("rate-limited");
    return Response.json({ error: limited ? "The solver is rate-limited. Try again in a few minutes." : "The solver is unavailable. Try again shortly." }, { status: limited ? 429 : 502 });
  }

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  return new Response(
    new ReadableStream({
      async start(controller) {
        let buf = "";
        try {
          for await (const chunk of upstream.body!) {
            buf += decoder.decode(chunk, { stream: true });
            const { deltas, rest } = takeDeltas(buf);
            buf = rest;
            for (const t of deltas) controller.enqueue(encoder.encode(t));
          }
        } catch (err) {
          console.error(err);
          controller.enqueue(encoder.encode("\n\n[Error: could not finish solving. Try again.]"));
        }
        controller.close();
      },
    }),
    { headers: { "Content-Type": "text/plain; charset=utf-8" } },
  );
}
