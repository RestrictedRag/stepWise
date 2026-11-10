// TTS Provider Interface and Speech Mark Definitions

export interface SpeechMark {
  timeMs: number;
  type: "word";
  value: string;
  startChar: number;
  endChar: number;
  confidence?: number;
}

export interface SynthesizeResult {
  audio: Uint8Array;
  mimeType: string;
  durationMs: number;
  marks?: SpeechMark[];
}

export interface TtsProvider {
  name: string;
  synthesize(text: string, lang: string): Promise<SynthesizeResult>;
}
