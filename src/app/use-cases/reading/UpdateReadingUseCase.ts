import { ReadingRepository } from '../../ports/repositories/ReadingRepository';
import { VocabularyRepository } from '../../ports/repositories/VocabularyRepository';
import { ReadingPreprocessor } from '../../ports/services/ReadingPreprocessor';
import { Reading } from '../../../core/entities/Reading';
import { slugify } from '../../../shared/utils/slugify';
import { AppError } from '../../../core/errors/AppError';

interface UpdateReadingInput {
  id: string;
  title?: string;
  subtitle?: string;
  content?: string;
  level?: string;
  topicIds?: string[];
  source?: string;
  status?: 'draft' | 'published' | 'archived';
  updatedBy: string;
}

export class UpdateReadingUseCase {
  constructor(
    private readingRepository: ReadingRepository,
    private vocabularyRepository: VocabularyRepository,
    private readingPreprocessor: ReadingPreprocessor
  ) {}

  async execute(input: UpdateReadingInput): Promise<Reading> {
    const existing = await this.readingRepository.findById(input.id);
    if (!existing) {
      throw new AppError('NOT_FOUND', 'Reading not found', 404);
    }

    const updateData: Partial<Reading> = {
      updatedBy: input.updatedBy,
    };

    if (input.title !== undefined) {
      const slug = slugify(input.title);
      const searchResult = await this.readingRepository.search({
        search: input.title,
        page: 1,
        limit: 10,
      });
      const isDuplicate = searchResult.items.some((r) => r.slug === slug && r.id !== input.id);
      if (isDuplicate) {
        throw new AppError('DUPLICATE_RESOURCE', 'Reading with this title already exists', 409);
      }
      updateData.title = input.title;
      updateData.slug = slug;
    }

    if (input.subtitle !== undefined) updateData.subtitle = input.subtitle;
    if (input.level !== undefined) updateData.level = input.level as any;
    if (input.topicIds !== undefined) updateData.topicIds = input.topicIds;
    if (input.source !== undefined) updateData.source = input.source;
    if (input.status !== undefined) updateData.status = input.status;

    if (input.content !== undefined && input.content !== existing.content) {
      updateData.content = input.content;

      // Re-run preprocessor
      const approvedForms = await this.vocabularyRepository.findAllApprovedForms();
      const preprocessResult = this.readingPreprocessor.preprocess(
        input.content,
        approvedForms
      );

      const wordCount = input.content.split(/\s+/).filter(Boolean).length;
      updateData.estimatedReadingTimeMinutes = Math.max(1, Math.ceil(wordCount / 200));
      updateData.spans = preprocessResult.spans as any;
      updateData.vocabularyIds = preprocessResult.vocabularyIds;
    }

    const updated = await this.readingRepository.update(input.id, updateData);
    if (!updated) {
      throw new AppError('NOT_FOUND', 'Reading not found', 404);
    }

    return updated;
  }
}
