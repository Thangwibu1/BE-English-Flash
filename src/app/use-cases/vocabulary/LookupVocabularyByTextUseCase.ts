import { normalizeText } from '../../../shared/utils/normalizeText';
import { VocabularyRepository } from '../../ports/repositories/VocabularyRepository';
import { FuzzyVocabularySearchService } from '../../../infrastructure/services/FuzzyVocabularySearchService';
import { Vocabulary } from '../../../core/entities/Vocabulary';

export class LookupVocabularyByTextUseCase {
  constructor(
    private vocabularyRepository: VocabularyRepository,
    private fuzzySearchService: FuzzyVocabularySearchService
  ) {}

  async execute(input: {
    text: string;
    includeSuggestions?: boolean;
  }) {
    const normalizedText = normalizeText(input.text);

    if (!normalizedText) {
      throw new Error('EMPTY_LOOKUP_TEXT');
    }

    // 1. Look up by exact normalizedText
    let vocabulary = await this.vocabularyRepository.findByNormalizedText(normalizedText);

    // 2. If not found, look up by inflected forms
    if (!vocabulary) {
      vocabulary = await this.vocabularyRepository.findByFormNormalizedText(normalizedText);
    }

    if (vocabulary) {
      const firstMeaning = vocabulary.meanings?.[0];
      return {
        status: 'matched',
        normalizedText,
        vocabulary: {
          id: vocabulary.id,
          text: vocabulary.text,
          normalizedText: vocabulary.normalizedText,
          type: vocabulary.type,
          level: vocabulary.level,
          meaningVi: firstMeaning?.meaningVi || '',
          meaningEn: firstMeaning?.meaningEn || '',
          forms: vocabulary.forms?.map((f) => (typeof f === 'string' ? f : f.formText)) || [],
          topics: vocabulary.topicIds || [],
        },
        suggestions: [],
      };
    }

    // 3. Optional fuzzy search suggestions
    let suggestions: any[] = [];
    if (input.includeSuggestions !== false) {
      const fuzzyResults = await this.fuzzySearchService.search({
        query: normalizedText,
        limit: 5,
      });

      suggestions = fuzzyResults.map((item) => ({
        id: item.id,
        text: item.text,
        type: item.type,
        level: item.level,
        meaningVi: item.meaningVi || '',
        matchType: 'similar',
      }));
    }

    return {
      status: 'missing',
      normalizedText,
      vocabulary: null,
      suggestions,
    };
  }
}
