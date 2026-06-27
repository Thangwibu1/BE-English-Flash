export type VocabularyType =
  | 'single_word'
  | 'compound_word'
  | 'collocation'
  | 'phrasal_verb'
  | 'idiom'
  | 'fixed_phrase'
  | 'sentence_pattern';

export type CEFRLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

export interface VocabularyMeaning {
  meaningVi: string;
  meaningEn?: string;
  note?: string;
  examples: {
    exampleEn: string;
    exampleVi?: string;
    source?: string;
  }[];
}

export interface VocabularyForm {
  formText: string;
  normalizedFormText: string;
  formType?: string;
  note?: string;
}

export interface VocabularyComponent {
  componentText: string;
  componentVocabularyId?: string;
  role?: string;
  orderIndex: number;
}

export interface Vocabulary {
  id: string;
  text: string;
  normalizedText: string;
  type: VocabularyType;
  level?: CEFRLevel;
  partOfSpeech?: string;
  phonetic?: string;
  audioUrl?: string;
  meanings: VocabularyMeaning[];
  forms: VocabularyForm[];
  components: VocabularyComponent[];
  topicIds: string[];
  status: 'draft' | 'approved' | 'rejected' | 'archived';
  createdBy?: string;
  updatedBy?: string;
  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date | null;
}
