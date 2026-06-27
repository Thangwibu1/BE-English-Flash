import { ReadingRepository } from '../../ports/repositories/ReadingRepository';
import { VocabularyRepository } from '../../ports/repositories/VocabularyRepository';
import { ReadingPreprocessor } from '../../ports/services/ReadingPreprocessor';
import { Reading } from '../../../core/entities/Reading';
import { AppError } from '../../../core/errors/AppError';

interface ReprocessReadingInput {
  readingId: string;
}

export class ReprocessReadingUseCase {
  constructor(
    private readingRepository: ReadingRepository,
    private vocabularyRepository: VocabularyRepository,
    private readingPreprocessor: ReadingPreprocessor
  ) {}

  async execute(input: ReprocessReadingInput): Promise<Reading> {
    const reading = await this.readingRepository.findById(input.readingId);
    if (!reading) {
      throw new AppError('NOT_FOUND', 'Reading not found', 404);
    }

    // Fetch approved vocabulary forms
    const approvedForms = await this.vocabularyRepository.findAllApprovedForms();

    // Reprocess
    const preprocessResult = this.readingPreprocessor.preprocess(
      reading.content,
      approvedForms
    );

    const updated = await this.readingRepository.update(reading.id, {
      spans: preprocessResult.spans as any,
      vocabularyIds: preprocessResult.vocabularyIds,
    });

    if (!updated) {
      throw new AppError('NOT_FOUND', 'Reading not found', 404);
    }

    return updated;
  }
}
