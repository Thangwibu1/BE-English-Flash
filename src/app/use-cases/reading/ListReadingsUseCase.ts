import { ReadingRepository, ListReadingParams } from '../../ports/repositories/ReadingRepository';
import { Reading } from '../../../core/entities/Reading';

export class ListReadingsUseCase {
  constructor(private readingRepository: ReadingRepository) {}

  async execute(params: ListReadingParams): Promise<{ items: Reading[]; total: number }> {
    return this.readingRepository.search(params);
  }
}
