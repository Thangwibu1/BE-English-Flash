import mongoose, { Schema, Document } from 'mongoose';

export interface UserReadingProgressDocument extends Document {
  userId: mongoose.Types.ObjectId;
  readingId: mongoose.Types.ObjectId;
  progressPercent: number;
  lastPositionIndex: number;
  startedAt: Date;
  lastReadAt: Date;
  completedAt?: Date | null;
  lookupCount: number;
  savedCount: number;
  deletedAt?: Date | null;
}

const UserReadingProgressSchema = new Schema<UserReadingProgressDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    readingId: { type: Schema.Types.ObjectId, ref: 'Reading', required: true },
    progressPercent: { type: Number, default: 0 },
    lastPositionIndex: { type: Number, default: 0 },
    startedAt: { type: Date, default: Date.now },
    lastReadAt: { type: Date, default: Date.now },
    completedAt: { type: Date, default: null },
    lookupCount: { type: Number, default: 0 },
    savedCount: { type: Number, default: 0 },
    deletedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
  }
);

UserReadingProgressSchema.index({ userId: 1, readingId: 1 }, { unique: true });
UserReadingProgressSchema.index({ deletedAt: 1 });

export const UserReadingProgressModel = mongoose.model<UserReadingProgressDocument>(
  'UserReadingProgress',
  UserReadingProgressSchema
);
