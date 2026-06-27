import mongoose, { Schema, Document } from 'mongoose';

export type VocabularyType =
  | 'single_word'
  | 'compound_word'
  | 'collocation'
  | 'phrasal_verb'
  | 'idiom'
  | 'fixed_phrase'
  | 'sentence_pattern';

export type CEFRLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

export interface VocabularyDocument extends Document {
  text: string;
  normalizedText: string;
  type: VocabularyType;
  level?: CEFRLevel;
  partOfSpeech?: string;
  phonetic?: string;
  audioUrl?: string;
  meanings: {
    meaningVi: string;
    meaningEn?: string;
    note?: string;
    examples: {
      exampleEn: string;
      exampleVi?: string;
      source?: string;
    }[];
  }[];
  forms: {
    formText: string;
    normalizedFormText: string;
    formType?: string;
    note?: string;
  }[];
  components: {
    componentText: string;
    componentVocabularyId?: mongoose.Types.ObjectId;
    role?: string;
    orderIndex: number;
  }[];
  topicIds: mongoose.Types.ObjectId[];
  status: 'draft' | 'approved' | 'rejected' | 'archived';
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
}

const VocabularySchema = new Schema<VocabularyDocument>(
  {
    text: { type: String, required: true },
    normalizedText: { type: String, required: true, index: true },
    type: {
      type: String,
      enum: [
        'single_word',
        'compound_word',
        'collocation',
        'phrasal_verb',
        'idiom',
        'fixed_phrase',
        'sentence_pattern',
      ],
      required: true,
    },
    level: { type: String, enum: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] },
    partOfSpeech: { type: String },
    phonetic: { type: String },
    audioUrl: { type: String },
    meanings: [
      {
        meaningVi: { type: String, required: true },
        meaningEn: { type: String },
        note: { type: String },
        examples: [
          {
            exampleEn: { type: String, required: true },
            exampleVi: { type: String },
            source: { type: String },
          },
        ],
      },
    ],
    forms: [
      {
        formText: { type: String, required: true },
        normalizedFormText: { type: String, required: true, index: true },
        formType: { type: String },
        note: { type: String },
      },
    ],
    components: [
      {
        componentText: { type: String, required: true },
        componentVocabularyId: { type: Schema.Types.ObjectId, ref: 'Vocabulary' },
        role: { type: String },
        orderIndex: { type: Number, required: true },
      },
    ],
    topicIds: [{ type: Schema.Types.ObjectId, ref: 'Topic' }],
    status: {
      type: String,
      enum: ['draft', 'approved', 'rejected', 'archived'],
      default: 'approved',
    },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    deletedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
  }
);

// Indexes
VocabularySchema.index({ type: 1 });
VocabularySchema.index({ level: 1 });
VocabularySchema.index({ topicIds: 1 });
VocabularySchema.index({ status: 1 });
VocabularySchema.index({ deletedAt: 1 });
VocabularySchema.index({
  text: 'text',
  normalizedText: 'text',
  'meanings.meaningVi': 'text',
  'meanings.meaningEn': 'text',
});

export const VocabularyModel = mongoose.model<VocabularyDocument>(
  'Vocabulary',
  VocabularySchema
);
