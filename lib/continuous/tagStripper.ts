// Tag Stripper: Cleans [tag] markers from narration before sending to TTS/aligner,
// and maps each tag to the word that follows it (or the preceding word if at end).

export interface ExtractedTag {
  tag: string;
  wordIndex: number;
  word: string;
}

export interface TagStripResult {
  cleanText: string;
  words: string[];
  tagMap: Map<string, ExtractedTag>;
  declaredTags: Set<string>;
}

export function stripTagsAndExtractAnchors(narration: string): TagStripResult {
  const trimmed = narration.trim();
  if (!trimmed) {
    return {
      cleanText: "",
      words: [],
      tagMap: new Map(),
      declaredTags: new Set(),
    };
  }

  // Find all [tag] locations with regex
  const tagRegex = /\[([a-zA-Z0-9_-]+)\]/g;
  const tagOccurrences: Array<{ tag: string; index: number }> = [];
  let match: RegExpExecArray | null;

  while ((match = tagRegex.exec(trimmed)) !== null) {
    tagOccurrences.push({ tag: match[1], index: match.index });
  }

  const declaredTags = new Set<string>(tagOccurrences.map((t) => t.tag));

  // Build clean text by stripping [tag] and cleanly handling adjacent punctuation/spacing
  // If a tag is followed immediately by punctuation like "[tag]." with preceding space "word [tag].",
  // collapse the space so it becomes "word."
  let cleanText = trimmed
    .replace(/\s*\[([a-zA-Z0-9_-]+)\]([.,!?:;]+)/g, "$2") // e.g. "leaf [tag]." -> "leaf."
    .replace(/\[([a-zA-Z0-9_-]+)\]\s*/g, "") // remove any remaining tags + trailing space
    .replace(/\s+/g, " ")
    .trim();

  // Tokenize clean text into words
  const cleanWords = cleanText.length > 0 ? cleanText.split(/\s+/) : [];

  // Now determine the target word index for each tag in cleanText
  // Rule: Map each tag to the word that follows it (or last word if at end of sentence)
  const tagMap = new Map<string, ExtractedTag>();

  if (cleanWords.length > 0) {
    // To accurately find what word follows each tag, inspect the original string character offsets
    for (const { tag, index } of tagOccurrences) {
      // Look at the portion of text *before* this tag to count how many clean words appeared before it
      const textBefore = trimmed.slice(0, index);
      const cleanBefore = textBefore.replace(/\[[a-zA-Z0-9_-]+\]/g, "").trim();
      const wordsBeforeCount = cleanBefore.length > 0 ? cleanBefore.split(/\s+/).length : 0;

      // If the tag is followed by text, the following word is at index `wordsBeforeCount`
      // If the tag is at the very end, map to the preceding word `wordsBeforeCount - 1`
      const targetWordIdx =
        wordsBeforeCount < cleanWords.length ? wordsBeforeCount : Math.max(0, cleanWords.length - 1);

      tagMap.set(tag, {
        tag,
        wordIndex: targetWordIdx,
        word: cleanWords[targetWordIdx] || "",
      });
    }
  }

  return {
    cleanText,
    words: cleanWords,
    tagMap,
    declaredTags,
  };
}
