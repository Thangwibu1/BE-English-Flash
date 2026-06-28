import { AiVocabularySuggestionRepository } from '../../../ports/repositories/AiVocabularySuggestionRepository';

export class GetReadingAiSuggestionsUseCase {
  constructor(private deps: {
    aiVocabularySuggestionRepository: AiVocabularySuggestionRepository;
  }) {}

  async execute(input: {
    readingId: string;
    status?: string;
  }) {
    return this.deps.aiVocabularySuggestionRepository.findByReadingId({
      readingId: input.readingId,
      status: input.status,
    });
  }
}
