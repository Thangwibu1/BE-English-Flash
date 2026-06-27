import mongoose, { Schema, Document } from 'mongoose';

export interface FlashcardDeckDocument extends Document {
  ownerId: mongoose.Types.ObjectId;
  name: string;
  description?: string;
  visibility: 'public' | 'private';
  status: 'active' | 'archived';
  cardCount: number;
  sourceDeckId?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
}

const FlashcardDeckSchema = new Schema<FlashcardDeckDocument>(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true },
    description: { type: String },
    visibility: { type: String, enum: ['public', 'private'], default: 'private' },
    status: { type: String, enum: ['active', 'archived'], default: 'active' },
    cardCount: { type: Number, default: 0 },
    sourceDeckId: { type: Schema.Types.ObjectId, ref: 'FlashcardDeck', default: null },
    deletedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
  }
);

// Indexes
FlashcardDeckSchema.index({ ownerId: 1 });
FlashcardDeckSchema.index({ visibility: 1 });
FlashcardDeckSchema.index({ status: 1 });
FlashcardDeckSchema.index({ deletedAt: 1 });

export const FlashcardDeckModel = mongoose.model<FlashcardDeckDocument>(
  'FlashcardDeck',
  FlashcardDeckSchema
);
