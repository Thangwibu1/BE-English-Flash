import { VocabularyRepository } from '../../ports/repositories/VocabularyRepository';
import { Vocabulary, VocabularyType, CEFRLevel } from '../../../core/entities/Vocabulary';
import { normalizeText } from '../../../shared/utils/normalizeText';
import { buildPrefixTokens } from '../../../shared/utils/buildPrefixTokens';
import { AppError } from '../../../core/errors/AppError';

interface UpdateVocabularyInput {
  id: string;
  text?: string;
  type?: string;
  level?: string;
  partOfSpeech?: string;
  phonetic?: string;
  audioUrl?: string;
  meanings?: any[];
  forms?: { formText: string; formType?: string; note?: string }[];
  components?: { componentText: string; componentVocabularyId?: string; role?: string; orderIndex: number }[];
  topicIds?: string[];
  status?: 'draft' | 'approved' | 'rejected' | 'archived';
  updatedBy: string;
}

export class UpdateVocabularyUseCase {
  constructor(private vocabularyRepository: VocabularyRepository) {}

  async execute(input: UpdateVocabularyInput): Promise<Vocabulary> {
    const existing = await this.vocabularyRepository.findById(input.id);
    if (!existing) {
      throw new AppError('NOT_FOUND', 'Vocabulary item not found', 404);
    }

    const updateData: Partial<Vocabulary> = {
      updatedBy: input.updatedBy,
    };

    if (input.text !== undefined) {
      const normalizedText = normalizeText(input.text);
      updateData.text = input.text;
      updateData.normalizedText = normalizedText;

      // Regenerate forms base
      const textForms = input.forms || existing.forms.filter(f => f.formType !== 'base');
      updateData.forms = [
        {
          formText: input.text,
          normalizedFormText: normalizedText,
          formType: 'base',
        },
        ...textForms.map((f) => ({
          formText: f.formText,
          normalizedFormText: normalizeText(f.formText),
          formType: f.formType,
          note: f.note,
        })),
      ];

      // Regenerate searchTokens
      const allFormTexts = updateData.forms.map((f) => f.formText);
      updateData.searchTokens = buildPrefixTokens(allFormTexts.join(' '));
    } else if (input.forms !== undefined) {
      updateData.forms = [
        existing.forms[0], // Keep base form
        ...input.forms.map((f) => ({
          formText: f.formText,
          normalizedFormText: normalizeText(f.formText),
          formType: f.formType,
          note: f.note,
        })),
      ];

      // Regenerate searchTokens
      const allFormTexts = updateData.forms.map((f) => f.formText);
      updateData.searchTokens = buildPrefixTokens(allFormTexts.join(' '));
    }

    if (input.type !== undefined) updateData.type = input.type as VocabularyType;
    if (input.level !== undefined) updateData.level = input.level as CEFRLevel;
    if (input.partOfSpeech !== undefined) updateData.partOfSpeech = input.partOfSpeech;
    if (input.phonetic !== undefined) updateData.phonetic = input.phonetic;
    if (input.audioUrl !== undefined) updateData.audioUrl = input.audioUrl;
    if (input.meanings !== undefined) updateData.meanings = input.meanings;
    if (input.components !== undefined) updateData.components = input.components;
    if (input.topicIds !== undefined) updateData.topicIds = input.topicIds;
    if (input.status !== undefined) updateData.status = input.status;

    const updated = await this.vocabularyRepository.update(input.id, updateData);
    if (!updated) {
      throw new AppError('NOT_FOUND', 'Vocabulary item not found', 404);
    }

    return updated;
  }
}
