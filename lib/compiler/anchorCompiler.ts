// Anchor Compiler: Resolves Choreographer anchors {wordIndex, offsetMs} to absolute startMs from speech marks.
import type { ChoreographerCommand } from "../manifest.ts";
import type { SpeechMark } from "../tts/provider.ts";

export interface CompiledTiming {
  id: string;
  startMs: number;
  durationMs: number;
}

export function compileAnchors(
  commands: ChoreographerCommand[],
  speechMarks: SpeechMark[],
  totalAudioDurationMs: number
): Map<string, CompiledTiming> {
  const result = new Map<string, CompiledTiming>();
  if (commands.length === 0) return result;

  // Resolve startMs for each command
  const resolved: Array<{ cmd: ChoreographerCommand; startMs: number }> = [];

  for (const cmd of commands) {
    const { wordIndex, offsetMs = -150 } = cmd.anchor;
    let baseTimeMs = 0;

    if (speechMarks.length > 0) {
      if (wordIndex < speechMarks.length) {
        baseTimeMs = speechMarks[wordIndex].timeMs;
      } else {
        // Fallback: clamp to last word mark
        baseTimeMs = speechMarks[speechMarks.length - 1].timeMs;
      }
    } else {
      // Fallback if no marks available: distribute over audio duration
      baseTimeMs = Math.round((wordIndex / Math.max(1, commands.length)) * totalAudioDurationMs);
    }

    // Apply offset (negative offset means visual leads the word)
    const startMs = Math.max(0, Math.min(totalAudioDurationMs, baseTimeMs + offsetMs));
    resolved.push({ cmd, startMs });
  }

  // Sort by startMs
  resolved.sort((a, b) => a.startMs - b.startMs);

  // Compute durationMs:
  // Enforce a 300ms minimum on command DURATIONS only.
  // If two anchors land closer than 300ms, keep both start times and let animations overlap.
  for (let i = 0; i < resolved.length; i++) {
    const curr = resolved[i];
    let durationMs = 800; // default duration

    if (i < resolved.length - 1) {
      const nextStart = resolved[i + 1].startMs;
      const gap = nextStart - curr.startMs;
      // If gap is positive, scale duration to span toward next anchor, but clamp to [300ms, 1200ms]
      if (gap > 0) {
        durationMs = Math.max(300, Math.min(1200, gap));
      } else {
        // Overlapping anchors: keep 300ms minimum duration
        durationMs = 300;
      }
    } else {
      // Last command in step: span until end of audio or 1000ms
      const remaining = totalAudioDurationMs - curr.startMs;
      durationMs = Math.max(300, Math.min(1200, remaining > 0 ? remaining : 800));
    }

    result.set(curr.cmd.id, {
      id: curr.cmd.id,
      startMs: curr.startMs,
      durationMs,
    });
  }

  return result;
}
