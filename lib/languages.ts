// Language Registry: Single source of truth for multilingual engine parameters.
// Adding a language is a registry entry, not a code change.

export type TextDirection = "ltr" | "rtl";

export interface LanguageConfig {
  code: string;            // BCP-47 tag, e.g. "en-IN", "hi-IN", "ar", "zh-CN"
  name: string;            // Human-readable name
  direction: TextDirection;// "ltr" or "rtl"
  script: string;          // ISO 15924 script code, e.g. "Latn", "Deva", "Arab", "Hans"
  ttsProvider: "gnani" | "fallback";
  voiceId: string;
  alignerSupport: boolean; // Supported by MMS_FA
  fontStack: string;       // Preferred font family for the canvas
}

export const LANGUAGE_REGISTRY: Record<string, LanguageConfig> = {
  en: {
    code: "en-IN",
    name: "English (India)",
    direction: "ltr",
    script: "Latn",
    ttsProvider: "gnani",
    voiceId: "Kaveri",
    alignerSupport: true,
    fontStack: "var(--font-board, cursive), 'Caveat', system-ui, sans-serif",
  },
  hi: {
    code: "hi-IN",
    name: "Hindi",
    direction: "ltr",
    script: "Deva",
    ttsProvider: "gnani",
    voiceId: "Kaveri",
    alignerSupport: true,
    fontStack: "'Noto Sans Devanagari', 'Caveat', system-ui, sans-serif",
  },
  kn: {
    code: "kn-IN",
    name: "Kannada",
    direction: "ltr",
    script: "Knda",
    ttsProvider: "gnani",
    voiceId: "Kaveri",
    alignerSupport: true,
    fontStack: "'Noto Sans Kannada', system-ui, sans-serif",
  },
  ta: {
    code: "ta-IN",
    name: "Tamil",
    direction: "ltr",
    script: "Taml",
    ttsProvider: "gnani",
    voiceId: "Kaveri",
    alignerSupport: true,
    fontStack: "'Noto Sans Tamil', system-ui, sans-serif",
  },
  ar: {
    code: "ar",
    name: "Arabic",
    direction: "rtl",
    script: "Arab",
    ttsProvider: "fallback", // Requires external provider e.g. ElevenLabs/Azure/OpenAI
    voiceId: "default",
    alignerSupport: true,
    fontStack: "'Noto Sans Arabic', system-ui, sans-serif",
  },
  ur: {
    code: "ur",
    name: "Urdu",
    direction: "rtl",
    script: "Arab",
    ttsProvider: "fallback",
    voiceId: "default",
    alignerSupport: true,
    fontStack: "'Noto Nastaliq Urdu', 'Noto Sans Arabic', system-ui, sans-serif",
  },
  zh: {
    code: "zh-CN",
    name: "Chinese (Simplified)",
    direction: "ltr",
    script: "Hans",
    ttsProvider: "fallback",
    voiceId: "default",
    alignerSupport: true,
    fontStack: "'Noto Sans SC', system-ui, sans-serif",
  },
  ja: {
    code: "ja-JP",
    name: "Japanese",
    direction: "ltr",
    script: "Jpan",
    ttsProvider: "fallback",
    voiceId: "default",
    alignerSupport: true,
    fontStack: "'Noto Sans JP', system-ui, sans-serif",
  },
};

export function getLanguageConfig(lang: string): LanguageConfig {
  const normalized = lang.toLowerCase().split("-")[0];
  const config = LANGUAGE_REGISTRY[lang] || LANGUAGE_REGISTRY[normalized];
  if (!config) {
    throw new Error(
      `Unsupported language code '${lang}'. Please register this language in lib/languages.ts with its TTS and font specifications.`
    );
  }
  return config;
}

export function isRTL(lang: string): boolean {
  return getLanguageConfig(lang).direction === "rtl";
}
