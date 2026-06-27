import { ReviewScheduler, ReviewScheduleResult } from '../../app/ports/services/ReviewScheduler';

export class BasicReviewScheduler implements ReviewScheduler {
  schedule(input: {
    rating: 'again' | 'hard' | 'good' | 'easy';
    currentIntervalDays?: number;
  }): ReviewScheduleResult {
    const intervalMap = {
      again: 1,
      hard: 3,
      good: 7,
      easy: 14,
    };

    const intervalDays = intervalMap[input.rating];
    const dueAt = new Date();
    dueAt.setDate(dueAt.getDate() + intervalDays);

    return {
      intervalDays,
      dueAt,
    };
  }
}
