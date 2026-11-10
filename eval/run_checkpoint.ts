// Run Checkpoint: Extract speech marks for 1 English and 1 Hindi sample with timingSource and per-word confidence.
import fs from "node:fs";
import path from "node:path";
import { tokenizeScript } from "../lib/tokenizer.ts";
import { normalizer } from "../lib/normalizer.ts";
import { alignerClient } from "../lib/aligner/alignerClient.ts";

async function runSample(text: string, audioPath: string, lang: string) {
  console.log(`\n=================== [${lang.toUpperCase()}] Sample ===================`);
  console.log("Raw text:       ", text);

  // 1. Normalize
  const norm = normalizer.normalize(text, lang);
  console.log("Normalized text:", norm.normalizedText);

  // 2. Tokenize
  const { tokens } = tokenizeScript(norm.normalizedText, lang);
  console.log(`Token count:     ${tokens.length} words`);

  // 3. Audio bytes
  const audioBytes = fs.readFileSync(audioPath);

  // 4. Align
  const durationMs = 2304; // from TTS synthesis
  const result = await alignerClient.align(tokens, new Uint8Array(audioBytes), durationMs, lang);

  console.log(`Timing Source:   ${result.timingSource}`);
  console.log(`Overall Conf:    ${result.alignmentConfidence}`);
  console.log("\nPer-word Speech Marks Table:");
  console.log("---------------------------------------------------------------");
  console.log("| Word Index | Value            | Start (ms) | End (ms) | Conf |");
  console.log("---------------------------------------------------------------");
  for (const m of result.marks) {
    const val = m.value.padEnd(16, " ");
    const start = String(m.timeMs).padStart(10, " ");
    const end = String(m.timeMs + 200).padStart(8, " ");
    const conf = String(m.confidence ?? 0).padStart(4, " ");
    console.log(`| ${String(m.startChar >= 0 ? tokens.find(t=>t.text===m.value)?.wordIndex ?? 0 : 0).padStart(10, " ")} | ${val} | ${start} | ${end} | ${conf} |`);
  }
  console.log("---------------------------------------------------------------\n");

  return result;
}

async function main() {
  const enPath = path.resolve("eval/sample_en.mp3");
  const hiPath = path.resolve("eval/sample_hi.mp3");

  await runSample(
    "The nucleus is the control center of the cell.",
    enPath,
    "en"
  );

  await runSample(
    "कोशिका का नियंत्रण केंद्र नाभिक होता है।",
    hiPath,
    "hi"
  );
}

main().catch(console.error);
