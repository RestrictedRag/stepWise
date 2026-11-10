// Fetch sample TTS audio for English and Hindi using Gnani provider
import fs from "node:fs";
import path from "node:path";
import { gnaniProvider } from "../lib/tts/gnaniProvider.ts";
import { normalizer } from "../lib/normalizer.ts";

async function main() {
  process.env.GNANI_API_KEY = process.env.GNANI_API_KEY || "vach_1ytE2CY5X2EsMVtbs7X4yjOXdCNYu2GQmdQjgD1LARmImx7Bf40Ll7Wfv8r9OnXYNzaX0LcWz7wG4tGQDe7tBxM4DF6hnyEw_cd1e9abfcb1c9687b3c86dc6e1400e6c";

  const outDir = path.resolve("eval");
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  // Sample 1: English
  const textEn = "The nucleus is the control center of the cell.";
  const normEn = normalizer.normalize(textEn, "en");
  console.log("Synthesizing English audio for:", normEn.normalizedText);
  const resEn = await gnaniProvider.synthesize(normEn.normalizedText, "en");
  fs.writeFileSync(path.join(outDir, "sample_en.mp3"), Buffer.from(resEn.audio));
  console.log("Saved sample_en.mp3, durationMs:", resEn.durationMs, "bytes:", resEn.audio.length);

  // Sample 2: Hindi
  const textHi = "कोशिका का नियंत्रण केंद्र नाभिक होता है।";
  const normHi = normalizer.normalize(textHi, "hi");
  console.log("Synthesizing Hindi audio for:", normHi.normalizedText);
  const resHi = await gnaniProvider.synthesize(normHi.normalizedText, "hi");
  fs.writeFileSync(path.join(outDir, "sample_hi.mp3"), Buffer.from(resHi.audio));
  console.log("Saved sample_hi.mp3, durationMs:", resHi.durationMs, "bytes:", resHi.audio.length);
}

main().catch(console.error);
