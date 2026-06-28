import { UserStreakRepository } from '../../../../app/ports/repositories/UserStreakRepository';
import { UserStreakModel } from '../models/UserStreakModel';

function mapDoc(doc: any) {
  return {
    id: doc._id.toString(),
    userId: doc.userId.toString(),
    currentStreak: doc.currentStreak,
    bestStreak: doc.bestStreak,
    lastActiveDate: doc.lastActiveDate,
    streakUpdatedAt: doc.streakUpdatedAt,
  };
}

export class MongoUserStreakRepository implements UserStreakRepository {
  async findByUserId(userId: string) {
    const doc = await UserStreakModel.findOne({
      userId,
      deletedAt: null,
    });

    return doc ? mapDoc(doc) : null;
  }

  async create(input: any) {
    const doc = await UserStreakModel.create(input);
    return mapDoc(doc);
  }

  async updateByUserId(userId: string, input: any) {
    const doc = await UserStreakModel.findOneAndUpdate(
      {
        userId,
        deletedAt: null,
      },
      input,
      {
        new: true,
      }
    );

    return doc ? mapDoc(doc) : null;
  }
}
