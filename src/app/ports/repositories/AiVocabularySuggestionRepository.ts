import { AiVocabularySuggestion } from '../../../core/entities/AiVocabularySuggestion';

export interface AiVocabularySuggestionRepository {
  findById(id: string): Promise<AiVocabularySuggestion | null>;
  
  findByReadingId(params: {
    readingId: string;
    status?: string;
  }): Promise<AiVocabularySuggestion[]>;

  findOneByReadingAndNormalizedText(
    readingId: string,
    normalizedText: string
  ): Promise<AiVocabularySuggestion | null>;

  createMany(
    suggestions: Partial<AiVocabularySuggestion>[]
  ): Promise<AiVocabularySuggestion[]>;

  updateById(
    id: string,
    data: Partial<AiVocabularySuggestion>
  ): Promise<AiVocabularySuggestion | null>;
}
