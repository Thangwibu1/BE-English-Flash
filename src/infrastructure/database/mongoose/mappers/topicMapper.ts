import { Topic } from '../../../../core/entities/Topic';
import { TopicDocument } from '../models/TopicModel';

export function mapTopicDocToEntity(doc: TopicDocument): Topic {
  return {
    id: doc._id.toString(),
    name: doc.name,
    slug: doc.slug,
    description: doc.description,
    parentTopicId: doc.parentTopicId ? doc.parentTopicId.toString() : null,
    createdBy: doc.createdBy ? doc.createdBy.toString() : undefined,
    updatedBy: doc.updatedBy ? doc.updatedBy.toString() : undefined,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    deletedAt: doc.deletedAt,
  };
}
