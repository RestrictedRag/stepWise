// Validator Gate: Enforces Zod schemas, unique IDs, reference temporal validity, and key-term coverage.
import { StepChoreographySchema, type StepChoreography, type CompiledCommand } from "./manifest.ts";
import { tokenizeScript, findTermWordIndex, type ScriptWordToken } from "./tokenizer.ts";
import type { SpeechMark } from "./tts/provider.ts";

export interface VisualIntent {
  concept: string;
  keyTerms: string[];
  boardEndState?: string;
}

export interface ValidationIssue {
  severity: "error" | "warning";
  code: string;
  message: string;
  commandId?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export class ManifestValidator {
  // 1. Validates Choreographer raw LLM output against Zod schema
  public validateChoreography(data: unknown): { parsed: StepChoreography | null; errors: string[] } {
    const res = StepChoreographySchema.safeParse(data);
    if (!res.success) {
      const errors = res.error.issues.map((iss) => `${iss.path.join(".")}: ${iss.message}`);
      return { parsed: null, errors };
    }
    return { parsed: res.data, errors: [] };
  }

  // 2. Full temporal and semantic integrity validation on compiled step
  public validateCompiledStep(
    stepIndex: number,
    commands: CompiledCommand[],
    visualIntent: VisualIntent | undefined,
    speechMarks: SpeechMark[],
    scriptText: string,
    language: string,
    allPreviouslyDrawnIds: Set<string>
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const seenIds = new Set<string>();
    const drawnIds = new Set<string>(allPreviouslyDrawnIds);

    // Sort commands chronologically by startMs
    const sorted = [...commands].sort((a, b) => a.startMs - b.startMs);

    // Rule 1 & 2: Unique IDs and Prior-Drawn Target Reference
    for (const cmd of sorted) {
      if (seenIds.has(cmd.id)) {
        errors.push(`Duplicate command ID '${cmd.id}' detected in step ${stepIndex}.`);
      }
      seenIds.add(cmd.id);

      if (cmd.action === "DRAW") {
        drawnIds.add(cmd.id);
      } else if (cmd.action === "HIGHLIGHT") {
        if (!drawnIds.has(cmd.targetId)) {
          errors.push(
            `HIGHLIGHT command '${cmd.id}' targets '${cmd.targetId}' which was not drawn prior to ${cmd.startMs}ms.`
          );
        }
      } else if (cmd.action === "ERASE") {
        for (const tid of cmd.targetIds) {
          if (!drawnIds.has(tid)) {
            errors.push(
              `ERASE command '${cmd.id}' targets '${tid}' which was not drawn prior to ${cmd.startMs}ms.`
            );
          }
        }
      }
    }

    // Rule 3: Key-term Coverage Check
    // Each key term in visualIntent must have a visual starting within 500ms of its spoken word
    if (visualIntent && visualIntent.keyTerms && visualIntent.keyTerms.length > 0) {
      const { tokens } = tokenizeScript(scriptText, language);

      for (const term of visualIntent.keyTerms) {
        const wIdx = findTermWordIndex(tokens, term, language);
        if (wIdx === null || wIdx >= speechMarks.length) {
          warnings.push(`Key term '${term}' was not found in spoken tokens or speech marks.`);
          continue;
        }

        const wordTimeMs = speechMarks[wIdx].timeMs;
        // Find closest command start time
        let minGap = Infinity;
        for (const cmd of commands) {
          const gap = Math.abs(cmd.startMs - wordTimeMs);
          if (gap < minGap) minGap = gap;
        }

        if (minGap > 500) {
          warnings.push(
            `Key term '${term}' spoken at ${wordTimeMs}ms has no visual within 500ms (closest is ${minGap}ms gap).`
          );
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }
}

export const manifestValidator = new ManifestValidator();
