import { UserProgressRepository } from '../../ports/repositories/UserProgressRepository';
import { ReadingRepository } from '../../ports/repositories/ReadingRepository';
import { AppError } from '../../../core/errors/AppError';
import { TrackLearningActivityUseCase } from '../streak/TrackLearningActivityUseCase';

interface UpdateReadingProgressInput {
  userId: string;
  readingId: string;
  progressPercent: number;
  lastPositionIndex: number;
}

export class UpdateReadingProgressUseCase {
  constructor(
    private userProgressRepository: UserProgressRepository,
    private readingRepository: ReadingRepository,
    private trackLearningActivityUseCase: TrackLearningActivityUseCase
  ) {}

  async execute(input: UpdateReadingProgressInput): Promise<any> {
    const reading = await this.readingRepository.findById(input.readingId);
    if (!reading) {
      throw new AppError('NOT_FOUND', 'Reading not found', 404);
    }

    const existing = await this.userProgressRepository.findReadingProgress(
      input.userId,
      input.readingId
    );

    const updateData: any = {
      progressPercent: input.progressPercent,
      lastPositionIndex: input.lastPositionIndex,
      lastReadAt: new Date(),
    };

    const isCompleted = input.progressPercent >= 100;
    if (isCompleted && (!existing || !existing.completedAt)) {
      updateData.completedAt = new Date();
    }

    const progress = await this.userProgressRepository.saveReadingProgress(
      input.userId,
      input.readingId,
      updateData
    );

    // Track learning activity
    await this.trackLearningActivityUseCase.execute({
      userId: input.userId,
      activityType: isCompleted ? 'READING_COMPLETED' : 'READING_OPENED'
    });

    return progress;
  }
}
