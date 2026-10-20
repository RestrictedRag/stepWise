import { parseBoardScript, type BoardScript } from "./board.ts";
import { lessonSystem } from "./prompts.ts";
import type { Msg } from "./llm.ts";
import type { LessonRequest } from "./validate.ts";
import cell from "./fixtures/cell.json" with { type: "json" };
import waterCycle from "./fixtures/water-cycle.json" with { type: "json" };
import pythagoras from "./fixtures/pythagoras.json" with { type: "json" };
import photosynthesis from "./fixtures/photosynthesis.json" with { type: "json" };

const FALLBACKS: [RegExp, unknown][] = [
  [/cell|nucleus|mitochond|organelle/i, cell],
  [/water|rain|evapor|condens|cloud/i, waterCycle],
  [/pythag|triangle|hypoten/i, pythagoras],
  [/photosynth|plant|leaf|chlorophyll/i, photosynthesis],
];

// Model text → parsed JSON value. Drops <think> blocks and any prose around the outermost object.
export function extractJson(text: string): unknown {
  const t = text.replace(/<think>[\s\S]*?<\/think>/g, "");
  const a = t.indexOf("{"), b = t.lastIndexOf("}");
  if (a < 0 || b < a) throw new Error("No JSON object in the reply.");
  return JSON.parse(t.slice(a, b + 1));
}

function tryParse(text: string): { script: BoardScript } | { error: string } {
  try {
    const r = parseBoardScript(extractJson(text));
    return r.error ? { error: r.error } : { script: r.script! };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

// Ask the LLM for a board script; one repair round on bad output, then a fixture or text-only fallback.
export async function generateLesson(req: LessonRequest, ask: (m: Msg[]) => Promise<string>): Promise<{ script: BoardScript; fallback: boolean }> {
  const messages: Msg[] = [
    { role: "system", content: lessonSystem(req) },
    { role: "user", content: `Topic: ${req.topic}` },
  ];
  let reply = "";
  try {
    reply = await ask(messages);
    let r = tryParse(reply);
    if ("error" in r) {
      reply = await ask([...messages, { role: "assistant", content: reply }, { role: "user", content: `That was not a valid board script: ${r.error} Reply with the corrected JSON object only.` }]);
      r = tryParse(reply);
    }
    if ("script" in r) return { script: r.script, fallback: false };
  } catch (e) {
    console.error(e);
  }
  const fixture = FALLBACKS.find(([re]) => re.test(req.topic))?.[1];
  const script = fixture
    ? parseBoardScript(fixture).script!
    : { title: req.topic.slice(0, 80), subtitle: "The board could not be drawn this time. Try again.", steps: [{ say: `Let's try ${req.topic} again in a moment.`, draw: [] }] };
  return { script, fallback: true };
}
