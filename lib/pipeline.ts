// StepWise Multi-Stage Pipeline: Parallel TTS + Alignment, Sequential Choreographer, and Streaming Manifest
import { pedagogyPrompt, choreographerPrompt, allStepsChoreographerPrompt } from "./prompts.ts";
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
  ChoreographerTransitionCommand,
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
  ask: (msgs: Msg[], maxTokens?: number) => Promise<string>
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

  // Step 2: Sequential TTS + Alignment for all steps (avoids Gnani 429 concurrency rate limits)
  const preparedAudio: Array<{
    stepIndex: number;
    rawSay: string;
    tokens: any[];
    durationMs: number;
    alignRes: any;
    audioBytes: Uint8Array;
  }> = [];

  for (let i = 0; i < pedData.steps.length; i++) {
    const st = pedData.steps[i];
    const norm = normalizer.normalize(st.say, lang);
    const { tokens } = tokenizeScript(norm.normalizedText, lang);

    let synthRes;
    try {
      synthRes = await tts.synthesize(norm.normalizedText, lang);
    } catch (ttsErr) {
      console.warn(`[Pipeline] TTS synthesis failed for step ${i}, falling back to syllable estimate:`, ttsErr);
      const estDurationMs = Math.max(3000, tokens.length * 400);
      synthRes = {
        audio: new Uint8Array([0, 1, 2, 3]),
        durationMs: estDurationMs,
      };
    }

    const alignRes = await alignerClient.align(tokens, synthRes.audio, synthRes.durationMs, lang);
    preparedAudio.push({
      stepIndex: i,
      rawSay: st.say,
      tokens,
      durationMs: synthRes.durationMs,
      alignRes,
      audioBytes: synthRes.audio,
    });
  }

  // Step 3: Choreography Generation
  const macroBp = pedData.steps[0]?.visualIntent?.macroBlueprint || "process_flow";
  const allChoreoMap = new Map<number, StepChoreography>();

  try {
    const allPrompt = allStepsChoreographerPrompt(
      pedData.title,
      macroBp,
      pedData.steps.map((st, i) => ({
        stepIndex: i,
        say: preparedAudio[i].rawSay,
        tokens: preparedAudio[i].tokens,
        visualIntent: st.visualIntent,
      })),
      lang
    );

    const allReply = await ask(
      [
        { role: "system", content: "You are a master whiteboard visual choreographer. Output valid raw JSON immediately with no preamble or explanation." },
        { role: "user", content: allPrompt },
      ],
      1200
    );

    const parsedAll = extractJson(allReply) as any;
    if (Array.isArray(parsedAll?.steps)) {
      for (const s of parsedAll.steps) {
        const val = manifestValidator.validateChoreography(s);
        if (val.parsed) {
          allChoreoMap.set(val.parsed.stepIndex, val.parsed);
        }
      }
    }
  } catch (err) {
    console.warn("[Pipeline] Batched choreographer failed, falling back to per-step:", err);
  }

  const layoutCtx: LayoutContext = {
    language: lang,
    labels: {},
    occupiedBoxes: [],
    drawnElements: new Map(),
  };

  const compiledSteps: CompiledStepManifest[] = [];
  const drawnElementIds = new Set<string>();

  const stepOffsets: number[] = [];
  let curStepOffset = 0;
  for (let s = 0; s < pedData.steps.length; s++) {
    stepOffsets.push(curStepOffset);
    curStepOffset += preparedAudio[s].durationMs;
  }

  for (let i = 0; i < pedData.steps.length; i++) {
    const prep = preparedAudio[i];
    const pedStep = pedData.steps[i];

    // Check if batched choreography provided this step, otherwise use per-step call
    let choreoData: StepChoreography | null = allChoreoMap.get(i) || null;
    let choreoP = "";
    let choreoReply = "";

    if (!choreoData) {
      choreoP = choreographerPrompt(
        i,
        prep.rawSay,
        prep.tokens,
        pedStep.visualIntent,
        Array.from(drawnElementIds),
        lang
      );

      choreoReply = await ask([
        { role: "system", content: "You are a whiteboard visual choreographer. Reply strictly in JSON." },
        { role: "user", content: choreoP },
      ]);

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

    // If scene blueprint changes and no transition was emitted, synthesize a clean scene transition
    const stepHasTransition = choreoData.commands.some((c) => c.action === "TRANSITION");
    const targetBlueprint = pedStep.visualIntent.macroBlueprint || layoutCtx.sceneBlueprint || "process_flow";
    if (i > 0 && !stepHasTransition && targetBlueprint !== layoutCtx.sceneBlueprint) {
      const transCmd: ChoreographerTransitionCommand = {
        id: `trans_scene_${i}`,
        action: "TRANSITION",
        anchor: { wordIndex: 0, offsetMs: -150 },
        technique: "fade",
        preserve: [],
        nextBlueprint: targetBlueprint,
      };
      choreoData.commands.unshift(transCmd);
    }

    // Update layout context scene blueprint and localized labels
    layoutCtx.sceneBlueprint = targetBlueprint;
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
        // Set exitMs for erased elements across all previous steps + current step
        const eraseGlobalMs = stepOffsets[i] + startMs;
        for (let k = 0; k < i; k++) {
          for (const prevCmd of compiledSteps[k].commands) {
            if (cmd.targetIds.includes(prevCmd.id)) {
              prevCmd.exitMs = Math.max(0, eraseGlobalMs - stepOffsets[k]);
            }
          }
        }
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

        // Set exitMs for non-preserved elements across all previous steps + current step
        const preservedSet = new Set(cmd.preserve);
        const transGlobalMs = stepOffsets[i] + startMs;

        for (let k = 0; k < i; k++) {
          for (const prevCmd of compiledSteps[k].commands) {
            if (prevCmd.action === "DRAW" && !preservedSet.has(prevCmd.id) && (prevCmd.exitMs === undefined || prevCmd.exitMs === Infinity)) {
              prevCmd.exitMs = Math.max(0, transGlobalMs - stepOffsets[k]);
            }
          }
        }

        for (const prevCmd of compiledCommands) {
          if (prevCmd.action === "DRAW" && !preservedSet.has(prevCmd.id) && (prevCmd.exitMs === undefined || prevCmd.exitMs === Infinity)) {
            prevCmd.exitMs = startMs;
          }
        }

        // Snap preserved elements to finished state
        for (const pid of cmd.preserve) {
          drawnElementIds.add(pid);
        }

        if (cmd.nextBlueprint) {
          layoutCtx.sceneBlueprint = cmd.nextBlueprint;
          if (layoutCtx.slotElementCounts) {
            layoutCtx.slotElementCounts.clear();
          }
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
