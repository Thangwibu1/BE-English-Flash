export interface VocabularyFormForMatching {
  vocabularyId: string;
  text: string;
  normalizedText: string;
  type: string;
}

export interface ReadingSpanOutput {
  text: string;
  normalizedText?: string;
  spanType: string;
  lemma?: string;
  vocabularyId?: string | null;
  startIndex: number;
  endIndex: number;
  orderIndex: number;
  isClickable: boolean;
}

export interface ReadingPreprocessResult {
  spans: ReadingSpanOutput[];
  vocabularyIds: string[];
}

export interface ReadingPreprocessor {
  preprocess(
    content: string,
    forms: VocabularyFormForMatching[]
  ): ReadingPreprocessResult;
}
