export interface AiExtractedVocabularyItem {
  text: string;
  type:
    | 'single_word'
    | 'compound_word'
    | 'collocation'
    | 'phrasal_verb'
    | 'idiom'
    | 'fixed_phrase'
    | 'sentence_pattern';
  level?: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
  partOfSpeech?: string;
  meaningVi?: string;
  meaningEn?: string;
  forms?: string[];
  topics?: string[];
  exampleEn?: string;
  exampleVi?: string;
  sourceText?: string;
  confidence?: number;
  priority?: number;
}

export interface ExtractVocabularyResult {
  provider: '9router';
  model: string;
  items: AiExtractedVocabularyItem[];
  rawResponse?: unknown;
}

export interface AIProviderService {
  /** Original vocabulary extraction method (contribution flow) */
  extractVocabularyFromReading(input: {
    title?: string;
    content: string;
    maxItems?: number;
  }): Promise<ExtractVocabularyResult>;

  /** Coverage-mode candidate extraction for span matching flow */
  extractReadingCandidates(input: {
    title?: string;
    content: string;
    level?: string;
    mode?: 'focused' | 'coverage';
    maxItems?: number;
  }): Promise<ExtractVocabularyResult>;
}
