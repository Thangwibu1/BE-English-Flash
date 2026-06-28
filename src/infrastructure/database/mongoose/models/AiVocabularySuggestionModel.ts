import mongoose, { Schema } from 'mongoose';

const AiVocabularySuggestionSchema = new Schema(
  {
    readingId: {
      type: Schema.Types.ObjectId,
      ref: 'Reading',
      required: true,
      index: true,
    },

    suggestedBy: {
      type: String,
      enum: ['ai'],
      default: 'ai',
    },

    provider: {
      type: String,
      enum: ['9router'],
      required: true,
    },

    model: {
      type: String,
      required: true,
    },

    text: {
      type: String,
      required: true,
      trim: true,
    },

    normalizedText: {
      type: String,
      required: true,
      index: true,
    },

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

    level: {
      type: String,
      enum: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'],
      required: true,
    },

    partOfSpeech: {
      type: String,
      default: null,
    },

    meaningVi: {
      type: String,
      required: true,
    },

    meaningEn: {
      type: String,
      default: null,
    },

    forms: {
      type: [String],
      default: [],
    },

    topics: {
      type: [String],
      default: [],
    },

    exampleEn: {
      type: String,
      default: null,
    },

    exampleVi: {
      type: String,
      default: null,
    },

    sourceText: {
      type: String,
      default: null,
    },

    confidence: {
      type: Number,
      min: 0,
      max: 1,
      default: 0.5,
    },

    duplicateStatus: {
      type: String,
      enum: [
        'new',
        'exists_in_dictionary',
        'duplicate_in_suggestions',
        'possible_duplicate',
      ],
      default: 'new',
      index: true,
    },

    duplicateVocabularyId: {
      type: Schema.Types.ObjectId,
      ref: 'Vocabulary',
      default: null,
    },

    status: {
      type: String,
      enum: ['pending', 'edited', 'approved', 'rejected'],
      default: 'pending',
      index: true,
    },

    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    reviewedAt: {
      type: Date,
      default: null,
    },

    adminNote: {
      type: String,
      default: null,
    },

    rawAiItem: {
      type: Schema.Types.Mixed,
      default: null,
    },

    deletedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

AiVocabularySuggestionSchema.index({
  readingId: 1,
  normalizedText: 1,
});

AiVocabularySuggestionSchema.index({
  readingId: 1,
  status: 1,
});

export const AiVocabularySuggestionModel = mongoose.model(
  'AiVocabularySuggestion',
  AiVocabularySuggestionSchema
);
