export interface UserWordProgress {
  id: string;
  userId: string;
  vocabularyId: string;
  status: 'new' | 'saved' | 'learning' | 'known' | 'difficult' | 'ignored';
  ease?: number;
  intervalDays: number;
  dueAt?: Date;
  lastReviewedAt?: Date;
  reviewCount: number;
  correctCount: number;
  wrongCount: number;
  firstSavedAt?: Date;
  markedKnownAt?: Date;
  markedDifficultAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}
