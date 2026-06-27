import { ReadingRepository } from '../../ports/repositories/ReadingRepository';
import { VocabularyRepository } from '../../ports/repositories/VocabularyRepository';
import { ReadingPreprocessor } from '../../ports/services/ReadingPreprocessor';
import { Reading } from '../../../core/entities/Reading';
import { slugify } from '../../../shared/utils/slugify';
import { AppError } from '../../../core/errors/AppError';

interface CreateReadingInput {
  title: string;
  subtitle?: string;
  content: string;
  level?: string;
  topicIds?: string[];
  source?: string;
  status?: 'draft' | 'published' | 'archived';
  createdBy: string;
}

export class CreateReadingUseCase {
  constructor(
    private readingRepository: ReadingRepository,
    private vocabularyRepository: VocabularyRepository,
    private readingPreprocessor: ReadingPreprocessor
  ) {}

  async execute(input: CreateReadingInput): Promise<Reading> {
    const slug = slugify(input.title);

    // Validate slug uniqueness among readings
    const searchResult = await this.readingRepository.search({
      search: input.title,
      page: 1,
      limit: 10,
    });
    const isDuplicate = searchResult.items.some((r) => r.slug === slug);
    if (isDuplicate) {
      throw new AppError('DUPLICATE_RESOURCE', 'Reading with this title already exists', 409);
    }

    // Fetch approved vocabulary forms
    const approvedForms = await this.vocabularyRepository.findAllApprovedForms();

    // Preprocess reading content to match vocabulary
    const preprocessResult = this.readingPreprocessor.preprocess(
      input.content,
      approvedForms
    );

    // Calculate reading time
    const wordCount = input.content.split(/\s+/).filter(Boolean).length;
    const estimatedReadingTimeMinutes = Math.max(1, Math.ceil(wordCount / 200));

    return this.readingRepository.create({
      title: input.title,
      slug,
      subtitle: input.subtitle,
      content: input.content,
      level: input.level as any,
      topicIds: input.topicIds || [],
      source: input.source,
      estimatedReadingTimeMinutes,
      spans: preprocessResult.spans as any,
      vocabularyIds: preprocessResult.vocabularyIds,
      status: input.status || 'draft',
      createdBy: input.createdBy,
      updatedBy: input.createdBy,
    });
  }
}
