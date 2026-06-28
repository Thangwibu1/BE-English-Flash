export type LearningActivityType =
  | 'READING_OPENED'
  | 'READING_COMPLETED'
  | 'VOCAB_LOOKUP'
  | 'VOCAB_SAVED'
  | 'FLASHCARD_REVIEWED'
  | 'WORD_MARKED_KNOWN'
  | 'WORD_MARKED_DIFFICULT'
  | 'CARD_CREATED';

export interface UserDailyActivity {
  id: string;
  userId: string;
  date: string;
  activityTypes: LearningActivityType[];
  activityCount: number;
  firstActivityAt: Date;
  lastActivityAt: Date;
  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date | null;
}
