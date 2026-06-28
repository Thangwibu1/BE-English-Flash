export interface UserStreakEntity {
  id: string;
  userId: string;
  currentStreak: number;
  bestStreak: number;
  lastActiveDate: string | null;
  streakUpdatedAt: Date | null;
}

export interface CreateUserStreakInput {
  userId: string;
  currentStreak: number;
  bestStreak: number;
  lastActiveDate: string;
  streakUpdatedAt: Date;
}

export interface UpdateUserStreakInput {
  currentStreak?: number;
  bestStreak?: number;
  lastActiveDate?: string;
  streakUpdatedAt?: Date;
}

export interface UserStreakRepository {
  findByUserId(userId: string): Promise<UserStreakEntity | null>;

  create(input: CreateUserStreakInput): Promise<UserStreakEntity>;

  updateByUserId(
    userId: string,
    input: UpdateUserStreakInput
  ): Promise<UserStreakEntity | null>;
}
