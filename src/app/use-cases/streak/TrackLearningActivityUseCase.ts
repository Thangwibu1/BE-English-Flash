import { UserDailyActivityModel } from '../../../infrastructure/database/mongoose/models/UserDailyActivityModel';
import { UserStreakModel } from '../../../infrastructure/database/mongoose/models/UserStreakModel';

interface TrackLearningActivityInput {
  userId: string;
  activityType: string;
}

export class TrackLearningActivityUseCase {
  async execute(input: TrackLearningActivityInput): Promise<void> {
    const { userId, activityType } = input;

    // Get date strings in Asia/Ho_Chi_Minh timezone
    const todayDate = this.getVietnamDateString(new Date());

    // 1. Check if user already has an activity today
    let dailyActivity = await UserDailyActivityModel.findOne({ userId, date: todayDate });
    
    if (!dailyActivity) {
      // First activity of today
      dailyActivity = new UserDailyActivityModel({
        userId,
        date: todayDate,
        activityTypes: [activityType],
        activityCount: 1,
        firstActivityAt: new Date(),
        lastActivityAt: new Date()
      });
      await dailyActivity.save();

      // Since it's the first activity of today, update the streak
      await this.updateStreak(userId, todayDate);
    } else {
      // Already active today, just increment activity count
      dailyActivity.activityCount += 1;
      dailyActivity.lastActivityAt = new Date();
      if (!dailyActivity.activityTypes.includes(activityType)) {
        dailyActivity.activityTypes.push(activityType);
      }
      await dailyActivity.save();
    }
  }

  private async updateStreak(userId: string, todayDate: string): Promise<void> {
    let streak = await UserStreakModel.findOne({ userId });

    if (!streak) {
      // No streak record yet, create first one
      streak = new UserStreakModel({
        userId,
        currentStreak: 1,
        bestStreak: 1,
        lastActiveDate: todayDate,
        streakUpdatedAt: new Date()
      });
      await streak.save();
      return;
    }

    // Get yesterday's date string in Asia/Ho_Chi_Minh timezone
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const yesterdayDate = this.getVietnamDateString(yesterday);

    if (streak.lastActiveDate === todayDate) {
      // Already updated today, do nothing
      return;
    }

    if (streak.lastActiveDate === yesterdayDate) {
      // Continued streak from yesterday
      streak.currentStreak += 1;
      if (streak.currentStreak > streak.bestStreak) {
        streak.bestStreak = streak.currentStreak;
      }
      streak.lastActiveDate = todayDate;
      streak.streakUpdatedAt = new Date();
    } else {
      // Streak broken (last active date was before yesterday)
      streak.currentStreak = 1;
      streak.lastActiveDate = todayDate;
      streak.streakUpdatedAt = new Date();
    }

    await streak.save();
  }

  private getVietnamDateString(date: Date): string {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(date); // Output: YYYY-MM-DD
  }
}
