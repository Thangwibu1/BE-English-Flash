import { VocabularyRepository } from '../../ports/repositories/VocabularyRepository';
import { AppError } from '../../../core/errors/AppError';

interface DeleteVocabularyInput {
  id: string;
}

export class DeleteVocabularyUseCase {
  constructor(private vocabularyRepository: VocabularyRepository) {}

  async execute(input: DeleteVocabularyInput): Promise<void> {
    const existing = await this.vocabularyRepository.findById(input.id);
    if (!existing) {
      throw new AppError('NOT_FOUND', 'Vocabulary item not found', 404);
    }

    await this.vocabularyRepository.softDelete(input.id);
  }
}
