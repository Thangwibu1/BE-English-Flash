import { UserProgressRepository } from '../../ports/repositories/UserProgressRepository';
import { ReviewScheduler } from '../../ports/services/ReviewScheduler';
import { UserWordProgress } from '../../../core/entities/UserWordProgress';
import { AppError } from '../../../core/errors/AppError';

interface ReviewFlashcardInput {
  userId: string;
  deckId: string;
  cardId: string;
  vocabularyId: string;
  rating: 'again' | 'hard' | 'good' | 'easy';
}

export class ReviewFlashcardUseCase {
  constructor(
    private userProgressRepository: UserProgressRepository,
    private reviewScheduler: ReviewScheduler
  ) {}

  async execute(input: ReviewFlashcardInput): Promise<UserWordProgress> {
    const existingProgress = await this.userProgressRepository.findWordProgress(
      input.userId,
      input.vocabularyId
    );

    const currentInterval = existingProgress ? existingProgress.intervalDays : 0;

    const scheduleResult = this.reviewScheduler.schedule({
      rating: input.rating,
      currentIntervalDays: currentInterval,
    });

    const isCorrect = input.rating !== 'again';
    const reviewCount = existingProgress ? existingProgress.reviewCount + 1 : 1;
    const correctCount = existingProgress
      ? existingProgress.correctCount + (isCorrect ? 1 : 0)
      : isCorrect ? 1 : 0;
    const wrongCount = existingProgress
      ? existingProgress.wrongCount + (isCorrect ? 0 : 1)
      : isCorrect ? 0 : 1;

    const updateData: Partial<UserWordProgress> = {
      status: 'learning',
      intervalDays: scheduleResult.intervalDays,
      dueAt: scheduleResult.dueAt,
      lastReviewedAt: new Date(),
      reviewCount,
      correctCount,
      wrongCount,
    };

    if (input.rating === 'easy') {
      updateData.status = 'known';
    } else if (input.rating === 'hard') {
      updateData.status = 'difficult';
    }

    return this.userProgressRepository.saveWordProgress(
      input.userId,
      input.vocabularyId,
      updateData
    );
  }
}
