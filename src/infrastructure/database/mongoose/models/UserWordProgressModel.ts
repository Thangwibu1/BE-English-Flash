import mongoose, { Schema, Document } from 'mongoose';

export type WordLearningStatus = 'new' | 'saved' | 'learning' | 'known' | 'difficult' | 'ignored';

export interface UserWordProgressDocument extends Document {
  userId: mongoose.Types.ObjectId;
  vocabularyId: mongoose.Types.ObjectId;
  status: WordLearningStatus;
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
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
}

const UserWordProgressSchema = new Schema<UserWordProgressDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    vocabularyId: { type: Schema.Types.ObjectId, ref: 'Vocabulary', required: true },
    status: {
      type: String,
      enum: ['new', 'saved', 'learning', 'known', 'difficult', 'ignored'],
      default: 'new',
    },
    ease: { type: Number, default: 2.5 },
    intervalDays: { type: Number, default: 0 },
    dueAt: { type: Date },
    lastReviewedAt: { type: Date },
    reviewCount: { type: Number, default: 0 },
    correctCount: { type: Number, default: 0 },
    wrongCount: { type: Number, default: 0 },
    firstSavedAt: { type: Date },
    markedKnownAt: { type: Date },
    markedDifficultAt: { type: Date },
    deletedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
  }
);

// Indexes
UserWordProgressSchema.index({ userId: 1, vocabularyId: 1 }, { unique: true });
UserWordProgressSchema.index({ userId: 1, status: 1 });
UserWordProgressSchema.index({ userId: 1, dueAt: 1 });
UserWordProgressSchema.index({ deletedAt: 1 });

export const UserWordProgressModel = mongoose.model<UserWordProgressDocument>(
  'UserWordProgress',
  UserWordProgressSchema
);
