// StepWise Animation Engine - Synchronization Evaluation & Benchmarking
import assert from "node:assert/strict";
import { streamLessonManifest } from "../lib/pipeline.ts";
import { HybridAlignerClient } from "../lib/aligner/alignerClient.ts";
import type { LessonRequest } from "../lib/validate.ts";
import type { Msg } from "../lib/llm.ts";
import type { CompiledStepManifest } from "../lib/manifest.ts";

process.env.GNANI_API_KEY =
  process.env.GNANI_API_KEY ||
  "vach_1ytE2CY5X2EsMVtbs7X4yjOXdCNYu2GQmdQjgD1LARmImx7Bf40Ll7Wfv8r9OnXYNzaX0LcWz7wG4tGQDe7tBxM4DF6hnyEw_cd1e9abfcb1c9687b3c86dc6e1400e6c";

interface EvalResult {
  lang: string;
  stepIndex: number;
  keyTerm: string;
  spokenTimeMs: number;
  visualStartMs: number;
  gapMs: number;
  timingSource: string;
  confidence: number;
  passed: boolean;
}

// Deterministic prompt simulator for pedagogical & choreographic pipeline stages
function createEvalAsk(lang: string) {
  return async (msgs: Msg[]): Promise<string> => {
    const lastMsg = msgs[msgs.length - 1].content;

    // Pedagogy stage
    if (lastMsg.includes("StepWise Pedagogy Agent")) {
      if (lang === "hi") {
        return JSON.stringify({
          title: "कोशिका नाभिक",
          subtitle: "कोशिका का नियंत्रण केंद्र",
          steps: [
            {
              say: "कोशिका का नियंत्रण केंद्र नाभिक होता है।",
              visualIntent: {
                concept: "Cell and Nucleus",
                keyTerms: ["कोशिका", "नाभिक"],
                boardEndState: "Circle representing cell with nucleus inside",
              },
            },
          ],
        });
      }

      return JSON.stringify({
        title: "The Cell Nucleus",
        subtitle: "How the nucleus controls cellular life",
        steps: [
          {
            say: "The nucleus is the control center of the cell.",
            visualIntent: {
              concept: "Cell and Nucleus",
              keyTerms: ["nucleus", "cell"],
              boardEndState: "Circle representing cell with nucleus inside",
            },
          },
        ],
      });
    }

    // Choreographer stage
    if (lastMsg.includes("StepWise Choreographer Agent")) {
      if (lang === "hi") {
        return JSON.stringify({
          stepIndex: 0,
          labels: { lbl_cell: "कोशिका", lbl_nuc: "नाभिक" },
          commands: [
            {
              id: "elem_cell",
              action: "DRAW",
              anchor: { wordIndex: 0, offsetMs: -50 }, // कोशिका
              semanticObject: { type: "circle", size: "lg", zone: "center" },
              color: "ink",
            },
            {
              id: "elem_nucleus",
              action: "DRAW",
              anchor: { wordIndex: 4, offsetMs: -80 }, // नाभिक
              semanticObject: { type: "circle", size: "sm", zone: "center" },
              color: "purple",
            },
          ],
        });
      }

      return JSON.stringify({
        stepIndex: 0,
        labels: { lbl_cell: "Cell", lbl_nuc: "Nucleus" },
        commands: [
          {
            id: "elem_nucleus",
            action: "DRAW",
            anchor: { wordIndex: 1, offsetMs: -60 }, // nucleus
            semanticObject: { type: "circle", size: "md", zone: "center" },
            color: "purple",
          },
          {
            id: "elem_cell",
            action: "DRAW",
            anchor: { wordIndex: 8, offsetMs: -100 }, // cell
            semanticObject: { type: "circle", size: "lg", zone: "center" },
            color: "ink",
          },
        ],
      });
    }

    return "{}";
  };
}

async function evaluateLanguage(lang: string, topic: string): Promise<EvalResult[]> {
  const req: LessonRequest = {
    topic,
    persona: "teacher",
    level: "middle",
    lang,
    style: "",
    fromQuestion: false,
  };

  const ask = createEvalAsk(lang);
  const generator = streamLessonManifest(req, ask);

  const results: EvalResult[] = [];
  const steps: CompiledStepManifest[] = [];

  for await (const step of generator) {
    steps.push(step);

    // Evaluate sync gap for commands anchored to speech marks
    for (const cmd of step.commands) {
      if (cmd.action !== "DRAW") continue;

      // Find corresponding mark matching this command's concept
      const targetTerm = cmd.id.includes("nucleus") ? (lang === "hi" ? "नाभिक" : "nucleus") : (lang === "hi" ? "कोशिका" : "cell");
      const mark = step.speech.speechMarks.find(
        (m) => m.value.toLowerCase() === targetTerm.toLowerCase()
      );

      if (mark) {
        const gap = Math.abs(mark.timeMs - cmd.startMs);
        results.push({
          lang,
          stepIndex: step.stepIndex,
          keyTerm: targetTerm,
          spokenTimeMs: mark.timeMs,
          visualStartMs: cmd.startMs,
          gapMs: gap,
          timingSource: step.speech.timingSource,
          confidence: step.speech.alignmentConfidence,
          passed: gap <= 600,
        });
      }
    }
  }

  return results;
}

