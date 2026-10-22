import test from "node:test";
import assert from "node:assert/strict";

test("json call retries once without response_format on a 400", async () => {
  process.env.GROQ_API_KEY = "test";
  const bodies: Record<string, unknown>[] = [];
  globalThis.fetch = (async (_url: string, init: RequestInit) => {
    bodies.push(JSON.parse(String(init.body)));
    return bodies.length === 1 ? new Response("bad", { status: 400 }) : Response.json({ choices: [{ message: { content: "ok" } }] });
  }) as typeof fetch;
  const { llmText } = await import("./llm.ts");
  assert.equal(await llmText([{ role: "user", content: "hi" }], { json: true }), "ok");
  assert.equal(bodies.length, 2);
  assert.ok(bodies[0].response_format); assert.equal(bodies[1].response_format, undefined);
});
