import { AIProviderService } from '../../ports/services/AIProviderService';
import { VocabularyRepository } from '../../ports/repositories/VocabularyRepository';
import { normalizeText } from '../../../shared/utils/normalizeText';
import { AppError } from '../../../core/errors/AppError';

export class AnalyzeContributionReadingWithAiUseCase {
  constructor(private deps: {
    aiProviderService: AIProviderService;
    vocabularyRepository: VocabularyRepository;
  }) {}

  async execute(input: {
    userId: string;
    title?: string;
    content: string;
    level?: string;
    maxItems?: number;
  }) {
    if (!input.content || input.content.trim().length < 50) {
      throw new AppError('VALIDATION_ERROR', 'Please enter at least 50 characters before using AI.', 400);
    }

    try {
      const maxItems = input.maxItems || 30;

      const aiResult = await this.deps.aiProviderService.extractVocabularyFromReading({
        title: input.title,
        content: input.content,
        maxItems,
      });

      const checkedItems: any[] = [];

      for (let i = 0; i < aiResult.items.length; i++) {
        const item = aiResult.items[i];
        const normalizedText = normalizeText(item.text);

        const existsInDictionary = await this.deps.vocabularyRepository.findByNormalizedText(
          normalizedText
        );

        checkedItems.push({
          clientId: `ai_${Date.now()}_${i}`,
          text: item.text,
          normalizedText,
          type: item.type,
          level: item.level,
          partOfSpeech: item.partOfSpeech || null,
          meaningVi: item.meaningVi,
          meaningEn: item.meaningEn || null,
          forms: item.forms?.length ? item.forms : [item.text],
          topics: item.topics || [],
          exampleEn: item.exampleEn || null,
          exampleVi: item.exampleVi || null,
          sourceText: item.sourceText || null,
          confidence: item.confidence ?? 0.5,
          duplicateStatus: existsInDictionary ? 'exists_in_dictionary' : 'new',
          userEdited: false,
          source: 'ai',
        });
      }

      return {
        items: checkedItems,
        summary: {
          totalItems: checkedItems.length,
          newItems: checkedItems.filter((x) => x.duplicateStatus === 'new').length,
          duplicates: checkedItems.filter((x) => x.duplicateStatus !== 'new').length,
        },
      };
    } catch (error: any) {
      throw new AppError('AI_ANALYSIS_FAILED', error instanceof Error ? error.message : 'Could not analyze the reading. Please try again.', 500);
    }
  }
}