// Degraded alignment fallback verification
async function verifyDegradedFallback() {
  console.log("\n=================== Degraded Fallback Verification ===================");
  const degradedClient = new HybridAlignerClient("http://127.0.0.1:9999"); // non-existent port
  const tokens = [
    { wordIndex: 0, text: "Fallback", startChar: 0, endChar: 8 },
    { wordIndex: 1, text: "timing", startChar: 9, endChar: 15 },
  ];
  const audio = new Uint8Array([0, 1, 2, 3]);

  const res = await degradedClient.align(tokens, audio, 2000, "en");
  console.log("Fallback Timing Source:    ", res.timingSource);
  console.log("Fallback Overall Confidence:", res.alignmentConfidence);
  console.log("Marks generated:           ", res.marks.length);

  assert.equal(res.timingSource, "syllable_estimate");
  assert.equal(res.marks.length, tokens.length);
  assert.ok(res.alignmentConfidence <= 0.5);
  console.log("✔ Degraded alignment gracefully degraded to syllable estimate without crashing.");
}

async function main() {
  console.log("===============================================================================");
  console.log("       StepWise Whiteboard Animation Engine - Synchronization Benchmark        ");
  console.log("===============================================================================\n");

  const enResults = await evaluateLanguage("en", "Cell Nucleus");
  const hiResults = await evaluateLanguage("hi", "कोशिका नाभिक");

  const allResults = [...enResults, ...hiResults];

  console.log("Detailed Key-Term Alignment & Sync Table:");
  console.log("------------------------------------------------------------------------------------------------------");
  console.log("| Lang | Step | Key Term        | Spoken (ms) | Visual Start (ms) | Gap (ms) | Timing Source     | Pass |");
  console.log("------------------------------------------------------------------------------------------------------");

  for (const r of allResults) {
    const l = r.lang.toUpperCase().padEnd(4, " ");
    const s = String(r.stepIndex).padEnd(4, " ");
    const t = r.keyTerm.padEnd(15, " ");
    const sp = String(r.spokenTimeMs).padStart(11, " ");
    const vs = String(r.visualStartMs).padStart(17, " ");
    const gp = `${r.gapMs} ms`.padStart(8, " ");
    const src = r.timingSource.padEnd(17, " ");
    const pass = r.passed ? "✔ PASS" : "❌ FAIL";
    console.log(`| ${l} | ${s} | ${t} | ${sp} | ${vs} | ${gp} | ${src} | ${pass} |`);
  }
  console.log("------------------------------------------------------------------------------------------------------\n");

  // Per-language statistics
  const computeStats = (list: EvalResult[]) => {
    const avg = list.reduce((acc, c) => acc + c.gapMs, 0) / Math.max(1, list.length);
    const max = Math.max(...list.map((c) => c.gapMs));
    return { avg: Math.round(avg), max };
  };

  const enStats = computeStats(enResults);
  const hiStats = computeStats(hiResults);
  const globalStats = computeStats(allResults);

  console.log("Performance Benchmark Summary:");
  console.log("----------------------------------------------------------------");
  console.log(`English (EN):  Average Gap = ${enStats.avg} ms (≤ 300ms) | Max Gap = ${enStats.max} ms (≤ 600ms)`);
  console.log(`Hindi (HI):    Average Gap = ${hiStats.avg} ms (≤ 300ms) | Max Gap = ${hiStats.max} ms (≤ 600ms)`);
  console.log(`Overall:       Average Gap = ${globalStats.avg} ms (≤ 300ms) | Max Gap = ${globalStats.max} ms (≤ 600ms)`);
  console.log("----------------------------------------------------------------\n");

  // Assertions against pass criteria
  assert.ok(globalStats.avg <= 300, `Average gap ${globalStats.avg}ms exceeds 300ms threshold`);
  assert.ok(globalStats.max <= 600, `Max gap ${globalStats.max}ms exceeds 600ms threshold`);
  console.log("✔ PASS CRITERIA SATISFIED: Whiteboard visuals are synchronized within speech tolerance.\n");

  // Run degraded alignment test
  await verifyDegradedFallback();

  console.log("\n===============================================================================");
  console.log("                ALL EVALUATIONS AND BENCHMARKS PASSED 100%                     ");
  console.log("===============================================================================");
}

main().catch((err) => {
  console.error("Evaluation failed:", err);
  process.exit(1);
});
