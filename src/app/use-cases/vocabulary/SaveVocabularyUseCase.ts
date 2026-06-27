import { UserProgressRepository } from '../../ports/repositories/UserProgressRepository';
import { VocabularyRepository } from '../../ports/repositories/VocabularyRepository';
import { UserWordProgress } from '../../../core/entities/UserWordProgress';
import { AppError } from '../../../core/errors/AppError';
import { TrackLearningActivityUseCase } from '../streak/TrackLearningActivityUseCase';

interface SaveVocabularyInput {
  userId: string;
  vocabularyId: string;
}

export class SaveVocabularyUseCase {
  constructor(
    private userProgressRepository: UserProgressRepository,
    private vocabularyRepository: VocabularyRepository,
    private trackLearningActivityUseCase: TrackLearningActivityUseCase
  ) {}

  async execute(input: SaveVocabularyInput): Promise<UserWordProgress> {
    const vocab = await this.vocabularyRepository.findById(input.vocabularyId);
    if (!vocab) {
      throw new AppError('NOT_FOUND', 'Vocabulary item not found', 404);
    }

    const existing = await this.userProgressRepository.findWordProgress(input.userId, input.vocabularyId);

    const updateData: Partial<UserWordProgress> = {
      status: 'saved',
    };

    if (!existing || !existing.firstSavedAt) {
      updateData.firstSavedAt = new Date();
    }

    const progress = await this.userProgressRepository.saveWordProgress(input.userId, input.vocabularyId, updateData);
    
    // Track learning activity
    await this.trackLearningActivityUseCase.execute({
      userId: input.userId,
      activityType: 'VOCAB_SAVED'
    });

    return progress;
  }
}
