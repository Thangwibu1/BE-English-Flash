import { ReadingRepository } from '../../ports/repositories/ReadingRepository';
import { AppError } from '../../../core/errors/AppError';

interface DeleteReadingInput {
  id: string;
}

export class DeleteReadingUseCase {
  constructor(private readingRepository: ReadingRepository) {}

  async execute(input: DeleteReadingInput): Promise<void> {
    const existing = await this.readingRepository.findById(input.id);
    if (!existing) {
      throw new AppError('NOT_FOUND', 'Reading not found', 404);
    }

    await this.readingRepository.softDelete(input.id);
  }
}
