import { CEFRLevel } from './Vocabulary';

export interface ReadingSpan {
  text: string;
  normalizedText?: string;
  spanType: 'word' | 'punctuation' | 'space' | 'phrase' | 'unknown';
  lemma?: string;
  vocabularyId?: string | null;
  startIndex: number;
  endIndex: number;
  orderIndex: number;
  isClickable: boolean;
}

export interface Reading {
  id: string;
  title: string;
  slug: string;
  subtitle?: string;
  content: string;
  level?: CEFRLevel;
  topicIds: string[];
  source?: string;
  estimatedReadingTimeMinutes?: number;
  spans: ReadingSpan[];
  vocabularyIds: string[];
  status: 'draft' | 'published' | 'archived';
  createdBy?: string;
  updatedBy?: string;
  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date | null;
}
