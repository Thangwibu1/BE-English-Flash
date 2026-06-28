import { Vocabulary } from '../../../../core/entities/Vocabulary';
import { VocabularyDocument } from '../models/VocabularyModel';

export function mapVocabularyDocToEntity(doc: VocabularyDocument): Vocabulary {
  return {
    id: doc._id.toString(),
    text: doc.text,
    normalizedText: doc.normalizedText,
    type: doc.type,
    level: doc.level,
    partOfSpeech: doc.partOfSpeech,
    phonetic: doc.phonetic,
    audioUrl: doc.audioUrl,
    meanings: (doc.meanings || []).map((m) => ({
      meaningVi: m.meaningVi,
      meaningEn: m.meaningEn,
      note: m.note,
      examples: (m.examples || []).map((e) => ({
        exampleEn: e.exampleEn,
        exampleVi: e.exampleVi,
        source: e.source,
      })),
    })),
    forms: (doc.forms || []).map((f) => ({
      formText: f.formText,
      normalizedFormText: f.normalizedFormText,
      formType: f.formType,
      note: f.note,
    })),
    components: (doc.components || []).map((c) => ({
      componentText: c.componentText,
      componentVocabularyId: c.componentVocabularyId ? c.componentVocabularyId.toString() : undefined,
      role: c.role,
      orderIndex: c.orderIndex,
    })),
    topicIds: (doc.topicIds || []).map((t) => t.toString()),
    status: doc.status,
    searchTokens: doc.searchTokens || [],
    createdBy: doc.createdBy ? doc.createdBy.toString() : undefined,
    updatedBy: doc.updatedBy ? doc.updatedBy.toString() : undefined,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    deletedAt: doc.deletedAt,
  };
}
