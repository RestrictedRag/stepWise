// StepWise Manifest: Zod-validated Schemas for Anchored Choreography & Compiled Engine Playback.
import { z } from "zod";
import type { Shape, BoardScript } from "./board.ts";

export const CANVAS_WIDTH = 1000;
export const CANVAS_HEIGHT = 700;
export const CANVAS_W = CANVAS_WIDTH;
export const CANVAS_H = CANVAS_HEIGHT;

export function validateLessonManifest(data: unknown): { manifest: LessonManifest | null; errors: string[] } {
  if (!data || typeof data !== "object") {
    return { manifest: null, errors: ["Manifest must be an object."] };
  }
  const d = data as any;
  if (!d.title || typeof d.title !== "string") {
    return { manifest: null, errors: ["Missing or invalid title."] };
  }
  if (!Array.isArray(d.steps) || d.steps.length === 0) {
    return { manifest: null, errors: ["Steps must be a non-empty array."] };
  }
  return { manifest: data as LessonManifest, errors: [] };
}

export const ColorSchema = z.enum(["ink", "purple", "orange", "green", "red", "blue"]);
export type Color = z.infer<typeof ColorSchema>;

// Semantic Objects supported in the first slice (NO raw coordinates from LLM)
export const SemanticLabelSchema = z.object({
  type: z.literal("label"),
  labelKey: z.string(),
  noteKey: z.string().optional(),
  attachToId: z.string().optional(),
  position: z.enum(["center", "top", "bottom", "left", "right", "margin_left", "margin_right"]).optional(),
});

export const SemanticLineSchema = z.object({
  type: z.enum(["line", "arrow"]),
  fromId: z.string().optional(),
  toId: z.string().optional(),
  direction: z.enum(["left_to_right", "right_to_left", "top_to_bottom", "bottom_to_top", "point_to_part"]).optional(),
});

export const SemanticCircleSchema = z.object({
  type: z.literal("circle"),
  size: z.enum(["sm", "md", "lg"]).default("md"),
  zone: z.enum(["center", "left", "right"]).default("center"),
});

export const SemanticRectSchema = z.object({
  type: z.literal("rect"),
  size: z.enum(["sm", "md", "lg"]).default("md"),
  zone: z.enum(["center", "left", "right"]).default("center"),
});

export const SemanticNumberLineSchema = z.object({
  type: z.literal("number_line"),
  min: z.number(),
  max: z.number(),
  step: z.number().default(1),
  highlightValues: z.array(z.number()).optional(),
});

export const SemanticTriangleSchema = z.object({
  type: z.literal("triangle"),
  kind: z.enum(["right", "equilateral", "isosceles", "generic"]).default("generic"),
  sideLabelKeys: z.array(z.string()).optional(),
});

export const SemanticFormulaSchema = z.object({
  type: z.literal("formula"),
  latex: z.string(),
});

export const SemanticFunctionPlotterSchema = z.object({
  type: z.literal("function_plotter"),
  f: z.string(),
  xDomain: z.tuple([z.number(), z.number()]).default([-5, 5]),
  yDomain: z.tuple([z.number(), z.number()]).default([-5, 5]),
  zone: z.enum(["center", "left", "right"]).default("center"),
});

export const SemanticCoordinatePlaneSchema = z.object({
  type: z.literal("coordinate_plane"),
  xDomain: z.tuple([z.number(), z.number()]).default([-5, 5]),
  yDomain: z.tuple([z.number(), z.number()]).default([-5, 5]),
  grid: z.boolean().default(true),
  points: z.array(z.tuple([z.number(), z.number()])).optional(),
  zone: z.enum(["center", "left", "right"]).default("center"),
});

// Rare escape hatch for custom organic shapes (e.g. organelles)
export const SemanticPathEscapeSchema = z.object({
  type: z.literal("path"),
  d: z.string().regex(/^[MLHVCSQTAZmlhvcsqtaz0-9 ,.\-]{1,2000}$/),
});

export const SemanticObjectSchema = z.discriminatedUnion("type", [
  SemanticLabelSchema,
  SemanticLineSchema,
  SemanticCircleSchema,
  SemanticRectSchema,
  SemanticNumberLineSchema,
  SemanticTriangleSchema,
  SemanticFormulaSchema,
  SemanticFunctionPlotterSchema,
  SemanticCoordinatePlaneSchema,
  SemanticPathEscapeSchema,
]);
export type SemanticObject = z.infer<typeof SemanticObjectSchema>;

// Anchor linking command to spoken word index with relative offset
export const AnchorSchema = z.object({
  wordIndex: z.number().int().min(0),
  offsetMs: z.number().default(-150), // Default leads the word by 150ms
});
export type Anchor = z.infer<typeof AnchorSchema>;

// Choreographer Output Commands (Pre-Compilation)
export const ChoreographerDrawCommandSchema = z.object({
  id: z.string(),
  action: z.literal("DRAW"),
  anchor: AnchorSchema,
  semanticObject: SemanticObjectSchema,
  color: ColorSchema.default("ink"),
});

