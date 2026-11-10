// Tokenizer: Single source of truth for wordIndex across TTS, Aligner, Choreographer, and Eval.
import { getLanguageConfig } from "./languages.ts";

export interface CharacterSpan {
  char: string;
  index: number;
}

export interface ScriptWordToken {
  wordIndex: number;            // 0-based contiguous index of word tokens
  text: string;                 // Exact token string
  startChar: number;            // Character start in input string
  endChar: number;              // Character end in input string
  characterSpans: CharacterSpan[]; // Explicit character span mapping (crucial for zh, ja, th)
}

export interface TokenizeResult {
  tokens: ScriptWordToken[];
  totalWords: number;
  script: string;
  language: string;
}

export function tokenizeScript(text: string, lang: string): TokenizeResult {
  const config = getLanguageConfig(lang);
  const segmenter = new Intl.Segmenter(config.code || lang, { granularity: "word" });
  const segments = segmenter.segment(text);

  const tokens: ScriptWordToken[] = [];
  let wordIndex = 0;

  for (const seg of segments) {
    // Capture word-like tokens, letters, numbers, or symbols (e.g. math symbols, Greek letters, currency, degrees)
    if (seg.isWordLike || /[\p{L}\p{N}\p{S}]/u.test(seg.segment)) {
      const characterSpans: CharacterSpan[] = [];
      const segText = seg.segment;
      for (let i = 0; i < segText.length; i++) {
        characterSpans.push({
          char: segText[i],
          index: seg.index + i,
        });
      }

      tokens.push({
        wordIndex: wordIndex++,
        text: segText,
        startChar: seg.index,
        endChar: seg.index + segText.length,
        characterSpans,
      });
    }
  }

  return {
    tokens,
    totalWords: tokens.length,
    script: text,
    language: lang,
  };
}

// Segmenter-aware key-term matching: Finds the wordIndex of a target phrase or term in the token stream
export function findTermWordIndex(tokens: ScriptWordToken[], term: string, lang: string): number | null {
  const termTokens = tokenizeScript(term, lang).tokens;
  if (termTokens.length === 0 || tokens.length === 0) return null;

  const firstTermText = termTokens[0].text.toLowerCase();

  for (let i = 0; i <= tokens.length - termTokens.length; i++) {
    if (tokens[i].text.toLowerCase() === firstTermText) {
      let match = true;
      for (let j = 1; j < termTokens.length; j++) {
        if (tokens[i + j].text.toLowerCase() !== termTokens[j].text.toLowerCase()) {
          match = false;
          break;
        }
      }
      if (match) {
        return tokens[i].wordIndex;
      }
    }
  }

  // Fallback: substring search across word tokens
  const lowerTerm = term.toLowerCase();
  for (const token of tokens) {
    if (token.text.toLowerCase().includes(lowerTerm) || lowerTerm.includes(token.text.toLowerCase())) {
      return token.wordIndex;
    }
  }

  return null;
}
