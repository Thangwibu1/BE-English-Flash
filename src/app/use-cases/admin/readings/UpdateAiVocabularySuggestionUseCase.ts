import { AiVocabularySuggestionRepository } from '../../../ports/repositories/AiVocabularySuggestionRepository';
import { AppError } from '../../../../core/errors/AppError';
import { normalizeText } from '../../../../shared/utils/normalizeText';

export class UpdateAiVocabularySuggestionUseCase {
  constructor(private deps: {
    aiVocabularySuggestionRepository: AiVocabularySuggestionRepository;
  }) {}

  async execute(input: {
    suggestionId: string;
    adminUserId: string;
    patch: Record<string, any>;
  }) {
    const suggestion = await this.deps.aiVocabularySuggestionRepository.findById(input.suggestionId);
    if (!suggestion) {
      throw new AppError('NOT_FOUND', 'Suggestion not found', 404);
    }

    const updateData: any = { ...input.patch };
    
    if (updateData.text) {
      updateData.normalizedText = normalizeText(updateData.text);
    }

    updateData.status = 'edited';

    return this.deps.aiVocabularySuggestionRepository.updateById(
      input.suggestionId,
      updateData
    );
  }
}
