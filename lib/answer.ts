export type Parsed = { summary: string; steps: { title: string; body: string }[]; answer: string | null; error: boolean };

const ERR = /\[Error: could not finish solving[^\]]*\]?/;
const STEP = /^\s*\**\s*(?:Step\s*)?(\d+)[.):]\s*(.*?)\**\s*$/i; // tolerate **Step 1: x**

export function parseAnswer(text: string): Parsed {
  const error = ERR.test(text);
  const lines = text.replace(ERR, "").split("\n");
  const summary: string[] = [];
  const steps: { title: string; body: string[] }[] = [];
  let answer: string[] | null = null;
  for (const line of lines) {
    if (answer) { answer.push(line); continue; }
    const a = line.match(/^\s*\**Answer\**\s*:\**\s*(.*)$/i); // tolerate **Answer:**
    if (a) { answer = [a[1]]; continue; }
    const m = line.match(STEP);
    if (m) steps.push({ title: m[2].trim(), body: [] });
    else if (steps.length) steps[steps.length - 1].body.push(line);
    else summary.push(line);
  }
  return {
    summary: summary.join("\n").trim(),
    steps: steps.map((s) => ({ title: s.title, body: s.body.join("\n").trim() })),
    answer: answer ? answer.join("\n").trim() : null,
    error,
  };
}

// stream ended with no Answer line and no error marker: the model stopped early
export const incomplete = (p: Parsed) => p.answer === null && !p.error;
