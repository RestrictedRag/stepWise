import type { Step } from "./board.ts";

// shortcut: character position, not real word timing; switch to per-phrase clips if the demo shows visible drift
export function shapeDelays(step: Step, clipSeconds: number): number[] {
  const say = step.say.toLowerCase();
  const n = step.draw.length;
  return step.draw.map((s, i) => {
    const pos = s.at ? say.indexOf(s.at.toLowerCase()) : -1;
    return pos >= 0 ? (pos / say.length) * clipSeconds : (i / n) * clipSeconds;
  });
}
