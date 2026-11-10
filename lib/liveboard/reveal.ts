export type SpeechMark =
  | number
  | {
      time?: number;
      timeMs?: number;
      startMs?: number;
      startChar?: number;
      endChar?: number;
      end?: number;
      value?: string;
      wordIndex?: number;
      [key: string]: any;
    };

/** Solvely's writing time for a block: 58 ms per character, clamped to 0.7–8 s. */
export const paceMs = (chars: number) => Math.max(700, Math.min(8000, chars * 58));

/** Characters visible without speech marks: max(previous, own 58 ms/char pace, voice progress). */
export function pacedCount(
  textLength: number,
  elapsedMs: number,
  audioProgress: number = 0,
  previousCount: number = 0
): number {
  if (textLength <= 0) return previousCount;
  const local = Math.min(1, Math.max(0, elapsedMs) / paceMs(textLength));
  const p = Math.max(local, Math.min(1, Math.max(0, audioProgress)));
  return Math.max(previousCount, Math.floor(textLength * p));
}

/**
 * Returns how many characters or words of the current step are visible.
 * Speech marks are scaled by realDuration / manifestDuration.
 * The result is monotonic: it never decreases during a step.
 */
export function revealCount(
  speechMarks: SpeechMark[] | undefined | null,
  audioTimeMs: number,
  realDurationMs: number,
  manifestDurationMs: number,
  previousCount: number = 0,
  textLength: number = 0
): number {
  if (audioTimeMs <= 0) {
    return previousCount;
  }

  const duration = realDurationMs > 0 ? realDurationMs : manifestDurationMs;
  if (duration <= 0) {
    return previousCount;
  }

  // Scaling factor from manifest timeline to real audio timeline
  const scale = manifestDurationMs > 0 && realDurationMs > 0 ? realDurationMs / manifestDurationMs : 1.0;

  if (speechMarks && speechMarks.length > 0) {
    let count = 0;

    for (let i = 0; i < speechMarks.length; i++) {
      const mark = speechMarks[i];
      const rawTime =
        typeof mark === "number"
          ? mark
          : (mark.timeMs ?? mark.time ?? mark.startMs ?? 0);
      const scaledTime = rawTime * scale;

      if (scaledTime <= audioTimeMs) {
        if (typeof mark === "object" && mark !== null) {
          if (typeof mark.endChar === "number") {
            count = mark.endChar;
          } else if (typeof mark.end === "number") {
            count = mark.end;
          } else if (typeof mark.wordIndex === "number") {
            count = mark.wordIndex + 1;
          } else {
            count = i + 1;
          }
        } else {
          count = i + 1;
        }
      } else {
        break;
      }
    }

    if (audioTimeMs >= realDurationMs && realDurationMs > 0) {
      const last = speechMarks[speechMarks.length - 1];
      if (typeof last === "object" && last !== null) {
        if (typeof last.endChar === "number") count = last.endChar;
        else if (typeof last.end === "number") count = last.end;
        else if (typeof last.wordIndex === "number") count = last.wordIndex + 1;
        else count = speechMarks.length;
      } else {
        count = speechMarks.length;
      }
    }

    return Math.max(previousCount, count);
  }

  // No marks: write at Solvely's pace, never behind the voice.
  const ratio = Math.min(1.0, audioTimeMs / duration);
  // shortcut: callers that pass no textLength keep the old 0–1000 scale, remove once every caller passes it.
  if (textLength <= 0) return Math.max(previousCount, Math.floor(ratio * 1000));
  return pacedCount(textLength, audioTimeMs, ratio, previousCount);
}

/** Longest note we accept. Longer means the model copied the narration; fall back to it. */
export const NOTE_MAX_CHARS = 160;

/** Returns a usable board note, or undefined when the step should fall back to the narration. */
export function cleanNote(note: unknown): string | undefined {
  if (typeof note !== "string") return undefined;
  const t = note.trim();
  if (!t || t.length > NOTE_MAX_CHARS) return undefined;
  return t;
}

/** The text the board writes for a step: the short note when there is one, else the narration. */
export function boardText(speech: { transcript?: string; note?: string }): string {
  return cleanNote(speech.note) ?? speech.transcript ?? "";
}

