// Pulls content deltas out of buffered OpenAI-style SSE text; returns the unfinished last line as `rest`.
export function takeDeltas(buf: string): { deltas: string[]; rest: string } {
  const lines = buf.split("\n");
  const rest = lines.pop() ?? "";
  const deltas: string[] = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (!line.startsWith("data:")) continue;
    const data = line.slice(5).trim();
    if (data === "[DONE]") continue;
    const text = JSON.parse(data).choices?.[0]?.delta?.content;
    if (text) deltas.push(text);
  }
  return { deltas, rest };
}
