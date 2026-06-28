import { LearningActivityType } from '../../../core/entities/UserDailyActivity';

export interface UserDailyActivityEntity {
  id: string;
  userId: string;
  date: string;
  activityTypes: LearningActivityType[];
  activityCount: number;
  firstActivityAt: Date;
  lastActivityAt: Date;
}

export interface CreateDailyActivityInput {
  userId: string;
  date: string;
  activityTypes: LearningActivityType[];
  activityCount: number;
  firstActivityAt: Date;
  lastActivityAt: Date;
}

export interface UpdateTodayActivityInput {
  userId: string;
  date: string;
  activityType: LearningActivityType;
  lastActivityAt: Date;
}

export interface UserActivityRepository {
  findByUserIdAndDate(
    userId: string,
    date: string
  ): Promise<UserDailyActivityEntity | null>;

  create(input: CreateDailyActivityInput): Promise<UserDailyActivityEntity>;

  updateTodayActivity(
    input: UpdateTodayActivityInput
  ): Promise<UserDailyActivityEntity | null>;

  findByUserIdAndDateRange(
    userId: string,
    dates: string[]
  ): Promise<UserDailyActivityEntity[]>;
}
