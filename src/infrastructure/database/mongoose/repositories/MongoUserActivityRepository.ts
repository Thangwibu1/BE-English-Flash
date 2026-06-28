import { UserActivityRepository } from '../../../../app/ports/repositories/UserActivityRepository';
import { UserDailyActivityModel } from '../models/UserDailyActivityModel';

function mapDoc(doc: any) {
  return {
    id: doc._id.toString(),
    userId: doc.userId.toString(),
    date: doc.date,
    activityTypes: doc.activityTypes,
    activityCount: doc.activityCount,
    firstActivityAt: doc.firstActivityAt,
    lastActivityAt: doc.lastActivityAt,
  };
}

export class MongoUserActivityRepository implements UserActivityRepository {
  async findByUserIdAndDate(userId: string, date: string) {
    const doc = await UserDailyActivityModel.findOne({
      userId,
      date,
      deletedAt: null,
    });

    return doc ? mapDoc(doc) : null;
  }

  async create(input: any) {
    const doc = await UserDailyActivityModel.create(input);
    return mapDoc(doc);
  }

  async updateTodayActivity(input: any) {
    const doc = await UserDailyActivityModel.findOneAndUpdate(
      {
        userId: input.userId,
        date: input.date,
        deletedAt: null,
      },
      {
        $addToSet: {
          activityTypes: input.activityType,
        },
        $inc: {
          activityCount: 1,
        },
        $set: {
          lastActivityAt: input.lastActivityAt,
        },
      },
      {
        new: true,
      }
    );

    return doc ? mapDoc(doc) : null;
  }

  async findByUserIdAndDateRange(userId: string, dates: string[]) {
    const docs = await UserDailyActivityModel.find({
      userId,
      date: { $in: dates },
      deletedAt: null,
    });

    return docs.map(mapDoc);
  }
}
