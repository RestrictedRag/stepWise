// Continuous Playback Engine: Pure mathematical state evaluator, latest-op-wins lifecycle,
// automatic connector cascade, and deterministic keyframed smoothstep camera.

import type {
  ContinuousLesson,
  TimelineOp,
  SolvedLayout,
  SolvedElement,
  SolvedConnector,
  ContinuousPlaybackState,
  ResolvedRenderElement,
  ResolvedRenderConnector,
  ActiveAnnotation,
  CameraTransform,
  ElementVisualState,
  Rect2D,
} from "./types.ts";
import { stripTagsAndExtractAnchors } from "./tagStripper.ts";

export interface TimedOp {
  id: string;
  stepId: string;
  stepIndex: number;
  startMs: number;
  durationMs: number;
  op: TimelineOp;
}

export interface CameraMoveSegment {
  startMs: number;
  endMs: number;
  from: CameraTransform;
  to: CameraTransform;
}

export interface ElementLifecycleEvent {
  tMs: number;
  type: "DRAW" | "DIM" | "RESTORE" | "ERASE";
  durationMs: number;
}

export interface CompiledContinuousTimeline {
  lessonId: string;
  totalDurationMs: number;
  layout: SolvedLayout;
  timedOps: TimedOp[];
  elementEvents: Map<string, ElementLifecycleEvent[]>;
  connectorEvents: Map<string, ElementLifecycleEvent[]>;
  cameraSegments: CameraMoveSegment[];
  initialCamera: CameraTransform;
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
  if (edge0 === edge1) return x >= edge1 ? 1 : 0;
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

export interface StepTimingSpec {
  stepIndex: number;
  startMs: number;
  durationMs: number;
  tagMarks?: Map<string, number>; // tag -> absolute startMs in speech
}

// Compile the continuous lesson into an absolute, queryable timeline
export function compileContinuousTimeline(
  lesson: ContinuousLesson,
  layout: SolvedLayout,
  stepTimings?: StepTimingSpec[]
): CompiledContinuousTimeline {
  const timedOps: TimedOp[] = [];
  let currentStepStartMs = 0;

  // Pass 1: Assign timestamps to all operations
  for (let sIdx = 0; sIdx < lesson.steps.length; sIdx++) {
    const step = lesson.steps[sIdx];
    const timingSpec = stepTimings?.[sIdx];
    const stepStartMs = timingSpec?.startMs ?? currentStepStartMs;
    const stepDurationMs = timingSpec?.durationMs ?? Math.max(4000, step.ops.length * 1500);

    const opsCount = Math.max(1, step.ops.length);
    const nominalOpDuration = Math.round(stepDurationMs / opsCount);

    for (let oIdx = 0; oIdx < step.ops.length; oIdx++) {
      const op = step.ops[oIdx];
      let opStartMs = stepStartMs + oIdx * nominalOpDuration;

      // If speech marks for tags exist, align to exact mark with -150ms lead
      if (timingSpec?.tagMarks?.has(op.anchor)) {
        const rawMarkMs = timingSpec.tagMarks.get(op.anchor)!;
        opStartMs = Math.max(stepStartMs, stepStartMs + rawMarkMs - 150);
      }

      let opDuration = 700;
      if (op.op === "DRAW") {
        opDuration = op.element.type === "connector" ? 500 : 800;
      } else if (op.op === "POINT") {
        opDuration = 1000;
      } else if (op.op === "CIRCLE" || op.op === "UNDERLINE") {
        opDuration = 600;
      } else if (op.op === "STRIKE") {
        opDuration = 400;
      } else if (op.op === "ERASE" || op.op === "DIM" || op.op === "RESTORE") {
        opDuration = 250;
      }

      timedOps.push({
        id: `op_${sIdx}_${oIdx}`,
        stepId: step.id,
        stepIndex: sIdx,
        startMs: opStartMs,
        durationMs: opDuration,
        op,
      });
    }

    currentStepStartMs = stepStartMs + stepDurationMs;
  }

  // Sort timedOps strictly by startMs
  timedOps.sort((a, b) => a.startMs - b.startMs);
  const totalDurationMs = Math.max(currentStepStartMs, timedOps[timedOps.length - 1]?.startMs + 1000 || 0);

  // Pass 2: Build element lifecycle event streams (Latest-Op-Wins)
  const elementEvents = new Map<string, ElementLifecycleEvent[]>();
  const connectorEvents = new Map<string, ElementLifecycleEvent[]>();

  for (const timed of timedOps) {
    const { op, startMs, durationMs } = timed;

    if (op.op === "DRAW") {
      const el = op.element;
      const targetMap = el.type === "connector" ? connectorEvents : elementEvents;
      const list = targetMap.get(el.id) ?? [];
      list.push({ tMs: startMs, type: "DRAW", durationMs });
      targetMap.set(el.id, list);
    } else if (op.op === "DIM" || op.op === "RESTORE" || op.op === "ERASE") {
      for (const targetId of op.targetIds) {
        const list = elementEvents.get(targetId) ?? [];
        list.push({ tMs: startMs, type: op.op, durationMs });
        elementEvents.set(targetId, list);
      }
    }
  }

  // Sort event lists by tMs
  for (const [, events] of elementEvents) {
    events.sort((a, b) => a.tMs - b.tMs);
  }

  // Pass 3: Rule 6 - Cascade DIM and ERASE to attached connectors automatically
  for (const [connId, conn] of layout.connectors) {
    const list = connectorEvents.get(connId) ?? [];
    const fromEvents = elementEvents.get(conn.fromId) ?? [];
    const toEvents = elementEvents.get(conn.toId) ?? [];

    for (const ev of fromEvents) {
      if (ev.type === "DIM" || ev.type === "ERASE") {
        list.push({ tMs: ev.tMs, type: ev.type, durationMs: ev.durationMs });
      }
    }

    for (const ev of toEvents) {
      if (ev.type === "DIM" || ev.type === "ERASE") {
        list.push({ tMs: ev.tMs, type: ev.type, durationMs: ev.durationMs });
      }
    }

    list.sort((a, b) => a.tMs - b.tMs);
    connectorEvents.set(connId, list);
  }

  // Pass 4: Build deterministic camera keyframes and transition segments
  const cameraSegments: CameraMoveSegment[] = [];

  let step0MinX = Infinity,
    step0MinY = Infinity,
    step0MaxX = -Infinity,
    step0MaxY = -Infinity;

  for (const timed of timedOps) {
    if (timed.stepIndex === 0 && timed.op.op === "DRAW" && timed.op.element.type !== "connector") {
      const el = layout.elements.get(timed.op.element.id);
      if (el) {
        step0MinX = Math.min(step0MinX, el.bounds.x);
        step0MinY = Math.min(step0MinY, el.bounds.y);
        step0MaxX = Math.max(step0MaxX, el.bounds.x + el.bounds.width);
        step0MaxY = Math.max(step0MaxY, el.bounds.y + el.bounds.height);
      }
    }
  }

  if (step0MinX === Infinity) {
    step0MinX = 300;
    step0MaxX = 700;
    step0MinY = 150;
    step0MaxY = 450;
  }

  const initialCx = Math.round((step0MinX + step0MaxX) / 2);
  const initialCy = Math.round((step0MinY + step0MaxY) / 2);
  const initialWidth = (step0MaxX - step0MinX) + 240;
  const initialHeight = (step0MaxY - step0MinY) + 200;
  const initialZoom = clamp(Math.min(1000 / initialWidth, 700 / initialHeight), 0.7, 1.1);

  const initialCamera: CameraTransform = {
    cx: initialCx,
    cy: initialCy,
    zoom: Math.round(initialZoom * 100) / 100,
  };

  let currentCam = { ...initialCamera };

  // Rule 5: Add camera keyframes whenever content would leave the view safe margin
  for (const timed of timedOps) {
    if (timed.op.op !== "DRAW" || timed.op.element.type === "connector") continue;

    const el = layout.elements.get(timed.op.element.id);
    if (!el) continue;

    const viewW = 1000 / currentCam.zoom;
    const viewH = 700 / currentCam.zoom;
    const safeMarginX = viewW * 0.12;
    const safeMarginY = viewH * 0.12;

    const safeMinX = currentCam.cx - viewW / 2 + safeMarginX;
    const safeMaxX = currentCam.cx + viewW / 2 - safeMarginX;
    const safeMinY = currentCam.cy - viewH / 2 + safeMarginY;
    const safeMaxY = currentCam.cy + viewH / 2 - safeMarginY;

    const isOutOfBounds =
      el.bounds.x < safeMinX ||
      el.bounds.x + el.bounds.width > safeMaxX ||
      el.bounds.y < safeMinY ||
      el.bounds.y + el.bounds.height > safeMaxY;

    if (isOutOfBounds) {
      const targetMinX = Math.min(el.bounds.x - 120, currentCam.cx - viewW / 4);
      const targetMaxX = Math.max(el.bounds.x + el.bounds.width + 120, currentCam.cx + viewW / 4);
      const targetMinY = Math.min(el.bounds.y - 100, currentCam.cy - viewH / 4);
      const targetMaxY = Math.max(el.bounds.y + el.bounds.height + 100, currentCam.cy + viewH / 4);

      const targetCx = Math.round((targetMinX + targetMaxX) / 2);
      const targetCy = Math.round((targetMinY + targetMaxY) / 2);
      const targetW = targetMaxX - targetMinX + 160;
      const targetH = targetMaxY - targetMinY + 140;
      const targetZoom = clamp(Math.min(1000 / targetW, 700 / targetH), 0.65, 1.15);

      const nextCam: CameraTransform = {
        cx: targetCx,
        cy: targetCy,
        zoom: Math.round(targetZoom * 100) / 100,
      };

      const moveDuration = 600;
      const moveStartMs = Math.max(0, timed.startMs - moveDuration);
      const moveEndMs = timed.startMs;

      cameraSegments.push({
        startMs: moveStartMs,
        endMs: moveEndMs,
        from: { ...currentCam },
        to: nextCam,
      });

      currentCam = nextCam;
    }
  }

  return {
    lessonId: lesson.id,
    totalDurationMs,
    layout,
    timedOps,
    elementEvents,
    connectorEvents,
    cameraSegments,
    initialCamera,
  };
}

// Evaluate visual opacity and drawProgress from event history (Pure latest-op-wins)
export function evaluateElementVisualAt(
  events: ElementLifecycleEvent[] | undefined,
  globalMs: number
): { opacity: number; drawProgress: number; state: ElementVisualState } {
  if (!events || events.length === 0) {
    return { opacity: 0, drawProgress: 0, state: "erased" };
  }

  const drawEv = events[0];
  if (globalMs < drawEv.tMs) {
    return { opacity: 0, drawProgress: 0, state: "erased" };
  }

  // Initial draw in progress
  if (globalMs < drawEv.tMs + drawEv.durationMs) {
    const p = smoothstep(drawEv.tMs, drawEv.tMs + drawEv.durationMs, globalMs);
    return {
      opacity: 1,
      drawProgress: p,
      state: "drawn",
    };
  }

  // Past initial draw: evaluate sequence of subsequent state events
  let currentState: ElementVisualState = "drawn";
  let currentOpacity = 1.0;

  for (let i = 1; i < events.length; i++) {
    const ev = events[i];
    if (globalMs < ev.tMs) break;

    const targetOpacity = ev.type === "DIM" ? 0.35 : ev.type === "ERASE" ? 0.0 : 1.0;
    const targetState: ElementVisualState =
      ev.type === "DIM" ? "dimmed" : ev.type === "ERASE" ? "erased" : "restored";

    const easeDuration = 250;
    if (globalMs < ev.tMs + easeDuration) {
      const alpha = smoothstep(ev.tMs, ev.tMs + easeDuration, globalMs);
      currentOpacity = lerp(currentOpacity, targetOpacity, alpha);
    } else {
      currentOpacity = targetOpacity;
    }

    currentState = targetState;
  }

  return {
    opacity: Math.round(currentOpacity * 100) / 100,
    drawProgress: 1.0,
    state: currentState,
  };
}

// Evaluate camera position at globalMs
export function evaluateCameraAt(
  timeline: CompiledContinuousTimeline,
  globalMs: number
): CameraTransform {
  if (timeline.cameraSegments.length === 0) {
    return timeline.initialCamera;
  }

  for (const seg of timeline.cameraSegments) {
    if (globalMs < seg.startMs) {
      return seg.from;
    }
    if (globalMs >= seg.startMs && globalMs <= seg.endMs) {
      const alpha = smoothstep(seg.startMs, seg.endMs, globalMs);
      return {
        cx: Math.round(lerp(seg.from.cx, seg.to.cx, alpha)),
        cy: Math.round(lerp(seg.from.cy, seg.to.cy, alpha)),
        zoom: Math.round(lerp(seg.from.zoom, seg.to.zoom, alpha) * 100) / 100,
      };
    }
  }

  return timeline.cameraSegments[timeline.cameraSegments.length - 1].to;
}

// Pure function of global time t
export function computeContinuousStateAt(
  timeline: CompiledContinuousTimeline,
  globalMs: number
): ContinuousPlaybackState {
  const camera = evaluateCameraAt(timeline, globalMs);

  const resolvedElements: ResolvedRenderElement[] = [];
  for (const [id, solved] of timeline.layout.elements) {
    const events = timeline.elementEvents.get(id);
    const { opacity, drawProgress, state } = evaluateElementVisualAt(events, globalMs);

    if (opacity > 0 || drawProgress > 0) {
      resolvedElements.push({
        id,
        state,
        opacity,
        drawProgress,
        solved,
      });
    }
  }

  const resolvedConnectors: ResolvedRenderConnector[] = [];
  for (const [id, solved] of timeline.layout.connectors) {
    const events = timeline.connectorEvents.get(id);
    const { opacity, drawProgress, state } = evaluateElementVisualAt(events, globalMs);

    if (opacity > 0 || drawProgress > 0) {
      resolvedConnectors.push({
        id,
        state,
        opacity,
        drawProgress,
        solved,
      });
    }
  }

  const activeAnnotations: ActiveAnnotation[] = [];
  for (const timed of timeline.timedOps) {
    const { op, startMs, durationMs } = timed;
    if (
      op.op === "CIRCLE" ||
      op.op === "UNDERLINE" ||
      op.op === "STRIKE" ||
      op.op === "POINT"
    ) {
      const endMs = startMs + durationMs;
      if (globalMs >= startMs) {
        const targetElem = timeline.layout.elements.get(op.targetId);
        if (!targetElem) continue;

        const targetVisual = evaluateElementVisualAt(timeline.elementEvents.get(op.targetId), globalMs);
        if (targetVisual.state === "erased" && targetVisual.opacity === 0) continue;

        const progress = clamp((globalMs - startMs) / Math.min(durationMs, 500), 0, 1);
        const smoothProgress = smoothstep(0, 1, progress);

        if (op.op === "POINT") {
          if (globalMs <= endMs) {
            activeAnnotations.push({
              id: timed.id,
              type: "POINT",
              targetId: op.targetId,
              progress: smoothProgress,
              bounds: targetElem.bounds,
              pointCoord: { x: targetElem.x, y: targetElem.y },
            });
          }
        } else {
          activeAnnotations.push({
            id: timed.id,
            type: op.op,
            targetId: op.targetId,
            color: "color" in op ? op.color : undefined,
            progress: smoothProgress,
            bounds: targetElem.bounds,
          });
        }
      }
    }
  }

  return {
    tMs: globalMs,
    camera,
    elements: resolvedElements,
    connectors: resolvedConnectors,
    annotations: activeAnnotations,
  };
}
