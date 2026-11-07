// StepWise Manifest: The atomic contract between backend choreography and client playback.
import type { Color, Icon, Shape, Step, BoardScript } from "./board.ts";

export const CANVAS_W = 1000;
export const CANVAS_H = 700;

export type ManifestCommandType = "DRAW" | "HIGHLIGHT" | "ERASE" | "CAMERA_ZOOM" | "EXECUTE_SANDBOX";

export interface SpeechMark {
  timeMs: number;     // Absolute timestamp within audio clip (ms)
  type: "word";
  value: string;      // Spoken word
  startChar: number;
  endChar: number;
}

export interface BaseVectorCommand {
  id: string;                      // Deterministic unique element ID
  action: ManifestCommandType;
  startMs: number;                 // Scheduled start relative to step audio (ms)
  durationMs: number;              // Animation duration (ms)
  easing?: string;                 // GSAP easing string (e.g. "power2.out")
}

export type DrawShapePayload =
  | { type: "line" | "arrow"; from: [number, number]; to: [number, number]; strokeWidth?: number }
  | { type: "circle"; x: number; y: number; r: number }
  | { type: "ellipse"; x: number; y: number; rx: number; ry: number }
  | { type: "rect"; x: number; y: number; w: number; h: number; rx?: number }
  | { type: "path"; d: string }
  | { type: "latex"; x: number; y: number; tex: string; fontSize: number }
  | { type: "label"; x: number; y: number; text: string; note?: string | null }
  | { type: "text"; x: number; y: number; text: string; size: number }
  | { type: "icon"; x: number; y: number; name: Icon };

export interface DrawCommand extends BaseVectorCommand {
  action: "DRAW";
  targetLayer: "dynamicVector";
  shape: DrawShapePayload;
  style: {
    color: Color;
    strokeWidth?: number;
    dashArray?: number;
    showStylus?: boolean;
  };
}

export interface HighlightCommand extends BaseVectorCommand {
  action: "HIGHLIGHT";
  targetElementId: string;         // References previously drawn element ID
  style: "pulse" | "halo" | "marker_stroke";
  color?: Color;
  intensity?: number;
}

export interface EraseCommand extends BaseVectorCommand {
  action: "ERASE";
  targetElementIds: string[];      // Element IDs to remove or mask
  technique: "mask_wipe" | "reverse_stroke" | "scribble_mask";
}

export interface CameraZoomCommand extends BaseVectorCommand {
  action: "CAMERA_ZOOM";
  targetViewport: { x: number; y: number; width: number; height: number };
}

export interface SandboxCommand extends BaseVectorCommand {
  action: "EXECUTE_SANDBOX";
  sandboxId: string;
  widgetType?: "function_plotter" | "coordinate_grid" | "geometry_matrix";
  params?: Record<string, unknown>;
  customScriptPayload?: string;
}

export type VectorCommand =
  | DrawCommand
  | HighlightCommand
  | EraseCommand
  | CameraZoomCommand
  | SandboxCommand;

export interface StepManifest {
  stepIndex: number;
  speech: {
    audioUrl?: string;
    durationMs: number;
    transcript: string;
    speechMarks: SpeechMark[];
  };
  commands: VectorCommand[];
}

export interface LessonManifest {
  lessonId: string;
  title: string;
  subtitle?: string | null;
  steps: StepManifest[];
  metadata: {
    generatedAt: string;
    virtualCanvas: { width: number; height: number };
  };
}

