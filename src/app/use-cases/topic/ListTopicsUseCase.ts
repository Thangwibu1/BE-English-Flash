import { TopicRepository } from '../../ports/repositories/TopicRepository';
import { Topic } from '../../../core/entities/Topic';

export class ListTopicsUseCase {
  constructor(private topicRepository: TopicRepository) {}

  async execute(): Promise<Topic[]> {
    return this.topicRepository.findAll();
  }
}
