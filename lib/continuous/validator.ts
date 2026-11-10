// Continuous Lesson Validator: Structured verification, chronological existence checks,
// anchor validation, and deterministic auto-repair (fuzzy ID match & dropping dangling ops).

import type {
  ContinuousLesson,
  ContinuousStep,
  TimelineOp,
  CanvasElement,
  ConnectorElement,
} from "./types.ts";
import { stripTagsAndExtractAnchors } from "./tagStripper.ts";

export type ValidationErrorCode =
  | "ANCHOR_TAG_NOT_FOUND"
  | "DUPLICATE_ELEMENT_ID"
  | "PARENT_NOT_FOUND"
  | "PARENT_DEFINED_IN_FUTURE"
  | "CONNECTOR_TARGET_NOT_FOUND"
  | "CONNECTOR_TARGET_FUTURE"
  | "CONNECTOR_SELF_LOOP"
  | "TARGET_NOT_FOUND"
  | "TARGET_ALREADY_ERASED"
  | "INVALID_SHAPE_TYPE"
  | "INVALID_COLOR_TOKEN"
  | "INVALID_SIZE_TOKEN";

export interface ValidationError {
  code: ValidationErrorCode;
  stepId: string;
  stepIndex: number;
  opIndex: number;
  message: string;
  targetId?: string;
  elementId?: string;
  fatal: boolean;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  repairedLesson?: ContinuousLesson;
}

// Levenshtein distance for fuzzy ID repair
function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }

  return dp[m][n];
}

function findFuzzyMatch(target: string, candidates: Iterable<string>, maxDist = 2): string | null {
  let bestMatch: string | null = null;
  let bestDist = Infinity;

  for (const cand of candidates) {
    const dist = levenshteinDistance(target.toLowerCase(), cand.toLowerCase());
    if (dist <= maxDist && dist < bestDist) {
      bestDist = dist;
      bestMatch = cand;
    }
  }

  return bestMatch;
}

