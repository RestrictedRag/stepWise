// Validator Gate: Enforces Zod schemas, unique IDs, reference temporal validity, key-term coverage,
// slot capacities, and 3-stage connector repair (fuzzy match -> LLM repair -> drop).

import {
  StepChoreographySchema,
  type StepChoreography,
  type CompiledCommand,
  type CompiledDrawCommand,
  type ChoreographerCommand,
  type MacroBlueprint,
} from "./manifest.ts";
import { BLUEPRINT_SLOTS } from "./layout/layoutEngine.ts";
import { tokenizeScript, findTermWordIndex } from "./tokenizer.ts";
import type { SpeechMark } from "./tts/provider.ts";

export interface VisualIntent {
  concept: string;
  keyTerms: string[];
  boardEndState?: string;
  macroBlueprint?: MacroBlueprint;
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

  // Stage 1: Deterministic fuzzy ID matcher (e.g. "leaf" -> "elem_leaf", "s0_leaf")
  public fuzzyMatchId(targetId: string, validIds: Set<string>): string | null {
    if (validIds.has(targetId)) return targetId;

    const lowerTarget = targetId.toLowerCase().trim();
    const candidates: string[] = [];

    for (const valid of validIds) {
      const lowerValid = valid.toLowerCase();
      if (lowerValid === lowerTarget) {
        return valid;
      }
      if (
        lowerValid.endsWith(`_${lowerTarget}`) ||
        lowerValid.startsWith(`${lowerTarget}_`) ||
        lowerValid.includes(lowerTarget) ||
        lowerTarget.includes(lowerValid)
      ) {
        candidates.push(valid);
      } else if (levenshteinDistance(lowerTarget, lowerValid) <= 2) {
        candidates.push(valid);
      }
    }

    if (candidates.length === 1) {
      return candidates[0];
    }
    return null;
  }

  // 3-Stage Repair Order:
  // 1. Deterministic fuzzy ID match.
  // 2. Returns unresolvable errors for 1-shot LLM repair.
  // 3. Drops unrepairable connectors (never force-snap to dominant subject).
  public repairChoreography(
    choreography: StepChoreography,
    validElementIds: Set<string>
  ): {
    repaired: StepChoreography;
    errors: string[];
    droppedCount: number;
    repairedCount: number;
  } {
    const currentValidIds = new Set<string>(validElementIds);
    const repairedCommands: ChoreographerCommand[] = [];
    const errors: string[] = [];
    let droppedCount = 0;
    let repairedCount = 0;

    for (const cmd of choreography.commands) {
      if (cmd.action === "DRAW") {
        currentValidIds.add(cmd.id);

        // Check if drawing connector (line or arrow)
        if (cmd.semanticObject.type === "line" || cmd.semanticObject.type === "arrow") {
          const so = cmd.semanticObject;
          let fromId = so.from ? (typeof so.from === "string" ? so.from : so.from.elementId) : so.fromId;
          let toId = so.to ? (typeof so.to === "string" ? so.to : so.to.elementId) : so.toId;

          // Attempt Stage 1 fuzzy match
          if (fromId && !currentValidIds.has(fromId)) {
            const match = this.fuzzyMatchId(fromId, currentValidIds);
            if (match) {
              if (so.from && typeof so.from === "object") so.from.elementId = match;
              else so.fromId = match;
              fromId = match;
              repairedCount++;
            }
          }

          if (toId && !currentValidIds.has(toId)) {
            const match = this.fuzzyMatchId(toId, currentValidIds);
            if (match) {
              if (so.to && typeof so.to === "object") so.to.elementId = match;
              else so.toId = match;
              toId = match;
              repairedCount++;
            }
          }

          // Check validity
          const fromValid = Boolean(fromId && currentValidIds.has(fromId));
          const toValid = Boolean(toId && currentValidIds.has(toId));
          const isSelfLoop = Boolean(fromId && toId && fromId === toId);

          if (!fromValid || !toValid || isSelfLoop) {
            errors.push(
              `Connector '${cmd.id}' has invalid endpoints (from: '${fromId}', to: '${toId}'). Dropping connector.`
            );
            droppedCount++;
            // Stage 3: DROP the connector. Do NOT add to repairedCommands.
            continue;
          }
        }

        repairedCommands.push(cmd);
      } else if (cmd.action === "HIGHLIGHT") {
        let tid = cmd.targetId;
        if (!currentValidIds.has(tid)) {
          const match = this.fuzzyMatchId(tid, currentValidIds);
          if (match) {
            cmd.targetId = match;
            repairedCount++;
          } else {
            errors.push(`HIGHLIGHT command '${cmd.id}' targets unknown '${tid}'.`);
          }
        }
        repairedCommands.push(cmd);
      } else if (cmd.action === "ERASE") {
        const repairedTargets: string[] = [];
        for (let tid of cmd.targetIds) {
          if (!currentValidIds.has(tid)) {
            const match = this.fuzzyMatchId(tid, currentValidIds);
            if (match) {
              repairedTargets.push(match);
              repairedCount++;
            } else {
              errors.push(`ERASE command '${cmd.id}' targets unknown '${tid}'.`);
            }
          } else {
            repairedTargets.push(tid);
          }
        }
        cmd.targetIds = repairedTargets;
        repairedCommands.push(cmd);
      } else {
        repairedCommands.push(cmd);
      }
    }

    return {
      repaired: {
        ...choreography,
        commands: repairedCommands,
      },
      errors,
      droppedCount,
      repairedCount,
    };
  }

