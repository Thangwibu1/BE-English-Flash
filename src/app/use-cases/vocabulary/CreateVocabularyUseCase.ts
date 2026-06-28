import { VocabularyRepository } from '../../ports/repositories/VocabularyRepository';
import { Vocabulary, VocabularyType, CEFRLevel, VocabularyMeaning } from '../../../core/entities/Vocabulary';
import { normalizeText } from '../../../shared/utils/normalizeText';
import { buildPrefixTokens } from '../../../shared/utils/buildPrefixTokens';
import { AppError } from '../../../core/errors/AppError';

interface CreateVocabularyInput {
  text: string;
  type: string;
  level?: string;
  partOfSpeech?: string;
  phonetic?: string;
  audioUrl?: string;
  meanings: VocabularyMeaning[];
  forms?: { formText: string; formType?: string; note?: string }[];
  components?: { componentText: string; componentVocabularyId?: string; role?: string; orderIndex: number }[];
  topicIds?: string[];
  status?: 'draft' | 'approved' | 'rejected' | 'archived';
  createdBy: string;
}

export class CreateVocabularyUseCase {
  constructor(private vocabularyRepository: VocabularyRepository) {}

  async execute(input: CreateVocabularyInput): Promise<Vocabulary> {
    const normalizedText = normalizeText(input.text);

    // Text unique validation among approved/draft vocabularies
    const listResult = await this.vocabularyRepository.search({
      search: input.text,
      page: 1,
      limit: 10,
    });
    
    const isDuplicate = listResult.items.some(
      (v) => v.normalizedText === normalizedText && v.type === input.type
    );
    if (isDuplicate) {
      throw new AppError(
        'DUPLICATE_RESOURCE',
        'Vocabulary item with this text and type already exists',
        409
      );
    }

    // Prepare forms (always include the base word as forms[0])
    const forms = [
      {
        formText: input.text,
        normalizedFormText: normalizedText,
        formType: 'base',
      },
      ...(input.forms || []).map((f) => ({
        formText: f.formText,
        normalizedFormText: normalizeText(f.formText),
        formType: f.formType,
        note: f.note,
      })),
    ];

    const allFormTexts = forms.map((f) => f.formText);
    const searchTokens = buildPrefixTokens(allFormTexts.join(' '));

    return this.vocabularyRepository.create({
      text: input.text,
      normalizedText,
      type: input.type as VocabularyType,
      level: input.level as CEFRLevel,
      partOfSpeech: input.partOfSpeech,
      phonetic: input.phonetic,
      audioUrl: input.audioUrl,
      meanings: input.meanings,
      forms,
      components: input.components || [],
      topicIds: input.topicIds || [],
      status: input.status || 'approved',
      createdBy: input.createdBy,
      updatedBy: input.createdBy,
      searchTokens,
    });
  }
}
