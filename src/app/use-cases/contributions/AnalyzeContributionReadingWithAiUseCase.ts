import type { AIProviderService } from '../../ports/services/AIProviderService';
import type { VocabularyRepository } from '../../ports/repositories/VocabularyRepository';
import { MatchAiCandidatesToVocabularyUseCase } from './MatchAiCandidatesToVocabularyUseCase';
import { AppError } from '../../../core/errors/AppError';

export class AnalyzeContributionReadingWithAiUseCase {
  private matchUseCase: MatchAiCandidatesToVocabularyUseCase;

  constructor(private deps: {
    aiProviderService: AIProviderService;
    vocabularyRepository: VocabularyRepository;
  }) {
    this.matchUseCase = new MatchAiCandidatesToVocabularyUseCase({
      vocabularyRepository: deps.vocabularyRepository,
    });
  }

  async execute(input: {
    userId: string;
    title?: string;
    content: string;
    level?: string;
    mode?: 'focused' | 'coverage';
    maxItems?: number;
  }) {
    if (!input.content || input.content.trim().length < 50) {
      throw new AppError('VALIDATION_ERROR', 'Please enter at least 50 characters before using AI.', 400);
    }

    try {
      const maxItems = input.maxItems || 120;
      const mode = input.mode || 'coverage';

      // Step 1: Get AI candidates using coverage-mode prompt
      const aiResult = await this.deps.aiProviderService.extractReadingCandidates({
        title: input.title,
        content: input.content,
        level: input.level,
        mode,
        maxItems,
      });

      // Step 2: Match candidates against vocabulary DB
      const matchedItems = await this.matchUseCase.execute({
        candidates: aiResult.items,
      });

      const matched = matchedItems.filter((x: any) => x.status === 'matched');
      const missing = matchedItems.filter((x: any) => x.status === 'missing');
      const phrases = matchedItems.filter((x: any) => x.type !== 'single_word');
      const words = matchedItems.filter((x: any) => x.type === 'single_word');

      return {
        mode,
        items: matchedItems,
        summary: {
          totalItems: matchedItems.length,
          matchedItems: matched.length,
          missingItems: missing.length,
          phraseItems: phrases.length,
          singleWordItems: words.length,
        },
      };
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      throw new AppError(
        'AI_ANALYSIS_FAILED',
        error instanceof Error ? error.message : 'Could not analyze the reading. Please try again.',
        500
      );
    }
  }
}
