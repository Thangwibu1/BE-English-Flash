import { UserStreakModel } from '../../../infrastructure/database/mongoose/models/UserStreakModel';
import { UserDailyActivityModel } from '../../../infrastructure/database/mongoose/models/UserDailyActivityModel';

interface GetStreakInput {
  userId: string;
}

interface WeekDayInfo {
  date: string;
  label: string;
  active: boolean;
}

interface GetStreakOutput {
  currentStreak: number;
  bestStreak: number;
  lastActiveDate: string;
  week: WeekDayInfo[];
}

export class GetStreakUseCase {
  async execute(input: GetStreakInput): Promise<GetStreakOutput> {
    const { userId } = input;

    // Fetch streak
    let streak = await UserStreakModel.findOne({ userId });
    
    // Default fallback if no streak document exists yet
    if (!streak) {
      streak = new UserStreakModel({
        userId,
        currentStreak: 0,
        bestStreak: 0,
        lastActiveDate: '',
      });
    }

    // Check if the current streak is broken (if lastActiveDate is before yesterday)
    const today = new Date();
    const todayStr = this.getVietnamDateString(today);
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const yesterdayStr = this.getVietnamDateString(yesterday);

    let currentStreak = streak.currentStreak;
    if (streak.lastActiveDate && streak.lastActiveDate !== todayStr && streak.lastActiveDate !== yesterdayStr) {
      currentStreak = 0; // Streak is broken
    }

    // Build the week info (last 7 days ending today)
    const week: WeekDayInfo[] = [];
    const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    // Generate date array for the last 7 days
    const dates: Date[] = [];
    for (let i = 6; i >= 0; i--) {
      dates.push(new Date(Date.now() - i * 24 * 60 * 60 * 1000));
    }

    // Fetch all daily activity records for this user in these 7 dates
    const dateStrings = dates.map(d => this.getVietnamDateString(d));
    const activities = await UserDailyActivityModel.find({
      userId,
      date: { $in: dateStrings }
    });

    const activeDatesSet = new Set(activities.map(a => a.date));

    for (let i = 0; i < 7; i++) {
      const d = dates[i];
      const dateStr = dateStrings[i];
      
      let label = dayLabels[d.getDay()];
      if (i === 6) {
        label = 'Today';
      }

      week.push({
        date: dateStr,
        label,
        active: activeDatesSet.has(dateStr)
      });
    }

    return {
      currentStreak,
      bestStreak: streak.bestStreak,
      lastActiveDate: streak.lastActiveDate,
      week
    };
  }

  private getVietnamDateString(date: Date): string {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(date);
  }
}
