import { ReadingRepository, ListReadingParams } from '../../../../app/ports/repositories/ReadingRepository';
import { Reading } from '../../../../core/entities/Reading';
import { ReadingModel, ReadingDocument } from '../models/ReadingModel';
import { mapReadingDocToEntity } from '../mappers/readingMapper';

export class MongoReadingRepository implements ReadingRepository {
  async findById(id: string): Promise<Reading | null> {
    const doc = await ReadingModel.findOne({ _id: id, deletedAt: null });
    return doc ? mapReadingDocToEntity(doc) : null;
  }

  async search(params: ListReadingParams): Promise<{ items: Reading[]; total: number }> {
    const query: any = { deletedAt: null };

    if (params.search) {
      const regex = new RegExp(params.search.trim(), 'i');
      query.$or = [{ title: regex }, { subtitle: regex }, { content: regex }];
    }

    if (params.level) {
      query.level = params.level;
    }

    if (params.topicId) {
      query.topicIds = params.topicId;
    }

    const total = await ReadingModel.countDocuments(query);
    const docs = await ReadingModel.find(query)
      .sort({ createdAt: -1 })
      .skip((params.page - 1) * params.limit)
      .limit(params.limit);

    return {
      items: docs.map(mapReadingDocToEntity),
      total,
    };
  }

  async create(data: Partial<Reading>): Promise<Reading> {
    const doc = await ReadingModel.create({
      title: data.title,
      slug: data.slug,
      subtitle: data.subtitle,
      content: data.content,
      level: data.level,
      topicIds: data.topicIds,
      source: data.source,
      estimatedReadingTimeMinutes: data.estimatedReadingTimeMinutes || 0,
      spans: data.spans,
      vocabularyIds: data.vocabularyIds,
      status: data.status || 'draft',
      createdBy: data.createdBy,
      updatedBy: data.updatedBy,
      deletedAt: null,
    });
    return mapReadingDocToEntity(doc);
  }

  async update(id: string, data: Partial<Reading>): Promise<Reading | null> {
    const updateData: any = { ...data };
    delete updateData.id;
    delete updateData._id;

    const doc = await ReadingModel.findOneAndUpdate(
      { _id: id, deletedAt: null },
      { $set: updateData },
      { new: true }
    );
    return doc ? mapReadingDocToEntity(doc) : null;
  }

  async softDelete(id: string): Promise<void> {
    await ReadingModel.updateOne(
      { _id: id },
      { $set: { deletedAt: new Date() } }
    );
  }
}
