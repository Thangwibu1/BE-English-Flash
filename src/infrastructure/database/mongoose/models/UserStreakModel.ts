import mongoose, { Schema, Document } from 'mongoose';

export interface UserStreakDocument extends Document {
  userId: mongoose.Types.ObjectId;
  currentStreak: number;
  bestStreak: number;
  lastActiveDate: string; // YYYY-MM-DD
  streakUpdatedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const UserStreakSchema = new Schema<UserStreakDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    currentStreak: { type: Number, default: 0 },
    bestStreak: { type: Number, default: 0 },
    lastActiveDate: { type: String, required: true },
    streakUpdatedAt: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
  }
);

// Indexes
UserStreakSchema.index({ userId: 1 }, { unique: true });

export const UserStreakModel = mongoose.model<UserStreakDocument>(
  'UserStreak',
  UserStreakSchema
);
