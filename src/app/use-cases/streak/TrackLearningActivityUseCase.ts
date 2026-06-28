import { LearningActivityType } from '../../../core/entities/UserDailyActivity';
import { UserActivityRepository } from '../../ports/repositories/UserActivityRepository';
import { UserStreakRepository } from '../../ports/repositories/UserStreakRepository';
import {
  getVietnamDateKey,
  getYesterdayDateKey,
} from '../../../shared/utils/dateKey';

export class TrackLearningActivityUseCase {
  constructor(
    private userActivityRepository: UserActivityRepository,
    private userStreakRepository: UserStreakRepository
  ) {}

  async execute(input: {
    userId: string;
    activityType: LearningActivityType;
  }) {
    const now = new Date();
    const today = getVietnamDateKey(now);
    const yesterday = getYesterdayDateKey(now);

    const existingTodayActivity =
      await this.userActivityRepository.findByUserIdAndDate(
        input.userId,
        today
      );

    if (existingTodayActivity) {
      await this.userActivityRepository.updateTodayActivity({
        userId: input.userId,
        date: today,
        activityType: input.activityType,
        lastActivityAt: now,
      });

      return this.userStreakRepository.findByUserId(input.userId);
    }

    await this.userActivityRepository.create({
      userId: input.userId,
      date: today,
      activityTypes: [input.activityType],
      activityCount: 1,
      firstActivityAt: now,
      lastActivityAt: now,
    });

    const streak = await this.userStreakRepository.findByUserId(input.userId);

    if (!streak) {
      return this.userStreakRepository.create({
        userId: input.userId,
        currentStreak: 1,
        bestStreak: 1,
        lastActiveDate: today,
        streakUpdatedAt: now,
      });
    }

    if (streak.lastActiveDate === today) {
      return streak;
    }

    if (streak.lastActiveDate === yesterday) {
      const nextCurrentStreak = streak.currentStreak + 1;

      return this.userStreakRepository.updateByUserId(input.userId, {
        currentStreak: nextCurrentStreak,
        bestStreak: Math.max(streak.bestStreak, nextCurrentStreak),
        lastActiveDate: today,
        streakUpdatedAt: now,
      });
    }

    return this.userStreakRepository.updateByUserId(input.userId, {
      currentStreak: 1,
      bestStreak: streak.bestStreak,
      lastActiveDate: today,
      streakUpdatedAt: now,
    });
  }
}