export function validateContinuousLesson(lesson: ContinuousLesson): ValidationResult {
  const errors: ValidationError[] = [];

  // Track element IDs seen in the entire lesson
  const allDeclaredIds = new Set<string>();
  // Pre-scan all elements to detect duplicates and distinguish "future" vs "never exists"
  for (let sIdx = 0; sIdx < lesson.steps.length; sIdx++) {
    const step = lesson.steps[sIdx];
    for (let oIdx = 0; oIdx < step.ops.length; oIdx++) {
      const op = step.ops[oIdx];
      if (op.op === "DRAW") {
        const id = op.element.id;
        if (allDeclaredIds.has(id)) {
          errors.push({
            code: "DUPLICATE_ELEMENT_ID",
            stepId: step.id,
            stepIndex: sIdx,
            opIndex: oIdx,
            elementId: id,
            message: `Element ID "${id}" is declared more than once in the lesson.`,
            fatal: true,
          });
        }
        allDeclaredIds.add(id);
      }
    }
  }

  // Chronological verification pass
  const drawnSoFar = new Set<string>();
  const erasedSoFar = new Set<string>();

  for (let sIdx = 0; sIdx < lesson.steps.length; sIdx++) {
    const step = lesson.steps[sIdx];
    const { declaredTags } = stripTagsAndExtractAnchors(step.narration);

    for (let oIdx = 0; oIdx < step.ops.length; oIdx++) {
      const op = step.ops[oIdx];

      // Check 1: Anchor tag must exist in step narration
      if (!declaredTags.has(op.anchor)) {
        errors.push({
          code: "ANCHOR_TAG_NOT_FOUND",
          stepId: step.id,
          stepIndex: sIdx,
          opIndex: oIdx,
          message: `Op anchor "[${op.anchor}]" was not declared in step narration: "${step.narration}"`,
          fatal: false, // can be repaired by auto-adding tag
        });
      }

      if (op.op === "DRAW") {
        const el = op.element;

        if (el.type === "connector") {
          // Check 2: Connector self-loop
          if (el.from === el.to) {
            errors.push({
              code: "CONNECTOR_SELF_LOOP",
              stepId: step.id,
              stepIndex: sIdx,
              opIndex: oIdx,
              elementId: el.id,
              message: `Connector "${el.id}" cannot connect element "${el.from}" to itself.`,
              fatal: true,
            });
          }

          // Check 3: Connector timing: 'from' must already be drawn
          if (!drawnSoFar.has(el.from)) {
            const isFuture = allDeclaredIds.has(el.from);
            errors.push({
              code: isFuture ? "CONNECTOR_TARGET_FUTURE" : "CONNECTOR_TARGET_NOT_FOUND",
              stepId: step.id,
              stepIndex: sIdx,
              opIndex: oIdx,
              elementId: el.id,
              targetId: el.from,
              message: isFuture
                ? `Connector "${el.id}" connects from "${el.from}" which has not been drawn yet.`
                : `Connector "${el.id}" connects from non-existent element "${el.from}".`,
              fatal: true,
            });
          }

          // Check 4: Connector timing: 'to' must already be drawn
          if (!drawnSoFar.has(el.to)) {
            const isFuture = allDeclaredIds.has(el.to);
            errors.push({
              code: isFuture ? "CONNECTOR_TARGET_FUTURE" : "CONNECTOR_TARGET_NOT_FOUND",
              stepId: step.id,
              stepIndex: sIdx,
              opIndex: oIdx,
              elementId: el.id,
              targetId: el.to,
              message: isFuture
                ? `Connector "${el.id}" connects to "${el.to}" which has not been drawn yet.`
                : `Connector "${el.id}" connects to non-existent element "${el.to}".`,
              fatal: true,
            });
          }
        } else {
          // Shape / Text / Latex
          if (el.placement.type === "relative") {
            const relId = el.placement.relativeTo;
            if (!drawnSoFar.has(relId)) {
              const isFuture = allDeclaredIds.has(relId);
              errors.push({
                code: isFuture ? "PARENT_DEFINED_IN_FUTURE" : "PARENT_NOT_FOUND",
                stepId: step.id,
                stepIndex: sIdx,
                opIndex: oIdx,
                elementId: el.id,
                targetId: relId,
                message: isFuture
                  ? `Element "${el.id}" placed relative to "${relId}", which is declared in a later step.`
                  : `Element "${el.id}" placed relative to non-existent element "${relId}".`,
                fatal: true,
              });
            }
          }
        }

        drawnSoFar.add(el.id);
      } else if (op.op === "DIM" || op.op === "RESTORE" || op.op === "ERASE") {
        for (const targetId of op.targetIds) {
          if (!drawnSoFar.has(targetId)) {
            errors.push({
              code: "TARGET_NOT_FOUND",
              stepId: step.id,
              stepIndex: sIdx,
              opIndex: oIdx,
              targetId,
              message: `Op ${op.op} targets non-existent element "${targetId}".`,
              fatal: false,
            });
          } else if (erasedSoFar.has(targetId)) {
            errors.push({
              code: "TARGET_ALREADY_ERASED",
              stepId: step.id,
              stepIndex: sIdx,
              opIndex: oIdx,
              targetId,
              message: `Op ${op.op} targets element "${targetId}" which was already erased.`,
              fatal: false,
            });
          }

          if (op.op === "ERASE") {
            erasedSoFar.add(targetId);
          }
        }
      } else if (op.op === "POINT" || op.op === "CIRCLE" || op.op === "UNDERLINE" || op.op === "STRIKE") {
        if (!drawnSoFar.has(op.targetId)) {
          errors.push({
            code: "TARGET_NOT_FOUND",
            stepId: step.id,
            stepIndex: sIdx,
            opIndex: oIdx,
            targetId: op.targetId,
            message: `Annotation ${op.op} targets non-existent element "${op.targetId}".`,
            fatal: false,
          });
        } else if (erasedSoFar.has(op.targetId)) {
          errors.push({
            code: "TARGET_ALREADY_ERASED",
            stepId: step.id,
            stepIndex: sIdx,
            opIndex: oIdx,
            targetId: op.targetId,
            message: `Annotation ${op.op} targets element "${op.targetId}" which was already erased.`,
            fatal: false,
          });
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// Deterministic 3-stage repair:
// 1. Fuzzy match misspelled target/parent IDs
// 2. Auto-inject missing [tag] into narration
// 3. Drop unresolvable dangling connectors or redundant erased ops
export function repairContinuousLesson(lesson: ContinuousLesson): ContinuousLesson {
  const cloned: ContinuousLesson = JSON.parse(JSON.stringify(lesson));
  const knownElements = new Set<string>();

  for (let sIdx = 0; sIdx < cloned.steps.length; sIdx++) {
    const step = cloned.steps[sIdx];
    const { declaredTags } = stripTagsAndExtractAnchors(step.narration);
    const validOps: TimelineOp[] = [];

    for (let oIdx = 0; oIdx < step.ops.length; oIdx++) {
      const op = step.ops[oIdx];

      // Fix missing anchor: if anchor not in step narration, append [anchor] to narration
      if (!declaredTags.has(op.anchor)) {
        step.narration = `${step.narration} [${op.anchor}]`;
        declaredTags.add(op.anchor);
      }

      if (op.op === "DRAW") {
        const el = op.element;

        if (el.type === "connector") {
          // Try fuzzy match for 'from'
          if (!knownElements.has(el.from)) {
            const match = findFuzzyMatch(el.from, knownElements);
            if (match) el.from = match;
          }

          // Try fuzzy match for 'to'
          if (!knownElements.has(el.to)) {
            const match = findFuzzyMatch(el.to, knownElements);
            if (match) el.to = match;
          }

          // If still invalid, drop the connector
          if (!knownElements.has(el.from) || !knownElements.has(el.to) || el.from === el.to) {
            console.warn(
              `[Validator Repair] Dropping invalid connector "${el.id}": from="${el.from}" (known: ${knownElements.has(
                el.from
              )}), to="${el.to}" (known: ${knownElements.has(el.to)})`
            );
            continue; // Drop connector
          }
        } else {
          // Shape / Text / Latex: try fuzzy match for relativeTo
          if (el.placement.type === "relative") {
            if (!knownElements.has(el.placement.relativeTo)) {
              const match = findFuzzyMatch(el.placement.relativeTo, knownElements);
              if (match) {
                el.placement.relativeTo = match;
              } else {
                // Fallback to root placement below current board
                console.warn(
                  `[Validator Repair] Converting orphan element "${el.id}" from relativeTo="${el.placement.relativeTo}" to root`
                );
                el.placement = { type: "root" };
              }
            }
          }
        }

        knownElements.add(el.id);
        validOps.push(op);
      } else if (op.op === "DIM" || op.op === "RESTORE" || op.op === "ERASE") {
        const validTargets: string[] = [];
        for (const tid of op.targetIds) {
          if (knownElements.has(tid)) {
            validTargets.push(tid);
          } else {
            const match = findFuzzyMatch(tid, knownElements);
            if (match) validTargets.push(match);
          }
        }
        if (validTargets.length > 0) {
          op.targetIds = validTargets;
          validOps.push(op);
        }
      } else if (op.op === "POINT" || op.op === "CIRCLE" || op.op === "UNDERLINE" || op.op === "STRIKE") {
        if (!knownElements.has(op.targetId)) {
          const match = findFuzzyMatch(op.targetId, knownElements);
          if (match) {
            op.targetId = match;
            validOps.push(op);
          }
        } else {
          validOps.push(op);
        }
      }
    }

    step.ops = validOps;
  }

  return cloned;
}

