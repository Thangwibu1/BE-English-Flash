import { VocabularyRepository, ListVocabularyParams, SearchExactParams, SearchPrefixParams } from '../../../../app/ports/repositories/VocabularyRepository';
import { Vocabulary } from '../../../../core/entities/Vocabulary';
import { VocabularyModel, VocabularyDocument } from '../models/VocabularyModel';
import { mapVocabularyDocToEntity } from '../mappers/vocabularyMapper';
import mongoose from 'mongoose';

export class MongoVocabularyRepository implements VocabularyRepository {
  async findById(id: string): Promise<Vocabulary | null> {
    const doc = await VocabularyModel.findOne({ _id: id, deletedAt: null });
    return doc ? mapVocabularyDocToEntity(doc) : null;
  }

  async findByIds(ids: string[]): Promise<Vocabulary[]> {
    const validIds = ids.filter((id) => mongoose.Types.ObjectId.isValid(id));
    const docs = await VocabularyModel.find({
      _id: { $in: validIds },
      deletedAt: null,
    });
    return docs.map(mapVocabularyDocToEntity);
  }

  async search(params: ListVocabularyParams): Promise<{ items: Vocabulary[]; total: number }> {
    const query: any = { deletedAt: null };

    if (params.search) {
      const regex = new RegExp(params.search.trim(), 'i');
      query.$or = [
        { text: regex },
        { normalizedText: regex },
        { 'meanings.meaningVi': regex },
        { 'meanings.meaningEn': regex },
      ];
    }

    if (params.type) {
      query.type = params.type;
    }

    if (params.level) {
      query.level = params.level;
    }

    if (params.topicId) {
      query.topicIds = params.topicId;
    }

    const total = await VocabularyModel.countDocuments(query);
    const docs = await VocabularyModel.find(query)
      .sort({ text: 1 })
      .skip((params.page - 1) * params.limit)
      .limit(params.limit);

    return {
      items: docs.map(mapVocabularyDocToEntity),
      total,
    };
  }

  async create(data: Partial<Vocabulary>): Promise<Vocabulary> {
    const doc = await VocabularyModel.create({
      text: data.text,
      normalizedText: data.normalizedText,
      type: data.type,
      level: data.level,
      partOfSpeech: data.partOfSpeech,
      phonetic: data.phonetic,
      audioUrl: data.audioUrl,
      meanings: data.meanings,
      forms: data.forms,
      components: data.components,
      topicIds: data.topicIds,
      status: data.status || 'approved',
      searchTokens: data.searchTokens || [],
      createdBy: data.createdBy,
      updatedBy: data.updatedBy,
      deletedAt: null,
    });
    return mapVocabularyDocToEntity(doc);
  }

  async update(id: string, data: Partial<Vocabulary>): Promise<Vocabulary | null> {
    const updateData: any = { ...data };
    delete updateData.id;
    delete updateData._id;

    const doc = await VocabularyModel.findOneAndUpdate(
      { _id: id, deletedAt: null },
      { $set: updateData },
      { new: true }
    );
    return doc ? mapVocabularyDocToEntity(doc) : null;
  }

  async softDelete(id: string): Promise<void> {
    await VocabularyModel.updateOne(
      { _id: id },
      { $set: { deletedAt: new Date() } }
    );
  }

  async findAllApprovedForms(): Promise<{
    vocabularyId: string;
    text: string;
    normalizedText: string;
    type: string;
  }[]> {
    const docs = await VocabularyModel.find({
      status: 'approved',
      deletedAt: null,
    });

    const forms: {
      vocabularyId: string;
      text: string;
      normalizedText: string;
      type: string;
    }[] = [];

    docs.forEach((doc) => {
      // Always include base form
      forms.push({
        vocabularyId: doc._id.toString(),
        text: doc.text,
        normalizedText: doc.normalizedText,
        type: doc.type,
      });

      // Include extra forms
      if (doc.forms) {
        doc.forms.forEach((f) => {
          // Avoid duplicate base form
          if (f.normalizedFormText !== doc.normalizedText) {
            forms.push({
              vocabularyId: doc._id.toString(),
              text: f.formText,
              normalizedText: f.normalizedFormText,
              type: doc.type,
            });
          }
        });
      }
    });

    return forms;
  }

  async findByNormalizedText(normalizedText: string): Promise<Vocabulary | null> {
    const doc = await VocabularyModel.findOne({ normalizedText, deletedAt: null });
    return doc ? mapVocabularyDocToEntity(doc) : null;
  }

  async findManyByNormalizedTexts(normalizedTexts: string[]): Promise<Vocabulary[]> {
    const docs = await VocabularyModel.find({
      normalizedText: { $in: normalizedTexts },
      deletedAt: null,
    });
    return docs.map(mapVocabularyDocToEntity);
  }

  async findByFormNormalizedText(normalizedFormText: string): Promise<Vocabulary | null> {
    const doc = await VocabularyModel.findOne({
      'forms.normalizedFormText': normalizedFormText,
      deletedAt: null,
    });
    return doc ? mapVocabularyDocToEntity(doc) : null;
  }

  async searchExact(params: SearchExactParams): Promise<Vocabulary[]> {
    const escapedQuery = params.normalizedQuery.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
    const viRegex = new RegExp(`(^|[,;\\s])\\s*${escapedQuery}\\s*($|[,;\\s])`, 'i');

    const filter: any = {
      status: 'approved',
      deletedAt: null,
      $or: [
        { normalizedText: params.normalizedQuery },
        { 'forms.normalizedFormText': params.normalizedQuery },
        { 'meanings.meaningVi': viRegex },
      ],
    };

    if (params.type) filter.type = params.type;
    if (params.level) filter.level = params.level;
    if (params.topic) filter.topicIds = params.topic;

    const docs = await VocabularyModel.find(filter).limit(params.limit || 20);
    return docs.map(mapVocabularyDocToEntity);
  }

  async searchPrefix(params: SearchPrefixParams): Promise<Vocabulary[]> {
    const escapedQuery = params.token.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
    const viPrefixRegex = new RegExp(`(^|[,;\\s])\\s*${escapedQuery}`, 'i');

    const filter: any = {
      status: 'approved',
      deletedAt: null,
      $or: [
        { searchTokens: params.token },
        { 'meanings.meaningVi': viPrefixRegex },
      ],
    };

    if (params.type) filter.type = params.type;
    if (params.level) filter.level = params.level;
    if (params.topic) filter.topicIds = params.topic;

    const docs = await VocabularyModel.find(filter).limit(params.limit || 20);
    return docs.map(mapVocabularyDocToEntity);
  }

  async findApprovedForSearch(): Promise<Vocabulary[]> {
    const docs = await VocabularyModel.find({
      status: 'approved',
      deletedAt: null,
    })
      .select({
        text: 1,
        normalizedText: 1,
        type: 1,
        level: 1,
        meanings: 1,
        forms: 1,
        topicIds: 1,
      })
      .lean<VocabularyDocument[]>();
    return docs.map(mapVocabularyDocToEntity);
  }
}

