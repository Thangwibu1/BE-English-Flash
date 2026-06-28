import { UserActivityRepository } from '../../ports/repositories/UserActivityRepository';
import { UserStreakRepository } from '../../ports/repositories/UserStreakRepository';
import { getLastSevenDateKeys } from '../../../shared/utils/dateKey';

export class GetMyStreakUseCase {
  constructor(
    private userActivityRepository: UserActivityRepository,
    private userStreakRepository: UserStreakRepository
  ) {}

  async execute(input: { userId: string }) {
    const streak = await this.userStreakRepository.findByUserId(input.userId);

    const dateKeys = getLastSevenDateKeys();
    const activities =
      await this.userActivityRepository.findByUserIdAndDateRange(
        input.userId,
        dateKeys
      );

    const activeDateSet = new Set(activities.map((activity) => activity.date));

    const week = dateKeys.map((dateKey, index) => {
      const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      const isToday = index === dateKeys.length - 1;

      return {
        date: dateKey,
        label: isToday ? 'Today' : labels[index] || dateKey,
        active: activeDateSet.has(dateKey),
      };
    });

    return {
      currentStreak: streak?.currentStreak || 0,
      bestStreak: streak?.bestStreak || 0,
      lastActiveDate: streak?.lastActiveDate || null,
      week,
    };
  }
}