// Convert legacy BoardScript to LessonManifest for full backward compatibility
export function boardScriptToManifest(script: BoardScript, stepDurationsMs?: number[]): LessonManifest {
  const steps: StepManifest[] = script.steps.map((step, sIdx) => {
    const durationMs = stepDurationsMs?.[sIdx] ?? Math.max(3000, step.say.split(/\s+/).length * 400);
    const words = step.say.split(/\s+/).filter(Boolean);
    const speechMarks: SpeechMark[] = [];
    let curChar = 0;
    const msPerWord = words.length > 0 ? durationMs / words.length : durationMs;

    words.forEach((w, wIdx) => {
      const idx = step.say.toLowerCase().indexOf(w.toLowerCase(), curChar);
      const startChar = idx >= 0 ? idx : curChar;
      const endChar = startChar + w.length;
      curChar = endChar;
      speechMarks.push({
        timeMs: Math.round(wIdx * msPerWord),
        type: "word",
        value: w,
        startChar,
        endChar,
      });
    });

    const commands: VectorCommand[] = [];
    const n = step.draw.length;

    step.draw.forEach((shape, shIdx) => {
      const elemId = `s${sIdx}_elem${shIdx}`;
      let startMs = Math.round((shIdx / Math.max(1, n)) * durationMs * 0.85);

      if (shape.at) {
        const atLower = shape.at.toLowerCase();
        const mark = speechMarks.find((m) => atLower.includes(m.value.toLowerCase()));
        if (mark) startMs = mark.timeMs;
      }

      const drawPayload = shapeToDrawPayload(shape);
      if (drawPayload) {
        commands.push({
          id: elemId,
          action: "DRAW",
          targetLayer: "dynamicVector",
          startMs,
          durationMs: Math.min(1200, Math.max(500, Math.round(durationMs / Math.max(1, n)))),
          easing: "power2.out",
          shape: drawPayload,
          style: {
            color: shape.color,
            strokeWidth: shape.type === "highlight" ? 24 : 3,
            showStylus: shape.type !== "text" && shape.type !== "label",
          },
        });
      }
    });

    // Sort commands chronologically by startMs
    commands.sort((a, b) => a.startMs - b.startMs);

    return {
      stepIndex: sIdx,
      speech: {
        durationMs,
        transcript: step.say,
        speechMarks,
      },
      commands,
    };
  });

  return {
    lessonId: `legacy-${Date.now()}`,
    title: script.title,
    subtitle: script.subtitle,
    steps,
    metadata: {
      generatedAt: new Date().toISOString(),
      virtualCanvas: { width: CANVAS_W, height: CANVAS_H },
    },
  };
}

function shapeToDrawPayload(shape: Shape): DrawShapePayload | null {
  switch (shape.type) {
    case "line":
    case "arrow":
    case "highlight":
      return { type: shape.type === "highlight" ? "line" : shape.type, from: shape.from, to: shape.to };
    case "circle":
      return { type: "circle", x: shape.x, y: shape.y, r: shape.r };
    case "ellipse":
      return { type: "ellipse", x: shape.x, y: shape.y, rx: shape.rx, ry: shape.ry };
    case "rect":
      return { type: "rect", x: shape.x, y: shape.y, w: shape.w, h: shape.h };
    case "path":
      return { type: "path", d: shape.d };
    case "text":
      return { type: "text", x: shape.x, y: shape.y, text: shape.text, size: shape.size };
    case "label":
      return { type: "label", x: shape.x, y: shape.y, text: shape.text, note: shape.note };
    case "icon":
      return { type: "icon", x: shape.x, y: shape.y, name: shape.name };
    default:
      return null;
  }
}

// Validator for StepManifest and LessonManifest
export function validateLessonManifest(data: unknown): { manifest: LessonManifest | null; errors: string[] } {
  const errors: string[] = [];
  if (!data || typeof data !== "object") {
    return { manifest: null, errors: ["Manifest root must be an object."] };
  }

  const d = data as Record<string, unknown>;
  if (typeof d.title !== "string" || !d.title.trim()) {
    errors.push("Missing or invalid manifest title.");
  }

  if (!Array.isArray(d.steps) || d.steps.length === 0) {
    errors.push("Manifest must contain at least one step.");
  }

  const steps: StepManifest[] = [];
  if (Array.isArray(d.steps)) {
    d.steps.forEach((s, i) => {
      if (!s || typeof s !== "object") {
        errors.push(`Step [${i}] is not an object.`);
        return;
      }
      const stepObj = s as Record<string, unknown>;
      const speech = stepObj.speech as Record<string, unknown> | undefined;
      if (!speech || typeof speech.transcript !== "string") {
        errors.push(`Step [${i}] missing speech transcript.`);
      }
      if (typeof speech?.durationMs !== "number" || speech.durationMs <= 0) {
        errors.push(`Step [${i}] missing or invalid durationMs.`);
      }
      if (!Array.isArray(stepObj.commands)) {
        errors.push(`Step [${i}] commands must be an array.`);
      }

      steps.push(s as StepManifest);
    });
  }

  if (errors.length > 0) {
    return { manifest: null, errors };
  }

  return { manifest: data as LessonManifest, errors: [] };
}

