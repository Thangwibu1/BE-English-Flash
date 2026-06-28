import { AiVocabularySuggestionRepository } from '../../../ports/repositories/AiVocabularySuggestionRepository';
import { AppError } from '../../../../core/errors/AppError';

export class RejectAiVocabularySuggestionUseCase {
  constructor(private deps: {
    aiVocabularySuggestionRepository: AiVocabularySuggestionRepository;
  }) {}

  async execute(input: {
    suggestionId: string;
    adminUserId: string;
    adminNote?: string;
  }) {
    const suggestion = await this.deps.aiVocabularySuggestionRepository.findById(
      input.suggestionId
    );

    if (!suggestion) {
      throw new AppError('NOT_FOUND', 'Suggestion not found', 404);
    }

    return this.deps.aiVocabularySuggestionRepository.updateById(
      input.suggestionId,
      {
        status: 'rejected',
        reviewedBy: input.adminUserId,
        reviewedAt: new Date(),
        adminNote: input.adminNote || null,
      }
    );
  }
}
