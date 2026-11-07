import test from "node:test";
import assert from "node:assert/strict";

test("falls back to the second model when the main one stays overloaded", async () => {
  const urls: string[] = [];
  globalThis.fetch = (async (url: string) => {
    urls.push(url);
    return url.includes("gemini-3.6-flash")
      ? Response.json({ candidates: [{ content: { parts: [{ text: "ok" }] } }] })
      : new Response("busy", { status: 503 });
  }) as typeof fetch;
  const { geminiText } = await import("./gemini.ts");
  assert.equal(await geminiText({ mediaType: "image/png", data: "" } as any, "hi"), "ok");
  assert.equal(urls.length, 4); // 3 tries on the main model, then 1 on the fallback
});
