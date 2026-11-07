// StepWise Multi-Stage Pipeline: Parallel TTS + Alignment, Sequential Choreographer, and Streaming Manifest
import { pedagogyPrompt, choreographerPrompt } from "./prompts.ts";
import { normalizer } from "./normalizer.ts";
import { tokenizeScript } from "./tokenizer.ts";
import { getTtsProvider } from "./tts/registry.ts";
import { alignerClient } from "./aligner/alignerClient.ts";
import { compileAnchors } from "./compiler/anchorCompiler.ts";
import { layoutEngine, type LayoutContext } from "./layout/layoutEngine.ts";
import { manifestValidator } from "./validator.ts";
import { extractJson } from "./lesson.ts";
import type { LessonRequest } from "./validate.ts";
import type { Msg } from "./llm.ts";
import type {
  LessonManifest,
  CompiledStepManifest,
  CompiledCommand,
  StepChoreography,
} from "./manifest.ts";

export interface PedagogyStep {
  say: string;
  visualIntent: {
    concept: string;
    keyTerms: string[];
    macroBlueprint?: "process_flow" | "anatomy_structure" | "mathematical_derivation" | "comparison" | "cycle" | "freeform";
    boardEndState?: string;
  };
}

export interface PedagogyOutput {
  title: string;
  subtitle: string | null;
  steps: PedagogyStep[];
}

