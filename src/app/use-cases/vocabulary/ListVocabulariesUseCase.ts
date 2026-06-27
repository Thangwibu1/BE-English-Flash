import { VocabularyRepository, ListVocabularyParams } from '../../ports/repositories/VocabularyRepository';
import { UserProgressRepository } from '../../ports/repositories/UserProgressRepository';
import { Vocabulary } from '../../../core/entities/Vocabulary';

export interface ListVocabulariesInput extends ListVocabularyParams {
  userId?: string;
}

export class ListVocabulariesUseCase {
  constructor(
    private vocabularyRepository: VocabularyRepository,
    private userProgressRepository: UserProgressRepository
  ) {}

  async execute(params: ListVocabulariesInput): Promise<{ items: any[]; total: number }> {
    const result = await this.vocabularyRepository.search(params);
    
    if (!params.userId) {
      return result;
    }

    const vocabularyIds = result.items.map((item) => item.id);
    const progressList = await this.userProgressRepository.findWordProgressList(
      params.userId,
      vocabularyIds
    );
    const progressMap = new Map(progressList.map((p) => [p.vocabularyId.toString(), p.status]));

    const itemsWithStatus = result.items.map((item) => ({
      ...item,
      userStatus: progressMap.get(item.id) || 'new',
    }));

    return {
      items: itemsWithStatus,
      total: result.total,
    };
  }
}
