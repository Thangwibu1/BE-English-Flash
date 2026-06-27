import { Vocabulary } from '../../../core/entities/Vocabulary';

export interface ListVocabularyParams {
  search?: string;
  type?: string;
  level?: string;
  topicId?: string;
  page: number;
  limit: number;
}

export interface VocabularyRepository {
  findById(id: string): Promise<Vocabulary | null>;
  findByIds(ids: string[]): Promise<Vocabulary[]>;
  search(params: ListVocabularyParams): Promise<{
    items: Vocabulary[];
    total: number;
  }>;
  create(data: Partial<Vocabulary>): Promise<Vocabulary>;
  update(id: string, data: Partial<Vocabulary>): Promise<Vocabulary | null>;
  softDelete(id: string): Promise<void>;
  findAllApprovedForms(): Promise<{
    vocabularyId: string;
    text: string;
    normalizedText: string;
    type: string;
  }[]>;
}
