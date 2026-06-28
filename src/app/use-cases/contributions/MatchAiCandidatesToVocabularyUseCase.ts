import { VocabularyRepository } from '../../ports/repositories/VocabularyRepository';
import { normalizeText } from '../../../shared/utils/normalizeText';
import type { AiExtractedVocabularyItem } from '../../ports/services/AIProviderService';

function getTypePriority(type: string): number {
  const priority: Record<string, number> = {
    idiom: 7,
    phrasal_verb: 6,
    collocation: 5,
    fixed_phrase: 4,
    sentence_pattern: 3,
    compound_word: 2,
    single_word: 1,
  };
  return priority[type] || 0;
}

function dedupeCandidates(candidates: AiExtractedVocabularyItem[]): AiExtractedVocabularyItem[] {
  const map = new Map<string, AiExtractedVocabularyItem>();

  for (const candidate of candidates) {
    const key = normalizeText(candidate.text);
    const existing = map.get(key);

    if (!existing) {
      map.set(key, candidate);
      continue;
    }

    const existingScore =
      getTypePriority(existing.type) * 1000 +
      normalizeText(existing.text).length +
      (existing.confidence || 0);

    const nextScore =
      getTypePriority(candidate.type) * 1000 +
      normalizeText(candidate.text).length +
      (candidate.confidence || 0);

    if (nextScore > existingScore) {
      map.set(key, candidate);
    }
  }

  return Array.from(map.values());
}

function sortMatchedItems(items: any[]): any[] {
  return [...items].sort((a, b) => {
    const lengthDiff = normalizeText(b.text).length - normalizeText(a.text).length;
    if (lengthDiff !== 0) return lengthDiff;

    const typeDiff = getTypePriority(b.type) - getTypePriority(a.type);
    if (typeDiff !== 0) return typeDiff;

    const confA = a.ai?.confidence ?? a.suggestedVocabulary?.confidence ?? 0;
    const confB = b.ai?.confidence ?? b.suggestedVocabulary?.confidence ?? 0;
    return confB - confA;
  });
}

export class MatchAiCandidatesToVocabularyUseCase {
  constructor(
    private deps: {
      vocabularyRepository: VocabularyRepository;
    }
  ) {}

  async execute(input: { candidates: AiExtractedVocabularyItem[] }) {
    const deduped = dedupeCandidates(input.candidates);
    const items: any[] = [];

    // Batch lookup all normalizedTexts at once for performance
    const normalizedTexts = deduped.map((c) => normalizeText(c.text));
    const existing = await this.deps.vocabularyRepository.findManyByNormalizedTexts(normalizedTexts);
    const existingMap = new Map(existing.map((v) => [v.normalizedText, v]));

    for (const candidate of deduped) {
      const normalizedText = normalizeText(candidate.text);

      let vocabulary = existingMap.get(normalizedText) || null;

      // Fallback: search by form (e.g. "exploring" → "explore")
      if (!vocabulary) {
        vocabulary = await this.deps.vocabularyRepository.findByFormNormalizedText(normalizedText);
      }

      if (vocabulary) {
        const firstMeaning = (vocabulary.meanings as any[])?.[0];
        items.push({
          text: candidate.text,
          normalizedText,
          type: candidate.type,
          status: 'matched',
          vocabularyId: vocabulary.id,
          matchMethod: 'normalized_text',
          vocabulary: {
            id: vocabulary.id,
            text: vocabulary.text,
            type: vocabulary.type,
            level: vocabulary.level,
            meaningVi: firstMeaning?.meaningVi || vocabulary.text,
          },
          ai: {
            confidence: candidate.confidence,
            sourceText: candidate.sourceText,
          },
        });
      } else {
        items.push({
          text: candidate.text,
          normalizedText,
          type: candidate.type,
          status: 'missing',
          vocabularyId: null,
          suggestedVocabulary: {
            text: candidate.text,
            normalizedText,
            type: candidate.type,
            level: candidate.level,
            partOfSpeech: candidate.partOfSpeech,
            meaningVi: candidate.meaningVi,
            meaningEn: candidate.meaningEn,
            forms: candidate.forms?.length ? candidate.forms : [candidate.text],
            topics: candidate.topics || [],
            exampleEn: candidate.exampleEn,
            exampleVi: candidate.exampleVi,
            sourceText: candidate.sourceText,
            confidence: candidate.confidence ?? 0.5,
          },
        });
      }
    }

    return sortMatchedItems(items);
  }
}
