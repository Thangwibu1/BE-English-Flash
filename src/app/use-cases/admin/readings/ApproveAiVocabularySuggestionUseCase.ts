import { AiVocabularySuggestionRepository } from '../../../ports/repositories/AiVocabularySuggestionRepository';
import { VocabularyRepository } from '../../../ports/repositories/VocabularyRepository';
import { ReprocessReadingUseCase } from '../../reading/ReprocessReadingUseCase';
import { AppError } from '../../../../core/errors/AppError';

export class ApproveAiVocabularySuggestionUseCase {
  constructor(private deps: {
    aiVocabularySuggestionRepository: AiVocabularySuggestionRepository;
    vocabularyRepository: VocabularyRepository;
    reprocessReadingUseCase: ReprocessReadingUseCase;
  }) {}

  async execute(input: {
    suggestionId: string;
    adminUserId: string;
  }) {
    const suggestion = await this.deps.aiVocabularySuggestionRepository.findById(
      input.suggestionId
    );

    if (!suggestion) {
      throw new AppError('NOT_FOUND', 'Suggestion not found', 404);
    }

    if (suggestion.status === 'approved') {
      return { suggestion };
    }

    let vocabulary: any = null;

    if (suggestion.duplicateStatus === 'exists_in_dictionary' && suggestion.duplicateVocabularyId) {
      vocabulary = await this.deps.vocabularyRepository.findById(
        suggestion.duplicateVocabularyId
      );
    } else {
      vocabulary = await this.deps.vocabularyRepository.create({
        text: suggestion.text,
        normalizedText: suggestion.normalizedText,
        type: suggestion.type,
        level: suggestion.level,
        partOfSpeech: suggestion.partOfSpeech || undefined,
        meanings: [{
          meaningVi: suggestion.meaningVi,
          meaningEn: suggestion.meaningEn || undefined,
          examples: suggestion.exampleEn
            ? [
                {
                  exampleEn: suggestion.exampleEn,
                  exampleVi: suggestion.exampleVi || undefined,
                },
              ]
            : [],
        }],
        forms: (suggestion.forms && suggestion.forms.length > 0)
          ? suggestion.forms.map((f: string) => ({
              formText: f,
              normalizedFormText: f.trim().toLowerCase(),
            }))
          : [{
              formText: suggestion.text,
              normalizedFormText: suggestion.normalizedText,
            }],
        topicIds: [],
        status: 'approved',
        createdBy: input.adminUserId,
      });
    }

    const updatedSuggestion = await this.deps.aiVocabularySuggestionRepository.updateById(
      input.suggestionId,
      {
        status: 'approved',
        reviewedBy: input.adminUserId,
        reviewedAt: new Date(),
      }
    );

    await this.deps.reprocessReadingUseCase.execute({
      readingId: suggestion.readingId,
    });

    return {
      suggestion: updatedSuggestion,
      vocabulary,
    };
  }
}
