import { normalizeText } from './normalizeText';

/**
 * Build prefix token array for fast prefix/autocomplete search in MongoDB.
 * Example: "environment" → ["en", "env", "envi", ..., "environment"]
 */
export function buildPrefixTokens(input: string): string[] {
  const normalized = normalizeText(input);
  const tokens = new Set<string>();

  for (const word of normalized.split(/\s+/)) {
    if (word.length < 2) continue;
    const max = Math.min(word.length, 20);
    for (let i = 2; i <= max; i++) {
      tokens.add(word.slice(0, i));
    }
  }

  return Array.from(tokens);
}