export const ChoreographerHighlightCommandSchema = z.object({
  id: z.string(),
  action: z.literal("HIGHLIGHT"),
  anchor: AnchorSchema,
  targetId: z.string(),
  style: z.enum(["pulse", "marker"]).default("pulse"),
});

export const ChoreographerEraseCommandSchema = z.object({
  id: z.string(),
  action: z.literal("ERASE"),
  anchor: AnchorSchema,
  targetIds: z.array(z.string()).min(1),
  technique: z.enum(["fade", "reverse_dash"]).default("fade"),
});

export const ChoreographerCommandSchema = z.discriminatedUnion("action", [
  ChoreographerDrawCommandSchema,
  ChoreographerHighlightCommandSchema,
  ChoreographerEraseCommandSchema,
]);
export type ChoreographerCommand = z.infer<typeof ChoreographerCommandSchema>;

export const StepChoreographySchema = z.object({
  stepIndex: z.number().int().min(0),
  labels: z.record(z.string(), z.string()), // Localized text map: labelKey -> localized string
  commands: z.array(ChoreographerCommandSchema),
});
export type StepChoreography = z.infer<typeof StepChoreographySchema>;

// Compiled Manifest: Fully resolved timestamps (startMs, durationMs) & 1000x700 coordinates
export interface CompiledDrawCommand {
  id: string;
  action: "DRAW";
  startMs: number;
  durationMs: number;
  shape: Shape;
  color: Color;
}

export interface CompiledHighlightCommand {
  id: string;
  action: "HIGHLIGHT";
  startMs: number;
  durationMs: number;
  targetId: string;
  style: "pulse" | "marker";
}

export interface CompiledEraseCommand {
  id: string;
  action: "ERASE";
  startMs: number;
  durationMs: number;
  targetIds: string[];
  technique: "fade" | "reverse_dash";
}

export type CompiledCommand = CompiledDrawCommand | CompiledHighlightCommand | CompiledEraseCommand;

export interface CompiledStepManifest {
  stepIndex: number;
  speech: {
    audioUrl?: string;
    durationMs: number;
    transcript: string;
    timingSource: "native_marks" | "forced_alignment" | "syllable_estimate";
    alignmentConfidence: number;
    speechMarks: Array<{
      timeMs: number;
      type: "word";
      value: string;
      startChar: number;
      endChar: number;
      confidence?: number;
    }>;
  };
  commands: CompiledCommand[];
}

export interface LessonManifest {
  version: "1.0.0";
  lessonId: string;
  language: string;
  title: string;
  subtitle?: string | null;
  steps: CompiledStepManifest[];
  metadata: {
    generatedAt: string;
    virtualCanvas: { width: 1000; height: 700 };
  };
}

// Backward compatibility adapter for legacy fixtures (cell.json, etc.)
export function boardScriptToManifest(script: BoardScript, stepDurationsMs?: number[], lang: string = "en"): LessonManifest {
  const steps: CompiledStepManifest[] = script.steps.map((step, sIdx) => {
    const durationMs = stepDurationsMs?.[sIdx] ?? Math.max(3000, step.say.split(/\s+/).length * 400);
    const words = step.say.split(/\s+/).filter(Boolean);
    const marks: CompiledStepManifest["speech"]["speechMarks"] = [];
    let curChar = 0;
    const msPerWord = words.length > 0 ? durationMs / words.length : durationMs;

    words.forEach((w, wIdx) => {
      const idx = step.say.toLowerCase().indexOf(w.toLowerCase(), curChar);
      const startChar = idx >= 0 ? idx : curChar;
      const endChar = startChar + w.length;
      curChar = endChar;
      marks.push({
        timeMs: Math.round(wIdx * msPerWord),
        type: "word",
        value: w,
        startChar,
        endChar,
        confidence: 0.5,
      });
    });

    const commands: CompiledCommand[] = [];
    const n = step.draw.length;

    step.draw.forEach((shape, shIdx) => {
      const elemId = `s${sIdx}_elem${shIdx}`;
      let startMs = Math.round((shIdx / Math.max(1, n)) * durationMs * 0.85);

      if (shape.at) {
        const atLower = shape.at.toLowerCase();
        const mark = marks.find((m) => atLower.includes(m.value.toLowerCase()));
        if (mark) startMs = Math.max(0, mark.timeMs - 150);
      }

      commands.push({
        id: elemId,
        action: "DRAW",
        startMs,
        durationMs: Math.max(300, Math.min(1200, Math.round(durationMs / Math.max(1, n)))),
        shape,
        color: shape.color,
      });
    });

    commands.sort((a, b) => a.startMs - b.startMs);

    return {
      stepIndex: sIdx,
      speech: {
        durationMs,
        transcript: step.say,
        timingSource: "syllable_estimate",
        alignmentConfidence: 0.5,
        speechMarks: marks,
      },
      commands,
    };
  });

  return {
    version: "1.0.0",
    lessonId: `legacy-${Date.now()}`,
    language: lang,
    title: script.title,
    subtitle: script.subtitle,
    steps,
    metadata: {
      generatedAt: new Date().toISOString(),
      virtualCanvas: { width: 1000, height: 700 },
    },
  };
}