export async function* streamLessonManifest(
  req: LessonRequest,
  ask: (msgs: Msg[]) => Promise<string>
): AsyncGenerator<CompiledStepManifest, LessonManifest, void> {
  const lang = req.lang || "en";

  // Step 1: Upfront Pedagogy Call
  const pedPrompt = pedagogyPrompt(req);
  const pedReply = await ask([
    { role: "system", content: "You are a master educator. Reply strictly in JSON." },
    { role: "user", content: pedPrompt },
  ]);

  let pedData: PedagogyOutput;
  try {
    pedData = extractJson(pedReply) as PedagogyOutput;
  } catch {
    // 1-shot repair
    const repairReply = await ask([
      { role: "user", content: pedPrompt },
      { role: "assistant", content: pedReply },
      { role: "user", content: "Invalid JSON. Please output only the valid JSON object." },
    ]);
    pedData = extractJson(repairReply) as PedagogyOutput;
  }

  const tts = getTtsProvider(lang);

  // Step 2: Parallel TTS + Alignment for all steps
  const audioPromises = pedData.steps.map(async (st, i) => {
    const norm = normalizer.normalize(st.say, lang);
    const { tokens } = tokenizeScript(norm.normalizedText, lang);
    const synthRes = await tts.synthesize(norm.normalizedText, lang);
    const alignRes = await alignerClient.align(tokens, synthRes.audio, synthRes.durationMs, lang);

    return {
      stepIndex: i,
      rawSay: st.say,
      tokens,
      durationMs: synthRes.durationMs,
      alignRes,
      audioBytes: synthRes.audio,
    };
  });

  const preparedAudio = await Promise.all(audioPromises);

  // Step 3: Sequential Choreography & Compilation
  const layoutCtx: LayoutContext = {
    language: lang,
    labels: {},
    occupiedBoxes: [],
    drawnElements: new Map(),
  };

  const compiledSteps: CompiledStepManifest[] = [];
  const drawnElementIds = new Set<string>();

  for (let i = 0; i < pedData.steps.length; i++) {
    const prep = preparedAudio[i];
    const pedStep = pedData.steps[i];

    // Call Choreographer
    const choreoP = choreographerPrompt(
      i,
      prep.rawSay,
      prep.tokens,
      pedStep.visualIntent,
      Array.from(drawnElementIds),
      lang
    );

    let choreoReply = await ask([
      { role: "system", content: "You are a whiteboard visual choreographer. Reply strictly in JSON." },
      { role: "user", content: choreoP },
    ]);

    let choreoData: StepChoreography | null = null;
    try {
      const parsedRaw = extractJson(choreoReply);
      const val = manifestValidator.validateChoreography(parsedRaw);
      if (val.parsed) choreoData = val.parsed;
    } catch {}

    if (!choreoData) {
      // 1-shot repair
      choreoReply = await ask([
        { role: "user", content: choreoP },
        { role: "assistant", content: choreoReply },
        { role: "user", content: "Your reply did not match the Choreography schema. Reply with corrected JSON only." },
      ]);
      const parsedRaw = extractJson(choreoReply);
      const val = manifestValidator.validateChoreography(parsedRaw);
      choreoData = val.parsed || { stepIndex: i, labels: {}, commands: [] };
    }

    // 3-Stage Repair: Stage 1 (Deterministic fuzzy match)
    let repairRes = manifestValidator.repairChoreography(choreoData, drawnElementIds);
    choreoData = repairRes.repaired;

    if (repairRes.errors.length > 0) {
      // Stage 2: 1-shot LLM repair with valid IDs and exact errors
      const validIdList = Array.from(drawnElementIds).join(", ");
      const repairPrompt = `Errors detected in choreography:\n${repairRes.errors.join("\n")}\nValid currently drawn element IDs: [${validIdList}].\nPlease provide corrected choreography JSON fixing these references.`;
      try {
        const repairLLMReply = await ask([
          { role: "user", content: choreoP },
          { role: "assistant", content: choreoReply },
          { role: "user", content: repairPrompt },
        ]);
        const parsedRepaired = extractJson(repairLLMReply);
        const valRepaired = manifestValidator.validateChoreography(parsedRepaired);
        if (valRepaired.parsed) {
          // Re-run repair to verify
          repairRes = manifestValidator.repairChoreography(valRepaired.parsed, drawnElementIds);
          choreoData = repairRes.repaired;
        }
      } catch {}
    }

    // Update layout context scene blueprint and localized labels
    layoutCtx.sceneBlueprint = pedStep.visualIntent.macroBlueprint || "process_flow";
    Object.assign(layoutCtx.labels, choreoData.labels);

    // Compile Anchors -> startMs
    const timings = compileAnchors(choreoData.commands, prep.alignRes.marks, prep.durationMs);

    // Layout Engine: Resolve semantic objects to shapes
    const compiledCommands: CompiledCommand[] = [];

    for (const cmd of choreoData.commands) {
      const timing = timings.get(cmd.id) || { id: cmd.id, startMs: 0, durationMs: 600 };
      const startMs = Math.max(0, timing.startMs);

      if (cmd.action === "DRAW") {
        const shape = layoutEngine.resolveObject(cmd.id, cmd.semanticObject, cmd.color, layoutCtx);
        compiledCommands.push({
          id: cmd.id,
          action: "DRAW",
          startMs,
          durationMs: timing.durationMs,
          enterMs: startMs,
          exitMs: Infinity,
          slotId: (cmd.semanticObject as any).slotId,
          shape,
          color: cmd.color,
        });
        drawnElementIds.add(cmd.id);
      } else if (cmd.action === "HIGHLIGHT") {
        compiledCommands.push({
          id: cmd.id,
          action: "HIGHLIGHT",
          startMs,
          durationMs: timing.durationMs,
          enterMs: startMs,
          exitMs: Infinity,
          targetId: cmd.targetId,
          style: cmd.style,
        });
      } else if (cmd.action === "ERASE") {
        compiledCommands.push({
          id: cmd.id,
          action: "ERASE",
          startMs,
          durationMs: timing.durationMs,
          enterMs: startMs,
          exitMs: Infinity,
          targetIds: cmd.targetIds,
          technique: cmd.technique,
        });
        // Set exitMs for erased elements
        for (const prevCmd of compiledCommands) {
          if (cmd.targetIds.includes(prevCmd.id)) {
            prevCmd.exitMs = startMs;
          }
        }
      } else if (cmd.action === "TRANSITION") {
        compiledCommands.push({
          id: cmd.id,
          action: "TRANSITION",
          startMs,
          durationMs: 300,
          enterMs: startMs,
          exitMs: startMs + 300,
          technique: "fade",
          preserve: cmd.preserve,
          nextBlueprint: cmd.nextBlueprint,
        });

        // Set exitMs for non-preserved elements
        const preservedSet = new Set(cmd.preserve);
        for (const prevCmd of compiledCommands) {
          if (prevCmd.action === "DRAW" && !preservedSet.has(prevCmd.id) && (prevCmd.exitMs === undefined || prevCmd.exitMs === Infinity)) {
            prevCmd.exitMs = startMs;
          }
        }
        if (cmd.nextBlueprint) {
          layoutCtx.sceneBlueprint = cmd.nextBlueprint;
        }
      }
    }

    // Validate step
    manifestValidator.validateCompiledStep(
      i,
      compiledCommands,
      pedStep.visualIntent,
      prep.alignRes.marks,
      prep.rawSay,
      lang,
      drawnElementIds,
      layoutCtx.sceneBlueprint
    );

    const stepManifest: CompiledStepManifest = {
      stepIndex: i,
      speech: {
        durationMs: prep.durationMs,
        transcript: prep.rawSay,
        timingSource: prep.alignRes.timingSource,
        alignmentConfidence: prep.alignRes.alignmentConfidence,
        speechMarks: prep.alignRes.marks,
      },
      commands: compiledCommands,
    };

    compiledSteps.push(stepManifest);

    // Yield step immediately so client can stream/render step 0 while step 1 compiles!
    yield stepManifest;
  }

  return {
    version: "2.0.0",
    manifestVersion: 2,
    lessonId: `lesson-${Date.now()}`,
    language: lang,
    title: pedData.title,
    subtitle: pedData.subtitle,
    blueprint: pedData.steps[0]?.visualIntent?.macroBlueprint || "process_flow",
    steps: compiledSteps,
    metadata: {
      generatedAt: new Date().toISOString(),
      virtualCanvas: { width: 1000, height: 700 },
    },
  };
}
