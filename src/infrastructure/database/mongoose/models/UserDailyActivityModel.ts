import mongoose, { Schema, Document } from 'mongoose';

export interface UserDailyActivityDocument extends Document {
  userId: mongoose.Types.ObjectId;
  date: string; // YYYY-MM-DD
  activityTypes: string[];
  activityCount: number;
  firstActivityAt: Date;
  lastActivityAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const UserDailyActivitySchema = new Schema<UserDailyActivityDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: String, required: true },
    activityTypes: { type: [String], default: [] },
    activityCount: { type: Number, default: 0 },
    firstActivityAt: { type: Date, default: Date.now },
    lastActivityAt: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
  }
);

// Indexes
UserDailyActivitySchema.index({ userId: 1, date: 1 }, { unique: true });
UserDailyActivitySchema.index({ userId: 1, lastActivityAt: -1 });

export const UserDailyActivityModel = mongoose.model<UserDailyActivityDocument>(
  'UserDailyActivity',
  UserDailyActivitySchema
);
