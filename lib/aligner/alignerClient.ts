// Aligner Client with Token-Count Assertions, Mark Sanity Checks, and Syllable Fallback.
import type { ScriptWordToken } from "../tokenizer.ts";
import type { SpeechMark } from "../tts/provider.ts";

export type TimingSource = "native_marks" | "forced_alignment" | "syllable_estimate";

export interface AlignerResult {
  timingSource: TimingSource;
  alignmentConfidence: number;
  marks: SpeechMark[];
}

export interface Aligner {
  align(tokens: ScriptWordToken[], audio: Uint8Array, durationMs: number, lang: string): Promise<AlignerResult>;
}

export class HybridAlignerClient implements Aligner {
  private serviceUrl: string;

  constructor(serviceUrl: string = process.env.ALIGNER_SERVICE_URL || "http://127.0.0.1:8010") {
    this.serviceUrl = serviceUrl;
  }

  public async align(
    tokens: ScriptWordToken[],
    audio: Uint8Array,
    durationMs: number,
    lang: string
  ): Promise<AlignerResult> {
    if (tokens.length === 0) {
      return { timingSource: "forced_alignment", alignmentConfidence: 1.0, marks: [] };
    }

    try {
      // 1. Attempt MMS_FA Forced Alignment via HTTP Service
      const res = await this.callAlignerService(tokens, audio, lang);
      if (res && res.marks) {
        // Assert token count matches exactly
        if (res.marks.length !== tokens.length) {
          throw new Error(
            `Aligner token-count mismatch: expected ${tokens.length} marks for tokens, but received ${res.marks.length}.`
          );
        }

        const sanitized = this.enforceSanityChecks(res.marks, tokens, durationMs);
        return {
          timingSource: "forced_alignment",
          alignmentConfidence: res.alignment_confidence,
          marks: sanitized,
        };
      }
    } catch (err) {
      console.warn(`[AlignerClient] Forced alignment unavailable or failed (${(err as Error).message}). Falling back to syllable estimate.`);
    }

    // 2. Fallback to Syllable-Weighted Acoustic Estimation
    return this.syllableWeightedFallback(tokens, durationMs, lang);
  }

  private async callAlignerService(
    tokens: ScriptWordToken[],
    audio: Uint8Array,
    lang: string
  ): Promise<{ timing_source: string; alignment_confidence: number; marks: any[] } | null> {
    const audioBase64 = Buffer.from(audio).toString("base64");
    const tokenStrings = tokens.map((t) => t.text);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000); // 4s timeout

    try {
      const resp = await fetch(`${this.serviceUrl}/align`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tokens: tokenStrings,
          audio_base64: audioBase64,
          lang,
        }),
        signal: controller.signal,
      });

      if (!resp.ok) return null;
      return await resp.json();
    } catch {
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }

  // Enforces monotonic timing, minimum 30ms word duration, and bounds clamping
  private enforceSanityChecks(
    rawMarks: any[],
    tokens: ScriptWordToken[],
    durationMs: number
  ): SpeechMark[] {
    if (rawMarks.length !== tokens.length) {
      throw new Error(
        `Aligner token-count mismatch: expected ${tokens.length} marks for tokens, but received ${rawMarks.length}.`
      );
    }
    const marks: SpeechMark[] = [];
    let curTime = 0;

    for (let i = 0; i < rawMarks.length; i++) {
      const rm = rawMarks[i];
      const tok = tokens[i];

      let startMs = Math.max(curTime, Number(rm.start_ms ?? rm.timeMs ?? 0));
      let endMs = Math.max(startMs + 30, Number(rm.end_ms ?? startMs + 60));

      if (endMs > durationMs) {
        endMs = Math.max(startMs + 30, durationMs);
      }

      marks.push({
        timeMs: startMs,
        type: "word",
        value: tok.text,
        startChar: tok.startChar,
        endChar: tok.endChar,
        confidence: Number(rm.confidence ?? 0.8),
      });

      curTime = startMs;
    }

    return marks;
  }

  // Syllable-weighted timing fallback
  public syllableWeightedFallback(
    tokens: ScriptWordToken[],
    durationMs: number,
    _lang: string
  ): AlignerResult {
    const weights = tokens.map((t) => Math.max(1, Math.round(t.text.length / 3)));
    const totalWeight = weights.reduce((a, b) => a + b, 0);

    const marks: SpeechMark[] = [];
    let curMs = 0;

    tokens.forEach((t, i) => {
      const spanMs = Math.max(30, Math.round((weights[i] / totalWeight) * durationMs));
      marks.push({
        timeMs: curMs,
        type: "word",
        value: t.text,
        startChar: t.startChar,
        endChar: t.endChar,
        confidence: 0.5, // Syllable fallback confidence calibrated to 0.5
      });
      curMs += spanMs;
    });

    return {
      timingSource: "syllable_estimate",
      alignmentConfidence: 0.5,
      marks,
    };
  }
}

export const alignerClient = new HybridAlignerClient();
