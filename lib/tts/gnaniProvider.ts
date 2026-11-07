// Gnani (Vachana) TTS Provider implementation.
import type { TtsProvider, SynthesizeResult } from "./provider.ts";
import { getLanguageConfig } from "../languages.ts";

const LANG_CODE: Record<string, string> = {
  en: "en-IN",
  hi: "hi-IN",
  kn: "kn-IN",
  ta: "ta-IN",
};

export class GnaniTtsProvider implements TtsProvider {
  public name = "gnani";

  public async synthesize(text: string, lang: string): Promise<SynthesizeResult> {
    const key = process.env.GNANI_API_KEY || process.env.EVON_API_KEY;
    if (!key) {
      throw new Error("Gnani voice is not configured. Missing GNANI_API_KEY environment variable.");
    }

    const langKey = lang.toLowerCase().split("-")[0];
    const gnaniLang = LANG_CODE[langKey];
    if (!gnaniLang) {
      throw new Error(`Gnani does not support language '${lang}'. Registered languages: ${Object.keys(LANG_CODE).join(", ")}`);
    }

    const config = getLanguageConfig(lang);

    const res = await fetch("https://api.vachana.ai/api/v1/tts/inference", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key-ID": key,
      },
      body: JSON.stringify({
        text,
        model: "timbre-v2.5",
        voice: config.voiceId || "Kaveri",
        language: gnaniLang,
        audio_config: {
          sample_rate: 24000,
          num_channels: 1,
          sample_width: 2,
          encoding: "linear_pcm",
          container: "mp3",
          bitrate: "64k",
        },
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`Gnani TTS failed with status ${res.status}: ${errText}`);
    }

    const contentType = res.headers.get("content-type") || "";
    // Check if the API unexpectedly returned JSON (e.g. timing metadata)
    if (contentType.includes("application/json")) {
      const json = await res.json();
      console.warn("[GnaniTtsProvider] Unexpected JSON response received from Gnani TTS:", json);
      throw new Error("Gnani TTS returned JSON payload instead of audio stream. Timing inspection required.");
    }

    const buffer = await res.arrayBuffer();
    const audio = new Uint8Array(buffer);

    // Approximate duration from 64k CBR MP3 (8000 bytes/sec) or fallback word count
    const durationMs = Math.max(1000, Math.round((audio.length / 8000) * 1000));

    return {
      audio,
      mimeType: "audio/mpeg",
      durationMs,
      marks: undefined, // Gnani returns audio only
    };
  }
}

export const gnaniProvider = new GnaniTtsProvider();
