import { UserProgressRepository } from '../../ports/repositories/UserProgressRepository';
import { ReadingRepository } from '../../ports/repositories/ReadingRepository';
import { AppError } from '../../../core/errors/AppError';

interface UpdateReadingProgressInput {
  userId: string;
  readingId: string;
  progressPercent: number;
  lastPositionIndex: number;
}

export class UpdateReadingProgressUseCase {
  constructor(
    private userProgressRepository: UserProgressRepository,
    private readingRepository: ReadingRepository
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

    if (input.progressPercent >= 100 && (!existing || !existing.completedAt)) {
      updateData.completedAt = new Date();
    }

    return this.userProgressRepository.saveReadingProgress(
      input.userId,
      input.readingId,
      updateData
    );
  }
}
