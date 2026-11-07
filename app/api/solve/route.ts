import { parseSolveRequest } from "../../../lib/validate";
import { takeDeltas } from "../../../lib/sse";
import { llmChat } from "../../../lib/llm";
import { geminiText } from "../../../lib/gemini";

const SYSTEM =
  "You are StepWise, a patient tutor. Solve the student's problem step by step. " +
  "Number each step, explain why it works, and finish with a line starting 'Answer:'. " +
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
    return Response.json({ error: "The solver is unavailable. Try again shortly." }, { status: 502 });
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
