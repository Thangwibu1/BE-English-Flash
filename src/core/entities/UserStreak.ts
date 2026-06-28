export interface UserStreak {
  id: string;
  userId: string;
  currentStreak: number;
  bestStreak: number;
  lastActiveDate: string | null;
  streakUpdatedAt: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date | null;
}
