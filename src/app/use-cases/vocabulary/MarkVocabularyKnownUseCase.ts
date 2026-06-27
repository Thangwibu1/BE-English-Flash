import { UserProgressRepository } from '../../ports/repositories/UserProgressRepository';
import { VocabularyRepository } from '../../ports/repositories/VocabularyRepository';
import { UserWordProgress } from '../../../core/entities/UserWordProgress';
import { AppError } from '../../../core/errors/AppError';
import { TrackLearningActivityUseCase } from '../streak/TrackLearningActivityUseCase';

interface MarkVocabularyKnownInput {
  userId: string;
  vocabularyId: string;
}

export class MarkVocabularyKnownUseCase {
  constructor(
    private userProgressRepository: UserProgressRepository,
    private vocabularyRepository: VocabularyRepository,
    private trackLearningActivityUseCase: TrackLearningActivityUseCase
  ) {}

  async execute(input: MarkVocabularyKnownInput): Promise<UserWordProgress> {
    const vocab = await this.vocabularyRepository.findById(input.vocabularyId);
    if (!vocab) {
      throw new AppError('NOT_FOUND', 'Vocabulary item not found', 404);
    }

    const updateData: Partial<UserWordProgress> = {
      status: 'known',
      markedKnownAt: new Date(),
    };

    const progress = await this.userProgressRepository.saveWordProgress(input.userId, input.vocabularyId, updateData);

    // Track learning activity
    await this.trackLearningActivityUseCase.execute({
      userId: input.userId,
      activityType: 'WORD_MARKED_KNOWN'
    });

    return progress;
  }
}
