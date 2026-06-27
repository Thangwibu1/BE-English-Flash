import { TopicRepository } from '../../ports/repositories/TopicRepository';
import { AppError } from '../../../core/errors/AppError';

interface DeleteTopicInput {
  id: string;
}

export class DeleteTopicUseCase {
  constructor(private topicRepository: TopicRepository) {}

  async execute(input: DeleteTopicInput): Promise<void> {
    const topic = await this.topicRepository.findById(input.id);
    if (!topic) {
      throw new AppError('NOT_FOUND', 'Topic not found', 404);
    }

    // Check if other topics reference this as a parent
    const allTopics = await this.topicRepository.findAll();
    const hasChildren = allTopics.some((t) => t.parentTopicId === input.id);
    if (hasChildren) {
      throw new AppError(
        'VALIDATION_ERROR',
        'Cannot delete topic because it has subtopics',
        400
      );
    }

    await this.topicRepository.softDelete(input.id);
  }
}
