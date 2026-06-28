import mongoose, { Schema, Document } from 'mongoose';
import { CEFRLevel } from './VocabularyModel';

export interface ReadingSpan {
  text: string;
  normalizedText?: string;
  spanType: 'word' | 'punctuation' | 'space' | 'phrase' | 'unknown';
  lemma?: string;
  vocabularyId?: mongoose.Types.ObjectId | null;
  startIndex: number;
  endIndex: number;
  orderIndex: number;
  isClickable: boolean;
}

export interface ReadingDocument extends Document {
  title: string;
  slug: string;
  subtitle?: string;
  content: string;
  level?: CEFRLevel;
  topicIds: mongoose.Types.ObjectId[];
  source?: string;
  estimatedReadingTimeMinutes?: number;
  spans: ReadingSpan[];
  vocabularyIds: mongoose.Types.ObjectId[];
  status: 'draft' | 'published' | 'archived';
  aiAnalysisStatus?: 'not_started' | 'processing' | 'completed' | 'failed';
  aiAnalyzedAt?: Date | null;
  aiAnalysisHash?: string | null;
  aiAnalysisError?: string | null;
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
}

const ReadingSpanSchema = new Schema<ReadingSpan>({
  text: { type: String, required: true },
  normalizedText: { type: String },
  spanType: {
    type: String,
    enum: ['word', 'punctuation', 'space', 'phrase', 'unknown'],
    required: true,
  },
  lemma: { type: String },
  vocabularyId: { type: Schema.Types.ObjectId, ref: 'Vocabulary', default: null },
  startIndex: { type: Number, required: true },
  endIndex: { type: Number, required: true },
  orderIndex: { type: Number, required: true },
  isClickable: { type: Boolean, required: true },
});

const ReadingSchema = new Schema<ReadingDocument>(
  {
    title: { type: String, required: true },
    slug: { type: String, required: true, unique: true, index: true },
    subtitle: { type: String },
    content: { type: String, required: true },
    level: { type: String, enum: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] },
    topicIds: [{ type: Schema.Types.ObjectId, ref: 'Topic' }],
    source: { type: String },
    estimatedReadingTimeMinutes: { type: Number, default: 0 },
    spans: [ReadingSpanSchema],
    vocabularyIds: [{ type: Schema.Types.ObjectId, ref: 'Vocabulary' }],
    status: {
      type: String,
      enum: ['draft', 'published', 'archived'],
      default: 'draft',
    },
    aiAnalysisStatus: {
      type: String,
      enum: ['not_started', 'processing', 'completed', 'failed'],
      default: 'not_started',
    },
    aiAnalyzedAt: { type: Date, default: null },
    aiAnalysisHash: { type: String, default: null },
    aiAnalysisError: { type: String, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    deletedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
  }
);

// Indexes
ReadingSchema.index({ level: 1 });
ReadingSchema.index({ topicIds: 1 });
ReadingSchema.index({ status: 1 });
ReadingSchema.index({ vocabularyIds: 1 });
ReadingSchema.index({ deletedAt: 1 });

export const ReadingModel = mongoose.model<ReadingDocument>('Reading', ReadingSchema);
