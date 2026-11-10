/**
 * Text pacing and KaTeX progressive clip-path calculation for Solvely whiteboard.
 */

/**
 * Counts grapheme clusters using Intl.Segmenter, accurately handling
 * combining characters, emoji, and multi-byte scripts.
 */
export function countGraphemes(text: string): number {
  if (!text) return 0;
  if (typeof Intl !== "undefined" && (Intl as any).Segmenter) {
    const segmenter = new (Intl as any).Segmenter(undefined, { granularity: "grapheme" });
    let count = 0;
    for (const _ of segmenter.segment(text)) {
      count++;
    }
    return count;
  }
  return Array.from(text).length;
}

/**
 * Calculates number of grapheme units revealed given elapsed milliseconds,
 * playback speed, and pacing cadence (default 58ms/grapheme).
 */
export function calcTextRevealUnits(
  graphemeCount: number,
  elapsedMs: number,
  speed: number = 1.0,
  paceMs: number = 58
): number {
  if (elapsedMs <= 0 || graphemeCount <= 0) return 0;
  const effectivePace = paceMs / Math.max(0.1, speed);
  const units = Math.floor(elapsedMs / effectivePace);
  return Math.min(graphemeCount, Math.max(0, units));
}

/**
 * Calculates progressive reveal percentage [0.0, 1.0] for math formulas or elements
 * to drive CSS horizontal clipping: `clipPath: inset(0 calc(100% - P*100%) 0 0)`.
 */
export function calcMathClipPercent(
  elapsedMs: number,
  durationMs: number = 1000,
  startMs: number = 0
): number {
  if (durationMs <= 0) return 1.0;
  if (elapsedMs <= startMs) return 0.0;
  if (elapsedMs >= startMs + durationMs) return 1.0;
  return (elapsedMs - startMs) / durationMs;
}

export interface TextSegment {
  type: "text" | "math";
  raw: string;
  mathContent?: string;
  displayMode?: boolean;
  startIdx: number;
  endIdx: number;
}

/**
 * Splits transcript into plain text and KaTeX math segments with exact character boundaries.
 */
export function splitTextSegments(src: string): TextSegment[] {
  if (!src) return [];
  const segments: TextSegment[] = [];
  const MATH = /\s*\\\[([\s\S]+?)\\\]\s*|\$\$([\s\S]+?)\$\$|\\\(([\s\S]+?)\\\)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = MATH.exec(src)) !== null) {
    if (match.index > lastIndex) {
      const text = src.slice(lastIndex, match.index);
      segments.push({
        type: "text",
        raw: text,
        startIdx: lastIndex,
        endIdx: match.index,
      });
    }

    const raw = match[0];
    const block = match[1];
    const dollars = match[2];
    const inline = match[3];
    const mathContent = block ?? dollars ?? inline;
    const displayMode = inline === undefined;

    segments.push({
      type: "math",
      raw,
      mathContent,
      displayMode,
      startIdx: match.index,
      endIdx: match.index + raw.length,
    });

    lastIndex = match.index + raw.length;
  }

  if (lastIndex < src.length) {
    segments.push({
      type: "text",
      raw: src.slice(lastIndex),
      startIdx: lastIndex,
      endIdx: src.length,
    });
  }

  return segments;
}
