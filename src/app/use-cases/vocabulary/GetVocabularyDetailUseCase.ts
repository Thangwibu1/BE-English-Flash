import { VocabularyRepository } from '../../ports/repositories/VocabularyRepository';
import { UserProgressRepository } from '../../ports/repositories/UserProgressRepository';
import { Vocabulary } from '../../../core/entities/Vocabulary';
import { UserWordProgress } from '../../../core/entities/UserWordProgress';
import { AppError } from '../../../core/errors/AppError';

interface GetVocabularyDetailInput {
  id: string;
  userId?: string;
}

interface GetVocabularyDetailOutput {
  vocabulary: Vocabulary;
  userProgress?: UserWordProgress | null;
}

export class GetVocabularyDetailUseCase {
  constructor(
    private vocabularyRepository: VocabularyRepository,
    private userProgressRepository: UserProgressRepository
  ) {}

  async execute(input: GetVocabularyDetailInput): Promise<GetVocabularyDetailOutput> {
    const vocabulary = await this.vocabularyRepository.findById(input.id);
    if (!vocabulary) {
      throw new AppError('NOT_FOUND', 'Vocabulary item not found', 404);
    }

    let userProgress: UserWordProgress | null = null;
    if (input.userId) {
      userProgress = await this.userProgressRepository.findWordProgress(input.userId, input.id);
    }

    return {
      vocabulary,
      userProgress,
    };
  }
}
