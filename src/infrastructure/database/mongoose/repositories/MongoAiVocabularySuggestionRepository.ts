import { AiVocabularySuggestionRepository } from '../../../../app/ports/repositories/AiVocabularySuggestionRepository';
import { AiVocabularySuggestion } from '../../../../core/entities/AiVocabularySuggestion';
import { AiVocabularySuggestionModel } from '../models/AiVocabularySuggestionModel';

function mapDocToEntity(doc: any): AiVocabularySuggestion {
  return {
    id: doc._id.toString(),
    readingId: doc.readingId.toString(),
    suggestedBy: doc.suggestedBy,
    provider: doc.provider,
    model: doc.model,
    text: doc.text,
    normalizedText: doc.normalizedText,
    type: doc.type,
    level: doc.level,
    partOfSpeech: doc.partOfSpeech,
    meaningVi: doc.meaningVi,
    meaningEn: doc.meaningEn,
    forms: doc.forms,
    topics: doc.topics,
    exampleEn: doc.exampleEn,
    exampleVi: doc.exampleVi,
    sourceText: doc.sourceText,
    confidence: doc.confidence,
    duplicateStatus: doc.duplicateStatus,
    duplicateVocabularyId: doc.duplicateVocabularyId ? doc.duplicateVocabularyId.toString() : null,
    status: doc.status,
    reviewedBy: doc.reviewedBy ? doc.reviewedBy.toString() : null,
    reviewedAt: doc.reviewedAt,
    adminNote: doc.adminNote,
    rawAiItem: doc.rawAiItem,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    deletedAt: doc.deletedAt,
  };
}

export class MongoAiVocabularySuggestionRepository implements AiVocabularySuggestionRepository {
  async findById(id: string): Promise<AiVocabularySuggestion | null> {
    const doc = await AiVocabularySuggestionModel.findOne({ _id: id, deletedAt: null });
    return doc ? mapDocToEntity(doc) : null;
  }

  async findByReadingId(params: { readingId: string; status?: string }): Promise<AiVocabularySuggestion[]> {
    const query: any = { readingId: params.readingId, deletedAt: null };
    if (params.status) {
      query.status = params.status;
    }
    const docs = await AiVocabularySuggestionModel.find(query).sort({ createdAt: -1 });
    return docs.map(mapDocToEntity);
  }

  async findOneByReadingAndNormalizedText(
    readingId: string,
    normalizedText: string
  ): Promise<AiVocabularySuggestion | null> {
    const doc = await AiVocabularySuggestionModel.findOne({
      readingId,
      normalizedText,
      deletedAt: null,
    });
    return doc ? mapDocToEntity(doc) : null;
  }

  async createMany(suggestions: Partial<AiVocabularySuggestion>[]): Promise<AiVocabularySuggestion[]> {
    const docs = await AiVocabularySuggestionModel.insertMany(suggestions);
    return docs.map(mapDocToEntity);
  }

  async updateById(id: string, data: Partial<AiVocabularySuggestion>): Promise<AiVocabularySuggestion | null> {
    const doc = await AiVocabularySuggestionModel.findOneAndUpdate(
      { _id: id, deletedAt: null },
      { $set: data },
      { new: true }
    );
    return doc ? mapDocToEntity(doc) : null;
  }
}
