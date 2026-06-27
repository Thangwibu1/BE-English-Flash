import mongoose, { Schema, Document } from 'mongoose';

export interface UserReadingLookupDocument extends Document {
  userId: mongoose.Types.ObjectId;
  readingId: mongoose.Types.ObjectId;
  vocabularyId: mongoose.Types.ObjectId;
  readingSpanId?: string;
  lookupText?: string;
  lookedUpAt: Date;
  deletedAt?: Date | null;
}

const UserReadingLookupSchema = new Schema<UserReadingLookupDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    readingId: { type: Schema.Types.ObjectId, ref: 'Reading', required: true },
    vocabularyId: { type: Schema.Types.ObjectId, ref: 'Vocabulary', required: true },
    readingSpanId: { type: String },
    lookupText: { type: String },
    lookedUpAt: { type: Date, default: Date.now },
    deletedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
  }
);

UserReadingLookupSchema.index({ userId: 1, readingId: 1 });
UserReadingLookupSchema.index({ userId: 1, vocabularyId: 1 });
UserReadingLookupSchema.index({ deletedAt: 1 });

export const UserReadingLookupModel = mongoose.model<UserReadingLookupDocument>(
  'UserReadingLookup',
  UserReadingLookupSchema
);
