import { Topic } from '../../../core/entities/Topic';

export interface TopicRepository {
  findById(id: string): Promise<Topic | null>;
  findAll(): Promise<Topic[]>;
  create(topic: Partial<Topic>): Promise<Topic>;
  update(id: string, topic: Partial<Topic>): Promise<Topic | null>;
  softDelete(id: string): Promise<void>;
}
