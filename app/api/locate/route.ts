import { parseSolveRequest, MAX_TOPIC } from "../../../lib/validate";
import { geminiText } from "../../../lib/gemini";
import { parseLocate } from "../../../lib/locate";

const PROMPT = (ask: string) =>
  `This is one page of a student's PDF. Find the question the student means by: "${ask}". ` +
  `Reply only with JSON {"question": "<exact text of that question>", "bbox": [x, y, w, h]} where bbox is the ` +
  `question's bounding box as fractions of the page width and height (0 to 1, origin top-left). ` +
  `If you cannot find it, reply {"question": ""}.`;

// shortcut: no auth or rate limit yet, add per-IP/device limits before public deploy.
export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON." }, { status: 400 });
  }
  // The ask is later fed as a lesson topic, so cap it at MAX_TOPIC.
  const ask = typeof body?.ask === "string" ? body.ask.trim().slice(0, MAX_TOPIC) : "";
  const parsed = parseSolveRequest({ image: body?.image });
  if (parsed.error) return Response.json({ error: parsed.error }, { status: 400 });
  if (!parsed.image || !ask) return Response.json({ error: "Send a page image and what to find." }, { status: 400 });

  try {
    return Response.json(parseLocate(await geminiText(parsed.image, PROMPT(ask), true)));
  } catch (err) {
    console.error(err);
    return Response.json({ error: "Could not search the page. Try again." }, { status: 502 });
  }
}
