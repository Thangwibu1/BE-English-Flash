import { Reading } from '../../../core/entities/Reading';

export interface ListReadingParams {
  search?: string;
  level?: string;
  topicId?: string;
  status?: string;
  page: number;
  limit: number;
}

export interface ReadingRepository {
  findById(id: string): Promise<Reading | null>;
  search(params: ListReadingParams): Promise<{
    items: Reading[];
    total: number;
  }>;
  create(data: Partial<Reading>): Promise<Reading>;
  update(id: string, data: Partial<Reading>): Promise<Reading | null>;
  softDelete(id: string): Promise<void>;
}
