import { Request, Response, NextFunction } from 'express';
import { UserWordProgressModel } from '../../../infrastructure/database/mongoose/models/UserWordProgressModel';
import { UserStreakModel } from '../../../infrastructure/database/mongoose/models/UserStreakModel';
import mongoose from 'mongoose';

export class StreakController {
  constructor(private deps: {
    getMyStreakUseCase: any;
    trackLearningActivityUseCase: any;
  }) {}

  getMyStreak = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHENTICATED', message: 'Authentication required' }
        });
      }

      const result = await this.deps.getMyStreakUseCase.execute({ userId });
      
      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  };

  trackActivityForTesting = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHENTICATED', message: 'Authentication required' }
        });
      }

      const { activityType } = req.body;
      if (!activityType) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'activityType is required' }
        });
      }

      const result = await this.deps.trackLearningActivityUseCase.execute({
        userId,
        activityType
      });

      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  };

  getStats = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHENTICATED', message: 'Authentication required' }
        });
      }

      // 1. Vocabulary Learned Count
      const vocabularyLearned = await UserWordProgressModel.countDocuments({
        userId,
        status: { $in: ['learning', 'known', 'difficult', 'saved'] },
        deletedAt: null
      });

      // 2. Weekly increment (updated in the last 7 days)
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const vocabularyWeeklyIncrement = await UserWordProgressModel.countDocuments({
        userId,
        status: { $in: ['learning', 'known', 'difficult', 'saved'] },
        updatedAt: { $gte: sevenDaysAgo },
        deletedAt: null
      });

      // 3. Streak
      const streakRecord = await UserStreakModel.findOne({ userId });
      const readingStreak = streakRecord?.currentStreak || 0;
      const bestStreak = streakRecord?.bestStreak || 0;

      // 4. Flashcard reviews today (VN timezone start of day)
      const now = new Date();
      const vnTime = new Date(now.getTime() + 7 * 60 * 60 * 1000);
      const vnStartOfToday = new Date(
        vnTime.getUTCFullYear(),
        vnTime.getUTCMonth(),
        vnTime.getUTCDate()
      );
      const startOfTodayUtc = new Date(vnStartOfToday.getTime() - 7 * 60 * 60 * 1000);

      const flashcardReviewsToday = await UserWordProgressModel.countDocuments({
        userId,
        lastReviewedAt: { $gte: startOfTodayUtc },
        deletedAt: null
      });

      // 5. Total reviews
      const reviewCountResult = await UserWordProgressModel.aggregate([
        { $match: { userId: new mongoose.Types.ObjectId(userId), deletedAt: null } },
        { $group: { _id: null, total: { $sum: '$reviewCount' } } }
      ]);
      const flashcardReviewsTotal = reviewCountResult[0]?.total || 0;

      // 6. Level stats
      const levelStats = await UserWordProgressModel.aggregate([
        {
          $match: {
            userId: new mongoose.Types.ObjectId(userId),
            status: { $in: ['learning', 'known', 'difficult', 'saved'] },
            deletedAt: null
          }
        },
        {
          $lookup: {
            from: 'vocabularies',
            localField: 'vocabularyId',
            foreignField: '_id',
            as: 'vocab'
          }
        },
        { $unwind: '$vocab' },
        {
          $group: {
            _id: '$vocab.level',
            count: { $sum: 1 }
          }
        }
      ]);

      const levels = { beginner: 0, elementary: 0, intermediate: 0, advanced: 0 };
      levelStats.forEach((stat) => {
        const lvl = stat._id;
        if (lvl === 'A1') levels.beginner += stat.count;
        else if (lvl === 'A2') levels.elementary += stat.count;
        else if (lvl === 'B1' || lvl === 'B2') levels.intermediate += stat.count;
        else if (lvl === 'C1' || lvl === 'C2') levels.advanced += stat.count;
      });

      // 7. Recent words
      const recentDocs = await UserWordProgressModel.find({
        userId,
        status: { $in: ['learning', 'known', 'difficult', 'saved'] },
        deletedAt: null
      })
        .sort({ updatedAt: -1 })
        .limit(4)
        .populate('vocabularyId');

      const recentWords = recentDocs.map((doc: any) => {
        const vocab = doc.vocabularyId;
        if (!vocab) return null;
        return {
          text: vocab.text,
          type: vocab.type === 'single_word' ? (vocab.partOfSpeech || 'word') : vocab.type.replace('_', ' ')
        };
      }).filter(Boolean);

      res.status(200).json({
        success: true,
        data: {
          vocabularyLearned,
          vocabularyWeeklyIncrement,
          readingStreak,
          bestStreak,
          flashcardReviewsToday,
          flashcardReviewsTotal,
          levels,
          recentWords
        }
      });
    } catch (error) {
      next(error);
    }
  };
}
