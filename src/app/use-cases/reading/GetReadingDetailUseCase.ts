import { ReadingRepository } from '../../ports/repositories/ReadingRepository';
import { VocabularyRepository } from '../../ports/repositories/VocabularyRepository';
import { UserProgressRepository } from '../../ports/repositories/UserProgressRepository';
import { Reading } from '../../../core/entities/Reading';
import { Vocabulary } from '../../../core/entities/Vocabulary';
import { AppError } from '../../../core/errors/AppError';

interface GetReadingDetailInput {
  readingId: string;
  userId?: string;
}

interface GetReadingDetailOutput {
  reading: Reading;
  vocabularyMap: Record<string, Vocabulary>;
  userProgress?: any;
}

export class GetReadingDetailUseCase {
  constructor(
    private readingRepository: ReadingRepository,
    private vocabularyRepository: VocabularyRepository,
    private userProgressRepository: UserProgressRepository
  ) {}

  async execute(input: GetReadingDetailInput): Promise<GetReadingDetailOutput> {
    const reading = await this.readingRepository.findById(input.readingId);
    if (!reading) {
      throw new AppError('NOT_FOUND', 'Reading not found', 404);
    }

    // Fetch matched vocabularies
    const vocabularies = await this.vocabularyRepository.findByIds(reading.vocabularyIds);
    const vocabularyMap: Record<string, Vocabulary> = {};
    vocabularies.forEach((vocab) => {
      vocabularyMap[vocab.id] = vocab;
    });

    // Handle user progress
    let userProgress: any = null;
    if (input.userId) {
      userProgress = await this.userProgressRepository.findReadingProgress(
        input.userId,
        input.readingId
      );

      if (!userProgress) {
        userProgress = await this.userProgressRepository.saveReadingProgress(
          input.userId,
          input.readingId,
          {
            progressPercent: 0,
            lastPositionIndex: 0,
            lookupCount: 0,
            savedCount: 0,
            startedAt: new Date(),
            lastReadAt: new Date(),
          }
        );
      } else {
        // Update lastReadAt
        userProgress = await this.userProgressRepository.saveReadingProgress(
          input.userId,
          input.readingId,
          {
            lastReadAt: new Date(),
          }
        );
      }
    }

    return {
      reading,
      vocabularyMap,
      userProgress,
    };
  }
}