  // 2. Full temporal, semantic, slot capacity, and connector integrity validation
  public validateCompiledStep(
    stepIndex: number,
    commands: CompiledCommand[],
    visualIntent: VisualIntent | undefined,
    speechMarks: SpeechMark[],
    scriptText: string,
    language: string,
    allPreviouslyDrawnIds: Set<string>,
    activeBlueprint?: MacroBlueprint,
    slotOccupancies: Map<string, number> = new Map(),
    elementLifecycles: Map<string, { enterMs: number; exitMs: number }> = new Map()
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const seenIds = new Set<string>();
    const drawnIds = new Set<string>(allPreviouslyDrawnIds);

    const bp = activeBlueprint || visualIntent?.macroBlueprint || "freeform";
    const bpSlots = BLUEPRINT_SLOTS[bp] || [];

    // Sort commands chronologically by startMs
    const sorted = [...commands].sort((a, b) => a.startMs - b.startMs);

    for (const cmd of sorted) {
      if (seenIds.has(cmd.id)) {
        errors.push(`Duplicate command ID '${cmd.id}' detected in step ${stepIndex}.`);
      }
      seenIds.add(cmd.id);

      if (cmd.action === "DRAW") {
        drawnIds.add(cmd.id);

        const drawCmd = cmd as CompiledDrawCommand;
        const enterMs = drawCmd.enterMs ?? drawCmd.startMs;
        const exitMs = drawCmd.exitMs ?? Infinity;
        elementLifecycles.set(cmd.id, { enterMs, exitMs });

        // Slot capacity enforcement
        if (drawCmd.slotId) {
          const currentCount = (slotOccupancies.get(drawCmd.slotId) || 0) + 1;
          slotOccupancies.set(drawCmd.slotId, currentCount);

          const slotDef = bpSlots.find((s) => s.id === drawCmd.slotId);
          if (slotDef && currentCount > slotDef.capacity) {
            errors.push(
              `Slot '${drawCmd.slotId}' in blueprint '${bp}' exceeded capacity (${currentCount}/${slotDef.capacity}). A TRANSITION is required.`
            );
          }
        }

        // Connector lifecycle validation
        if (drawCmd.shape.type === "line" || drawCmd.shape.type === "arrow") {
          const shape = drawCmd.shape as any;
          if (shape.fromId && shape.toId) {
            if (shape.fromId === shape.toId) {
              errors.push(`Connector '${cmd.id}' has self-loop endpoint '${shape.fromId}'.`);
            }

            const fromLife = elementLifecycles.get(shape.fromId);
            const toLife = elementLifecycles.get(shape.toId);

            if (fromLife && toLife) {
              const cmdStart = cmd.startMs;
              const cmdEnd = cmd.startMs + cmd.durationMs;

              if (cmdStart < fromLife.enterMs || cmdEnd > fromLife.exitMs) {
                warnings.push(
                  `Connector '${cmd.id}' active interval [${cmdStart}, ${cmdEnd}) falls outside source '${shape.fromId}' lifecycle [${fromLife.enterMs}, ${fromLife.exitMs}).`
                );
              }
              if (cmdStart < toLife.enterMs || cmdEnd > toLife.exitMs) {
                warnings.push(
                  `Connector '${cmd.id}' active interval [${cmdStart}, ${cmdEnd}) falls outside target '${shape.toId}' lifecycle [${toLife.enterMs}, ${toLife.exitMs}).`
                );
              }
            }
          }
        }
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
      } else if (cmd.action === "TRANSITION") {
        // Reset slot occupancies for preserved items across transition
        if (cmd.nextBlueprint) {
          const nextSlots = BLUEPRINT_SLOTS[cmd.nextBlueprint] || [];
          const totalNextCapacity = nextSlots.reduce((sum, s) => sum + s.capacity, 0);
          if (cmd.preserve.length > totalNextCapacity) {
            errors.push(
              `Preserved elements count (${cmd.preserve.length}) exceeds total capacity of next blueprint '${cmd.nextBlueprint}' (${totalNextCapacity}).`
            );
          }
        }
      }
    }

    // Key-term Coverage Check
    if (visualIntent && visualIntent.keyTerms && visualIntent.keyTerms.length > 0) {
      const { tokens } = tokenizeScript(scriptText, language);

      for (const term of visualIntent.keyTerms) {
        const wIdx = findTermWordIndex(tokens, term, language);
        if (wIdx === null || wIdx >= speechMarks.length) {
          warnings.push(`Key term '${term}' was not found in spoken tokens or speech marks.`);
          continue;
        }

        const wordTimeMs = speechMarks[wIdx].timeMs;
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

// Levenshtein distance helper
function levenshteinDistance(s1: string, s2: string): number {
  const m = s1.length;
  const n = s2.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }

  return dp[m][n];
}

export const manifestValidator = new ManifestValidator();
