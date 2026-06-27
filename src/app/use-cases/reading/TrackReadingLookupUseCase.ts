import { UserProgressRepository } from '../../ports/repositories/UserProgressRepository';
import { ReadingRepository } from '../../ports/repositories/ReadingRepository';
import { VocabularyRepository } from '../../ports/repositories/VocabularyRepository';
import { AppError } from '../../../core/errors/AppError';
import { TrackLearningActivityUseCase } from '../streak/TrackLearningActivityUseCase';

interface TrackReadingLookupInput {
  userId: string;
  readingId: string;
  vocabularyId: string;
  readingSpanId?: string;
  lookupText?: string;
}

export class TrackReadingLookupUseCase {
  constructor(
    private userProgressRepository: UserProgressRepository,
    private readingRepository: ReadingRepository,
    private vocabularyRepository: VocabularyRepository,
    private trackLearningActivityUseCase: TrackLearningActivityUseCase
  ) {}

  async execute(input: TrackReadingLookupInput): Promise<void> {
    const reading = await this.readingRepository.findById(input.readingId);
    if (!reading) {
      throw new AppError('NOT_FOUND', 'Reading not found', 404);
    }

    const vocab = await this.vocabularyRepository.findById(input.vocabularyId);
    if (!vocab) {
      throw new AppError('NOT_FOUND', 'Vocabulary item not found', 404);
    }

    await this.userProgressRepository.saveLookup({
      userId: input.userId,
      readingId: input.readingId,
      vocabularyId: input.vocabularyId,
      readingSpanId: input.readingSpanId,
      lookupText: input.lookupText,
      lookedUpAt: new Date(),
    });

    // Track learning activity
    await this.trackLearningActivityUseCase.execute({
      userId: input.userId,
      activityType: 'VOCAB_LOOKUP'
    });
  }
}
