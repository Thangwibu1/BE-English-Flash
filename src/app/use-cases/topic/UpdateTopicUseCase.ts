import { TopicRepository } from '../../ports/repositories/TopicRepository';
import { Topic } from '../../../core/entities/Topic';
import { slugify } from '../../../shared/utils/slugify';
import { AppError } from '../../../core/errors/AppError';

interface UpdateTopicInput {
  id: string;
  name?: string;
  description?: string;
  parentTopicId?: string | null;
  updatedBy: string;
}

export class UpdateTopicUseCase {
  constructor(private topicRepository: TopicRepository) {}

  async execute(input: UpdateTopicInput): Promise<Topic> {
    const existingTopic = await this.topicRepository.findById(input.id);
    if (!existingTopic) {
      throw new AppError('NOT_FOUND', 'Topic not found', 404);
    }

    const updateData: Partial<Topic> = {
      updatedBy: input.updatedBy,
    };

    if (input.name !== undefined) {
      const slug = slugify(input.name);
      // Ensure slug uniqueness among other topics
      const allTopics = await this.topicRepository.findAll();
      const isDuplicate = allTopics.some((t) => t.slug === slug && t.id !== input.id);
      if (isDuplicate) {
        throw new AppError('DUPLICATE_RESOURCE', 'Topic with this name already exists', 409);
      }
      updateData.name = input.name;
      updateData.slug = slug;
    }

    if (input.description !== undefined) {
      updateData.description = input.description;
    }

    if (input.parentTopicId !== undefined) {
      if (input.parentTopicId === input.id) {
        throw new AppError('VALIDATION_ERROR', 'A topic cannot be its own parent', 400);
      }
      if (input.parentTopicId !== null) {
        const parent = await this.topicRepository.findById(input.parentTopicId);
        if (!parent) {
          throw new AppError('NOT_FOUND', 'Parent topic not found', 404);
        }
      }
      updateData.parentTopicId = input.parentTopicId;
    }

    const updated = await this.topicRepository.update(input.id, updateData);
    if (!updated) {
      throw new AppError('NOT_FOUND', 'Topic not found', 404);
    }

    return updated;
  }
}
