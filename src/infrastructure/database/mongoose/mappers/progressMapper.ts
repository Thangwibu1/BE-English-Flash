import { UserWordProgress } from '../../../../core/entities/UserWordProgress';
import { UserWordProgressDocument } from '../models/UserWordProgressModel';

export function mapWordProgressDocToEntity(doc: UserWordProgressDocument): UserWordProgress {
  return {
    id: doc._id.toString(),
    userId: doc.userId.toString(),
    vocabularyId: doc.vocabularyId.toString(),
    status: doc.status,
    ease: doc.ease,
    intervalDays: doc.intervalDays,
    dueAt: doc.dueAt,
    lastReviewedAt: doc.lastReviewedAt,
    reviewCount: doc.reviewCount,
    correctCount: doc.correctCount,
    wrongCount: doc.wrongCount,
    firstSavedAt: doc.firstSavedAt,
    markedKnownAt: doc.markedKnownAt,
    markedDifficultAt: doc.markedDifficultAt,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}
