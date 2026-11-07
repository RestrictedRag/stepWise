// TTS Provider Registry
import type { TtsProvider } from "./provider.ts";
import { gnaniProvider } from "./gnaniProvider.ts";
import { getLanguageConfig } from "../languages.ts";

export class MockTtsProvider implements TtsProvider {
  public name = "mock";
  public async synthesize(text: string, _lang: string) {
    const durationMs = Math.max(1500, text.split(/\s+/).length * 400);
    return {
      audio: new Uint8Array([0, 1, 2, 3]),
      mimeType: "audio/mpeg",
      durationMs,
    };
  }
}

export const mockTtsProvider = new MockTtsProvider();

export function getTtsProvider(lang: string): TtsProvider {
  const config = getLanguageConfig(lang);

  if (config.ttsProvider === "gnani") {
    // If running in test or local without GNANI_API_KEY, gracefully use MockTtsProvider
    if (!process.env.GNANI_API_KEY && !process.env.EVON_API_KEY) {
      return mockTtsProvider;
    }
    return gnaniProvider;
  }

  if (config.ttsProvider === "fallback") {
    // If an external key like ELEVENLABS_API_KEY or OPENAI_API_KEY is configured in the future, wire here
    throw new Error(
      `No TTS Provider configured for language '${lang}' (${config.name}). ` +
      `Gnani only covers Indic + English. For ${config.name}, please configure an external fallback provider (e.g. ElevenLabs or Azure Speech) and provide credentials.`
    );
  }

  throw new Error(`Unknown TTS provider type '${config.ttsProvider}' for language '${lang}'`);
}

