import mongoose, { Schema, Document } from 'mongoose';

export interface FlashcardCardDocument extends Document {
  deckId: mongoose.Types.ObjectId;
  vocabularyId: mongoose.Types.ObjectId;
  front?: string;
  back?: string;
  example?: string;
  orderIndex: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
}

const FlashcardCardSchema = new Schema<FlashcardCardDocument>(
  {
    deckId: { type: Schema.Types.ObjectId, ref: 'FlashcardDeck', required: true },
    vocabularyId: { type: Schema.Types.ObjectId, ref: 'Vocabulary', required: true },
    front: { type: String },
    back: { type: String },
    example: { type: String },
    orderIndex: { type: Number, required: true },
    deletedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
  }
);

// Indexes
FlashcardCardSchema.index({ deckId: 1 });
FlashcardCardSchema.index({ vocabularyId: 1 });
FlashcardCardSchema.index({ deckId: 1, vocabularyId: 1 }, { unique: true });

export const FlashcardCardModel = mongoose.model<FlashcardCardDocument>(
  'FlashcardCard',
  FlashcardCardSchema
);
