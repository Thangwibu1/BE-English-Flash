import { TopicRepository } from '../../ports/repositories/TopicRepository';
import { Topic } from '../../../core/entities/Topic';
import { slugify } from '../../../shared/utils/slugify';
import { AppError } from '../../../core/errors/AppError';

interface CreateTopicInput {
  name: string;
  description?: string;
  parentTopicId?: string;
  createdBy: string;
}

export class CreateTopicUseCase {
  constructor(private topicRepository: TopicRepository) {}

  async execute(input: CreateTopicInput): Promise<Topic> {
    const slug = slugify(input.name);

    // Topic names must be unique
    const allTopics = await this.topicRepository.findAll();
    const isDuplicate = allTopics.some((t) => t.slug === slug);
    if (isDuplicate) {
      throw new AppError('DUPLICATE_RESOURCE', 'Topic with this name already exists', 409);
    }

    if (input.parentTopicId) {
      const parent = await this.topicRepository.findById(input.parentTopicId);
      if (!parent) {
        throw new AppError('NOT_FOUND', 'Parent topic not found', 404);
      }
    }

    return this.topicRepository.create({
      name: input.name,
      slug,
      description: input.description,
      parentTopicId: input.parentTopicId || null,
      createdBy: input.createdBy,
      updatedBy: input.createdBy,
    });
  }
}
