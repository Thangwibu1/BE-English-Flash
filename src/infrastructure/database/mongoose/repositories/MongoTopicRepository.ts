import { TopicRepository } from '../../../../app/ports/repositories/TopicRepository';
import { Topic } from '../../../../core/entities/Topic';
import { TopicModel, TopicDocument } from '../models/TopicModel';
import { mapTopicDocToEntity } from '../mappers/topicMapper';

export class MongoTopicRepository implements TopicRepository {
  async findById(id: string): Promise<Topic | null> {
    const doc = await TopicModel.findOne({ _id: id, deletedAt: null });
    return doc ? mapTopicDocToEntity(doc) : null;
  }

  async findAll(): Promise<Topic[]> {
    const docs = await TopicModel.find({ deletedAt: null }).sort({ name: 1 });
    return docs.map(mapTopicDocToEntity);
  }

  async create(topic: Partial<Topic>): Promise<Topic> {
    const doc = await TopicModel.create({
      name: topic.name,
      slug: topic.slug,
      description: topic.description,
      parentTopicId: topic.parentTopicId || null,
      createdBy: topic.createdBy,
      updatedBy: topic.updatedBy,
      deletedAt: null,
    });
    return mapTopicDocToEntity(doc);
  }

  async update(id: string, topic: Partial<Topic>): Promise<Topic | null> {
    const updateData: any = { ...topic };
    delete updateData.id;
    delete updateData._id;

    const doc = await TopicModel.findOneAndUpdate(
      { _id: id, deletedAt: null },
      { $set: updateData },
      { new: true }
    );
    return doc ? mapTopicDocToEntity(doc) : null;
  }

  async softDelete(id: string): Promise<void> {
    await TopicModel.updateOne(
      { _id: id },
      { $set: { deletedAt: new Date() } }
    );
  }
}
