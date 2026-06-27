import { UserProgressRepository } from '../../../../app/ports/repositories/UserProgressRepository';
import { UserWordProgress } from '../../../../core/entities/UserWordProgress';
import { UserWordProgressModel } from '../models/UserWordProgressModel';
import { UserReadingProgressModel } from '../models/UserReadingProgressModel';
import { UserReadingLookupModel } from '../models/UserReadingLookupModel';
import { mapWordProgressDocToEntity } from '../mappers/progressMapper';
import mongoose from 'mongoose';

export class MongoUserProgressRepository implements UserProgressRepository {
  async findWordProgress(userId: string, vocabularyId: string): Promise<UserWordProgress | null> {
    const doc = await UserWordProgressModel.findOne({
      userId,
      vocabularyId,
      deletedAt: null,
    });
    return doc ? mapWordProgressDocToEntity(doc) : null;
  }

  async findWordProgressList(userId: string, vocabularyIds: string[]): Promise<UserWordProgress[]> {
    const validIds = vocabularyIds.filter((id) => mongoose.Types.ObjectId.isValid(id));
    const docs = await UserWordProgressModel.find({
      userId,
      vocabularyId: { $in: validIds },
      deletedAt: null,
    });
    return docs.map(mapWordProgressDocToEntity);
  }

  async saveWordProgress(
    userId: string,
    vocabularyId: string,
    progress: Partial<UserWordProgress>
  ): Promise<UserWordProgress> {
    const updateData: any = { ...progress };
    delete updateData.id;
    delete updateData._id;
    delete updateData.userId;
    delete updateData.vocabularyId;

    const doc = await UserWordProgressModel.findOneAndUpdate(
      { userId, vocabularyId },
      { $set: updateData },
      { new: true, upsert: true }
    );
    return mapWordProgressDocToEntity(doc);
  }

  async findReadingProgress(userId: string, readingId: string): Promise<any | null> {
    const doc = await UserReadingProgressModel.findOne({
      userId,
      readingId,
      deletedAt: null,
    });
    if (!doc) return null;
    return {
      id: doc._id.toString(),
      userId: doc.userId.toString(),
      readingId: doc.readingId.toString(),
      progressPercent: doc.progressPercent,
      lastPositionIndex: doc.lastPositionIndex,
      startedAt: doc.startedAt,
      lastReadAt: doc.lastReadAt,
      completedAt: doc.completedAt,
      lookupCount: doc.lookupCount,
      savedCount: doc.savedCount,
    };
  }

  async saveReadingProgress(userId: string, readingId: string, progress: any): Promise<any> {
    const updateData = { ...progress };
    delete updateData.id;
    delete updateData._id;
    delete updateData.userId;
    delete updateData.readingId;

    const doc = await UserReadingProgressModel.findOneAndUpdate(
      { userId, readingId },
      { $set: updateData },
      { new: true, upsert: true }
    );
    return {
      id: doc._id.toString(),
      userId: doc.userId.toString(),
      readingId: doc.readingId.toString(),
      progressPercent: doc.progressPercent,
      lastPositionIndex: doc.lastPositionIndex,
      startedAt: doc.startedAt,
      lastReadAt: doc.lastReadAt,
      completedAt: doc.completedAt,
      lookupCount: doc.lookupCount,
      savedCount: doc.savedCount,
    };
  }

  async saveLookup(lookup: {
    userId: string;
    readingId: string;
    vocabularyId: string;
    readingSpanId?: string;
    lookupText?: string;
    lookedUpAt: Date;
  }): Promise<void> {
    await UserReadingLookupModel.create({
      userId: lookup.userId,
      readingId: lookup.readingId,
      vocabularyId: lookup.vocabularyId,
      readingSpanId: lookup.readingSpanId,
      lookupText: lookup.lookupText,
      lookedUpAt: lookup.lookedUpAt,
    });

    // Increment lookupCount in reading progress
    await UserReadingProgressModel.updateOne(
      { userId: lookup.userId, readingId: lookup.readingId },
      { $inc: { lookupCount: 1 } }
    );
  }
}
