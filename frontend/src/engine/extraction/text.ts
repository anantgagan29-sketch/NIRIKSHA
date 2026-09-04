import type { OcrWord } from "@/engine/domain";

/**
 * Text utilities shared by the extractors.
 *
 * The raw OCR output is never modified. Everything here works on a normalised
 * *copy* used only for matching, so the value shown to a user as evidence is
 * always the text the engine actually produced.
 */

/** Collapses whitespace and unifies the characters OCR most often mangles. */
export function normalise(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[‘’‛]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[‐-―]/g, "-")
    .replace(/[ \t ]+/g, " ")
    .replace(/ *\n */g, "\n");
}

export function lines(text: string): string[] {
  return normalise(text)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

/**
 * Confidence for an extracted value, derived from the OCR engine's own
 * per-word confidences over the words that make up the match.
 *
 * This is the difference between reporting what was read and reporting how
 * much that reading can be trusted. When the engine gave us no word-level
 * detail, the document mean is used rather than inventing a number.
 */
export function confidenceFor(evidence: string, words: OcrWord[], fallback: number): number {
  if (words.length === 0) return fallback;

  const pool = new Map<string, number[]>();
  for (const word of words) {
    const key = word.text.toLowerCase().replace(/[^a-z0-9₹.%/-]/g, "");
    if (!key) continue;
    const bucket = pool.get(key);
    if (bucket) bucket.push(word.confidence);
    else pool.set(key, [word.confidence]);
  }

  const tokens = evidence
    .toLowerCase()
    .split(/\s+/)
    .map((token) => token.replace(/[^a-z0-9₹.%/-]/g, ""))
    .filter(Boolean);

  const found: number[] = [];
  for (const token of tokens) {
    const bucket = pool.get(token);
    if (bucket && bucket.length > 0) found.push(bucket.shift()!);
  }

  if (found.length === 0) return fallback;
  return Math.round(found.reduce((a, b) => a + b, 0) / found.length);
}

/** Character span of a match within the normalised text, for highlighting. */
export function spanOf(haystack: string, needle: string): { start: number; end: number } | undefined {
  const start = haystack.indexOf(needle);
  if (start < 0) return undefined;
  return { start, end: start + needle.length };
}

/** The line containing a match, which is usually the most useful evidence. */
export function lineContaining(text: string, index: number): string {
  const before = text.lastIndexOf("\n", index) + 1;
  const after = text.indexOf("\n", index);
  return text.slice(before, after === -1 ? undefined : after).trim();
}
