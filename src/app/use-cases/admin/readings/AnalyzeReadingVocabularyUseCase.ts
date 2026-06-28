import { ReadingRepository } from '../../../ports/repositories/ReadingRepository';
import { VocabularyRepository } from '../../../ports/repositories/VocabularyRepository';
import { AiVocabularySuggestionRepository } from '../../../ports/repositories/AiVocabularySuggestionRepository';
import { AIProviderService } from '../../../ports/services/AIProviderService';
import { hashText } from '../../../../shared/utils/hashText';
import { normalizeText } from '../../../../shared/utils/normalizeText';
import { aiExtractedVocabularyResponseSchema } from '../../../../interfaces/http/validators/aiVocabularySuggestion.validator';
import { AppError } from '../../../../core/errors/AppError';

export class AnalyzeReadingVocabularyUseCase {
  constructor(private deps: {
    readingRepository: ReadingRepository;
    vocabularyRepository: VocabularyRepository;
    aiVocabularySuggestionRepository: AiVocabularySuggestionRepository;
    aiProviderService: AIProviderService;
  }) {}

  async execute(input: {
    readingId: string;
    adminUserId: string;
    force?: boolean;
  }) {
    const reading = await this.deps.readingRepository.findById(input.readingId);

    if (!reading) {
      throw new AppError('NOT_FOUND', 'Reading not found', 404);
    }

    const contentHash = hashText(reading.content);

    if (
      !input.force &&
      reading.aiAnalysisStatus === 'completed' &&
      reading.aiAnalysisHash === contentHash
    ) {
      return {
        skipped: true,
        reason: 'AI_ANALYSIS_ALREADY_COMPLETED_FOR_THIS_CONTENT',
      };
    }

    await this.deps.readingRepository.update(input.readingId, {
      aiAnalysisStatus: 'processing',
      aiAnalysisError: null,
    });

    try {
      const maxItems = process.env.AI_READING_ANALYSIS_MAX_ITEMS 
        ? parseInt(process.env.AI_READING_ANALYSIS_MAX_ITEMS)
        : 30;

      const aiResult = await this.deps.aiProviderService.extractVocabularyFromReading({
        title: reading.title,
        content: reading.content,
        maxItems,
      });

      const validated = aiExtractedVocabularyResponseSchema.parse({
        items: aiResult.items,
      });

      const suggestions: any[] = [];

      for (const item of validated.items) {
        const normalizedText = normalizeText(item.text);

        // 1. Check if normalizedText exists in dictionary
        const existsInDictionary = await this.deps.vocabularyRepository.findByNormalizedText(
          normalizedText
        );

        // 2. Check if normalizedText already exists in suggestions for this reading
        const existsInSuggestions = await this.deps.aiVocabularySuggestionRepository.findOneByReadingAndNormalizedText(
          input.readingId,
          normalizedText
        );

        let duplicateStatus: 'new' | 'exists_in_dictionary' | 'duplicate_in_suggestions' | 'possible_duplicate' = 'new';
        let duplicateVocabularyId: string | null = null;

        if (existsInDictionary) {
          duplicateStatus = 'exists_in_dictionary';
          duplicateVocabularyId = existsInDictionary.id;
        } else if (existsInSuggestions) {
          duplicateStatus = 'duplicate_in_suggestions';
        }

        suggestions.push({
          readingId: input.readingId,
          suggestedBy: 'ai' as const,
          provider: aiResult.provider,
          model: aiResult.model,
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
          duplicateStatus,
          duplicateVocabularyId,
          status: 'pending' as const,
          rawAiItem: item,
        });
      }

      let created: any[] = [];
      if (suggestions.length > 0) {
        created = await this.deps.aiVocabularySuggestionRepository.createMany(suggestions);
      }

      await this.deps.readingRepository.update(input.readingId, {
        aiAnalysisStatus: 'completed',
        aiAnalyzedAt: new Date(),
        aiAnalysisHash: contentHash,
        aiAnalysisError: null,
      });

      return {
        readingId: input.readingId,
        totalSuggestions: created.length,
        newSuggestions: created.filter((x) => x.duplicateStatus === 'new').length,
        duplicates: created.filter((x) => x.duplicateStatus !== 'new').length,
        items: created,
      };
    } catch (error: any) {
      await this.deps.readingRepository.update(input.readingId, {
        aiAnalysisStatus: 'failed',
        aiAnalysisError: error instanceof Error ? error.message : 'UNKNOWN_AI_ERROR',
      });

      throw error;
    }
  }
}
