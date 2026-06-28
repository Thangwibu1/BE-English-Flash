import { Reading } from '../../../../core/entities/Reading';
import { ReadingDocument } from '../models/ReadingModel';

export function mapReadingDocToEntity(doc: ReadingDocument): Reading {
  return {
    id: doc._id.toString(),
    title: doc.title,
    slug: doc.slug,
    subtitle: doc.subtitle,
    content: doc.content,
    level: doc.level,
    topicIds: doc.topicIds.map((t) => t.toString()),
    source: doc.source,
    estimatedReadingTimeMinutes: doc.estimatedReadingTimeMinutes,
    spans: doc.spans.map((s) => ({
      text: s.text,
      normalizedText: s.normalizedText,
      spanType: s.spanType as any,
      lemma: s.lemma,
      vocabularyId: s.vocabularyId ? s.vocabularyId.toString() : null,
      startIndex: s.startIndex,
      endIndex: s.endIndex,
      orderIndex: s.orderIndex,
      isClickable: s.isClickable,
    })),
    vocabularyIds: doc.vocabularyIds.map((v) => v.toString()),
    status: doc.status,
    aiAnalysisStatus: doc.aiAnalysisStatus,
    aiAnalyzedAt: doc.aiAnalyzedAt,
    aiAnalysisHash: doc.aiAnalysisHash,
    aiAnalysisError: doc.aiAnalysisError,
    createdBy: doc.createdBy ? doc.createdBy.toString() : undefined,
    updatedBy: doc.updatedBy ? doc.updatedBy.toString() : undefined,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    deletedAt: doc.deletedAt,
  };
}
