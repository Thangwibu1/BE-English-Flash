import { UserWordProgress } from '../../../core/entities/UserWordProgress';

export interface UserProgressRepository {
  findWordProgress(userId: string, vocabularyId: string): Promise<UserWordProgress | null>;
  findWordProgressList(userId: string, vocabularyIds: string[]): Promise<UserWordProgress[]>;
  saveWordProgress(userId: string, vocabularyId: string, progress: any): Promise<UserWordProgress>;
  findReadingProgress(userId: string, readingId: string): Promise<any | null>;
  saveReadingProgress(userId: string, readingId: string, progress: any): Promise<any>;
  saveLookup(lookup: {
    userId: string;
    readingId: string;
    vocabularyId: string;
    readingSpanId?: string;
    lookupText?: string;
    lookedUpAt: Date;
  }): Promise<void>;
}
