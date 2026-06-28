export type VocabularyType =
  | 'single_word'
  | 'compound_word'
  | 'collocation'
  | 'phrasal_verb'
  | 'idiom'
  | 'fixed_phrase'
  | 'sentence_pattern';

export type SuggestionStatus =
  | 'pending'
  | 'edited'
  | 'approved'
  | 'rejected';

export type DuplicateStatus =
  | 'new'
  | 'exists_in_dictionary'
  | 'duplicate_in_suggestions'
  | 'possible_duplicate';

export interface AiVocabularySuggestion {
  id: string;
  readingId: string;

  suggestedBy: 'ai';
  provider: '9router';
  model: string;

  text: string;
  normalizedText: string;

  type: VocabularyType;
  level: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
  partOfSpeech?: string | null;

  meaningVi: string;
  meaningEn?: string | null;

  forms: string[];
  topics: string[];

  exampleEn?: string | null;
  exampleVi?: string | null;
  sourceText?: string | null;

  confidence: number;

  duplicateStatus: DuplicateStatus;
  duplicateVocabularyId?: string | null;

  status: SuggestionStatus;

  reviewedBy?: string | null;
  reviewedAt?: Date | null;
  adminNote?: string | null;

  rawAiItem?: unknown;
  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date | null;
}
