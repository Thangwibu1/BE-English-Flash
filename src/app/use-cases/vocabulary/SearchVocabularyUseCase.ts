import { normalizeText } from '../../../shared/utils/normalizeText';
import { VocabularyRepository } from '../../ports/repositories/VocabularyRepository';
import { FuzzyVocabularySearchService } from '../../../infrastructure/services/FuzzyVocabularySearchService';
import { Vocabulary } from '../../../core/entities/Vocabulary';

type SearchResult = Vocabulary & {
  matchType: 'exact' | 'prefix' | 'fuzzy';
  score: number;
};

function mergeUniqueResults(existing: SearchResult[], incoming: SearchResult[]): SearchResult[] {
  const map = new Map<string, SearchResult>();
  for (const item of existing) map.set(item.id, item);
  for (const item of incoming) {
    if (!map.has(item.id)) map.set(item.id, item);
  }
  return Array.from(map.values());
}

function buildSuggestions(results: SearchResult[]): string[] {
  return results
    .filter((r) => r.matchType === 'fuzzy')
    .slice(0, 5)
    .map((r) => r.text);
}

export class SearchVocabularyUseCase {
  constructor(
    private vocabularyRepository: VocabularyRepository,
    private fuzzySearchService: FuzzyVocabularySearchService
  ) {}

  async execute(input: {
    query: string;
    type?: string;
    level?: string;
    topic?: string;
    limit?: number;
  }) {
    const limit = input.limit || 20;
    const normalizedQuery = normalizeText(input.query || '');

    if (!normalizedQuery) {
      return {
        query: input.query,
        normalizedQuery,
        results: [],
        suggestions: [],
        meta: { exactCount: 0, prefixCount: 0, fuzzyCount: 0 },
      };
    }

    // 1. Exact match
    const exactDocs = await this.vocabularyRepository.searchExact({
      normalizedQuery,
      type: input.type,
      level: input.level,
      topic: input.topic,
      limit,
    });

    let results: SearchResult[] = exactDocs.map((item) => ({
      ...item,
      matchType: 'exact',
      score: 0,
    }));

    const remainingAfterExact = limit - results.length;

    // 2. Prefix match
    let prefixDocs: Vocabulary[] = [];
    if (remainingAfterExact > 0) {
      prefixDocs = await this.vocabularyRepository.searchPrefix({
        token: normalizedQuery,
        type: input.type,
        level: input.level,
        topic: input.topic,
        limit: remainingAfterExact,
      });

      results = mergeUniqueResults(
        results,
        prefixDocs.map((item) => ({ ...item, matchType: 'prefix', score: 0.1 }))
      );
    }

    const remainingAfterPrefix = limit - results.length;

    // 3. Fuzzy fallback (Fuse.js)
    let fuzzyResults: any[] = [];
    if (remainingAfterPrefix > 0) {
      const rawFuzzy = await this.fuzzySearchService.search({
        query: normalizedQuery,
        limit: remainingAfterPrefix * 3,
      });

      fuzzyResults = rawFuzzy
        .filter((item) => {
          if (input.type && item.type !== input.type) return false;
          if (input.level && item.level !== input.level) return false;
          return true;
        })
        .slice(0, remainingAfterPrefix);

      // Map fuzzy results to SearchResult shape (they have subset fields)
      results = mergeUniqueResults(
        results,
        fuzzyResults.map((item) => ({
          ...item,
          matchType: 'fuzzy' as const,
        }))
      );
    }

    return {
      query: input.query,
      normalizedQuery,
      results: results.slice(0, limit),
      suggestions: buildSuggestions(results),
      meta: {
        exactCount: exactDocs.length,
        prefixCount: prefixDocs.length,
        fuzzyCount: fuzzyResults.length,
      },
    };
  }
}
