// Text Normalizer: Single source of truth for converting numbers, math, and symbols to spoken form.
// Preserves bidirectional mapping from normalized tokens back to original script tokens.

import { tokenizeScript, type ScriptWordToken } from "./tokenizer.ts";

export interface NormalizedWordMapping {
  originalWordIndex: number;
  originalText: string;
  normalizedWords: string[];
}

export interface NormalizationResult {
  normalizedText: string;
  tokenMappings: NormalizedWordMapping[];
}

export interface Normalizer {
  normalize(text: string, lang: string): NormalizationResult;
}

const COMMON_SYMBOLS: Record<string, string> = {
  "Δ": "delta",
  "θ": "theta",
  "π": "pi",
  "α": "alpha",
  "β": "beta",
  "λ": "lambda",
  "μ": "micro",
  "∑": "sum",
  "√": "square root of",
  "%": "percent",
  "°": "degrees",
  "+": "plus",
  "-": "minus",
  "=": "equals",
  "×": "times",
  "*": "times",
  "÷": "divided by",
  "/": "divided by",
  ">": "greater than",
  "<": "less than",
  "≠": "not equal to",
  "≤": "less than or equal to",
  "≥": "greater than or equal to",
};

const EN_NUMBER_WORDS: Record<string, string> = {
  "0": "zero", "1": "one", "2": "two", "3": "three", "4": "four",
  "5": "five", "6": "six", "7": "seven", "8": "eight", "9": "nine",
  "10": "ten", "11": "eleven", "12": "twelve", "13": "thirteen",
  "14": "fourteen", "15": "fifteen", "16": "sixteen", "17": "seventeen",
  "18": "eighteen", "19": "nineteen", "20": "twenty", "30": "thirty",
  "40": "forty", "50": "fifty", "60": "sixty", "70": "seventy",
  "80": "eighty", "90": "ninety", "100": "one hundred"
};

const HI_NUMBER_WORDS: Record<string, string> = {
  "0": "शून्य", "1": "एक", "2": "दो", "3": "तीन", "4": "चार",
  "5": "पाँच", "6": "छह", "7": "सात", "8": "आठ", "9": "नौ",
  "10": "दस", "20": "बीस", "50": "पचास", "100": "सौ"
};

export class LanguageNormalizer implements Normalizer {
  public normalize(text: string, lang: string): NormalizationResult {
    // First tokenize the source text
    const { tokens } = tokenizeScript(text, lang);
    const mappings: NormalizedWordMapping[] = [];
    const fullNormalizedTokens: string[] = [];

    for (const token of tokens) {
      const normalizedWords = this.normalizeSingleToken(token.text, lang);
      mappings.push({
        originalWordIndex: token.wordIndex,
        originalText: token.text,
        normalizedWords,
      });
      fullNormalizedTokens.push(...normalizedWords);
    }

    return {
      normalizedText: fullNormalizedTokens.join(" "),
      tokenMappings: mappings,
    };
  }

  private normalizeSingleToken(word: string, lang: string): string[] {
    const clean = word.replace(/\$/g, ""); // strip inline LaTeX markers

    // 1. Math / Greek symbol lookup
    if (COMMON_SYMBOLS[clean]) {
      return COMMON_SYMBOLS[clean].split(" ");
    }

    // 2. Pure integer digits
    if (/^\d+$/.test(clean)) {
      if (lang.startsWith("hi")) {
        if (HI_NUMBER_WORDS[clean]) return [HI_NUMBER_WORDS[clean]];
        return clean.split("").map((d) => HI_NUMBER_WORDS[d] || d);
      }
      // English / default digits
      if (EN_NUMBER_WORDS[clean]) return [EN_NUMBER_WORDS[clean]];
      return clean.split("").map((d) => EN_NUMBER_WORDS[d] || d);
    }

    // 3. Superscripts (e.g. x^2 -> x squared)
    if (clean.includes("^2")) {
      const base = clean.replace("^2", "");
      return base ? [base, "squared"] : ["squared"];
    }
    if (clean.includes("^3")) {
      const base = clean.replace("^3", "");
      return base ? [base, "cubed"] : ["cubed"];
    }

    // Default: return unchanged word
    return [clean];
  }
}

export const normalizer = new LanguageNormalizer();
