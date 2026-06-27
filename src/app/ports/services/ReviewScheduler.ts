export interface ReviewScheduleResult {
  intervalDays: number;
  dueAt: Date;
}

export interface ReviewScheduler {
  schedule(input: {
    rating: 'again' | 'hard' | 'good' | 'easy';
    currentIntervalDays?: number;
  }): ReviewScheduleResult;
}
