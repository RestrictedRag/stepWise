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

    // Update layout context localized labels
    Object.assign(layoutCtx.labels, choreoData.labels);

    // Compile Anchors -> startMs
    const timings = compileAnchors(choreoData.commands, prep.alignRes.marks, prep.durationMs);

    // Layout Engine: Resolve semantic objects to shapes
    const compiledCommands: CompiledCommand[] = [];

    for (const cmd of choreoData.commands) {
      const timing = timings.get(cmd.id) || { id: cmd.id, startMs: 0, durationMs: 600 };

      if (cmd.action === "DRAW") {
        const shape = layoutEngine.resolveObject(cmd.id, cmd.semanticObject, cmd.color, layoutCtx);
        compiledCommands.push({
          id: cmd.id,
          action: "DRAW",
          startMs: timing.startMs,
          durationMs: timing.durationMs,
          shape,
          color: cmd.color,
        });
        drawnElementIds.add(cmd.id);
      } else if (cmd.action === "HIGHLIGHT") {
        compiledCommands.push({
          id: cmd.id,
          action: "HIGHLIGHT",
          startMs: timing.startMs,
          durationMs: timing.durationMs,
          targetId: cmd.targetId,
          style: cmd.style,
        });
      } else if (cmd.action === "ERASE") {
        compiledCommands.push({
          id: cmd.id,
          action: "ERASE",
          startMs: timing.startMs,
          durationMs: timing.durationMs,
          targetIds: cmd.targetIds,
          technique: cmd.technique,
        });
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
      drawnElementIds
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
    version: "1.0.0",
    lessonId: `lesson-${Date.now()}`,
    language: lang,
    title: pedData.title,
    subtitle: pedData.subtitle,
    steps: compiledSteps,
    metadata: {
      generatedAt: new Date().toISOString(),
      virtualCanvas: { width: 1000, height: 700 },
    },
  };
}
