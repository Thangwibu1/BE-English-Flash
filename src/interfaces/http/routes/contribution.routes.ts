import { Router, Request, Response, NextFunction } from 'express';
import { authMiddleware } from '../middlewares/authMiddleware';
import { requireRole } from '../middlewares/requireRole';
import { ContributionSubmissionModel } from '../../../infrastructure/database/mongoose/models/ContributionSubmissionModel';
import { VocabularyModel } from '../../../infrastructure/database/mongoose/models/VocabularyModel';
import { ReadingModel } from '../../../infrastructure/database/mongoose/models/ReadingModel';
import { AppError } from '../../../core/errors/AppError';
import { buildContainer } from '../../../shared/container/buildContainer';
import { TopicModel } from '../../../infrastructure/database/mongoose/models/TopicModel';

const router = Router();

// GET all contributions (Admin, Contributor or User)
router.get('/', authMiddleware, requireRole('admin', 'contributor', 'user'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query: any = { deletedAt: null };
    if (req.user!.role !== 'admin') {
      query.submittedBy = req.user!.id;
    }
    const list = await ContributionSubmissionModel.find(query)
      .populate('submittedBy', 'username email displayName')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: list,
    });
  } catch (error) {
    next(error);
  }
});

router.post(
  '/readings/ai-analyze',
  authMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { analyzeContributionReadingWithAiUseCase } = buildContainer();
      const result = await analyzeContributionReadingWithAiUseCase.execute({
        userId: req.user!.id,
        title: req.body.title,
        content: req.body.content,
        level: req.body.level,
        mode: req.body.mode || 'coverage',
        maxItems: req.body.maxItems,
      });

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST submit contribution
router.post('/', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { type, action, targetId, payload } = req.body;
    const submittedBy = req.user!.id;

    if (!payload) {
      throw new AppError('VALIDATION_ERROR', 'Payload is required', 400);
    }

    const contribution = await ContributionSubmissionModel.create({
      submittedBy,
      type,
      action,
      targetId: targetId || null,
      status: 'pending',
      payloadJson: JSON.stringify(payload),
    });

    res.status(201).json({
      success: true,
      data: contribution,
    });
  } catch (error) {
    next(error);
  }
});

// POST approve contribution (Admin only)
router.post('/:id/approve', authMiddleware, requireRole('admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const reviewedBy = req.user!.id;
    const { adminNote } = req.body;

    const contrib = await ContributionSubmissionModel.findOne({ _id: id, deletedAt: null });
    if (!contrib) {
      throw new AppError('NOT_FOUND', 'Contribution not found', 404);
    }

    if (contrib.status !== 'pending') {
      throw new AppError('VALIDATION_ERROR', 'Contribution is already processed', 400);
    }

    // Apply the payload to actual tables
    const payload = JSON.parse(contrib.payloadJson);

    if (contrib.type === 'vocabulary') {
      if (contrib.action === 'create') {
        await VocabularyModel.create({
          ...payload,
          status: 'approved',
          createdBy: contrib.submittedBy,
        });
      } else if (contrib.action === 'update' && contrib.targetId) {
        await VocabularyModel.updateOne({ _id: contrib.targetId }, { $set: payload });
      }
    } else if (contrib.type === 'reading' || contrib.type === 'reading_with_ai_vocabulary') {
      if (contrib.action === 'create') {
        const { reprocessReadingUseCase } = buildContainer();

        // --- Handle missing items (AI and Manual): create approved vocabulary for missing items ---
        const aiMissingItems: any[] = payload.aiMissingItems || payload.suggestedVocabularyItems || [];
        const manualMissingItems: any[] = payload.manualMissingItems || [];
        const missingItemsToCreate = [...aiMissingItems, ...manualMissingItems];

        for (const item of missingItemsToCreate) {
          const sv = item.suggestedVocabulary || item;
          const normalizedText = sv.normalizedText || sv.text?.trim().toLowerCase();
          if (!normalizedText) continue;

          const exists = await VocabularyModel.findOne({ normalizedText, deletedAt: null });
          if (!exists) {
            const topicIds = await resolveTopicIds(sv.topicIds || sv.topics, contrib.submittedBy.toString());

            await VocabularyModel.create({
              text: sv.text,
              normalizedText,
              type: sv.type || 'single_word',
              level: sv.level || undefined,
              partOfSpeech: sv.partOfSpeech || undefined,
              meanings: [{
                meaningVi: sv.meaningVi || `[Draft] ${sv.text}`,
                meaningEn: sv.meaningEn || undefined,
                examples: sv.exampleEn ? [{ exampleEn: sv.exampleEn, exampleVi: sv.exampleVi || undefined }] : [],
              }],
              forms: sv.forms?.length
                ? sv.forms.map((f: string) => ({ formText: f, normalizedFormText: f.trim().toLowerCase() }))
                : [{ formText: sv.text, normalizedFormText: normalizedText }],
              topicIds,
              status: 'approved',
              createdBy: contrib.submittedBy,
            });
          }
        }

        // --- Create the official Reading document ---
        const baseSlug = payload.slug
          || payload.title?.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
          || `reading-${Date.now()}`;

        let slug = baseSlug;
        let count = 1;
        while (true) {
          const exists = await ReadingModel.findOne({ slug, deletedAt: null });
          if (!exists) {
            break;
          }
          slug = `${baseSlug}-${count}`;
          count++;
        }

        const readingTopicIds = await resolveTopicIds(payload.topicIds || payload.topics, contrib.submittedBy.toString());

        const reading = await ReadingModel.create({
          title: payload.title,
          slug,
          subtitle: payload.subtitle || undefined,
          content: payload.bodyText || payload.content,
          level: payload.level,
          topicIds: readingTopicIds,
          source: payload.source || 'user_contribution',
          estimatedReadingTimeMinutes: payload.estimatedReadingTimeMinutes || 0,
          spans: [],
          vocabularyIds: [],
          status: 'published',
          createdBy: contrib.submittedBy,
        });

        // --- Reprocess reading to create spans from approved vocabulary ---
        await reprocessReadingUseCase.execute({
          readingId: reading._id.toString(),
        });
      } else if (contrib.action === 'update' && contrib.targetId) {
        await ReadingModel.updateOne({ _id: contrib.targetId }, { $set: payload });
      }
    }

    contrib.status = 'approved';
    contrib.adminNote = adminNote;
    contrib.reviewedBy = new mongoose.Types.ObjectId(reviewedBy);
    contrib.reviewedAt = new Date();
    await contrib.save();

    res.json({
      success: true,
      data: contrib,
    });
  } catch (error) {
    next(error);
  }
});

// POST reject contribution (Admin only)
router.post('/:id/reject', authMiddleware, requireRole('admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const reviewedBy = req.user!.id;
    const { adminNote } = req.body;

    const contrib = await ContributionSubmissionModel.findOne({ _id: id, deletedAt: null });
    if (!contrib) {
      throw new AppError('NOT_FOUND', 'Contribution not found', 404);
    }

    if (contrib.status !== 'pending') {
      throw new AppError('VALIDATION_ERROR', 'Contribution is already processed', 400);
    }

    contrib.status = 'rejected';
    contrib.adminNote = adminNote;
    contrib.reviewedBy = new mongoose.Types.ObjectId(reviewedBy);
    contrib.reviewedAt = new Date();
    await contrib.save();

    res.json({
      success: true,
      data: contrib,
    });
  } catch (error) {
    next(error);
  }
});

async function resolveTopicIds(
  topicInput: any,
  submittedBy: string
): Promise<mongoose.Types.ObjectId[]> {
  if (!topicInput) return [];

  let rawTopics: string[] = [];

  if (typeof topicInput === 'string') {
    const trimmed = topicInput.trim();
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const normalizedJson = trimmed.replace(/'/g, '"');
        const parsed = JSON.parse(normalizedJson);
        if (Array.isArray(parsed)) {
          rawTopics = parsed.map(t => String(t).trim());
        }
      } catch {
        const cleaned = trimmed.slice(1, -1).replace(/['"]/g, '').trim();
        if (cleaned) {
          rawTopics = cleaned.split(',').map(t => t.trim());
        }
      }
    } else {
      rawTopics = [trimmed];
    }
  } else if (Array.isArray(topicInput)) {
    rawTopics = topicInput.map(t => String(t).trim());
  } else {
    rawTopics = [String(topicInput).trim()];
  }

  const resolvedIds: mongoose.Types.ObjectId[] = [];

  for (const topicStr of rawTopics) {
    if (!topicStr) continue;

    if (mongoose.Types.ObjectId.isValid(topicStr)) {
      resolvedIds.push(new mongoose.Types.ObjectId(topicStr));
      continue;
    }

    const name = topicStr;
    const slug = topicStr
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');

    try {
      let topicDoc = await TopicModel.findOne({
        $or: [{ slug }, { name: { $regex: new RegExp(`^${name}$`, 'i') } }],
        deletedAt: null,
      });

      if (!topicDoc) {
        topicDoc = await TopicModel.create({
          name: name.charAt(0).toUpperCase() + name.slice(1),
          slug,
          createdBy: new mongoose.Types.ObjectId(submittedBy),
          updatedBy: new mongoose.Types.ObjectId(submittedBy),
        });
      }

      resolvedIds.push(topicDoc._id as mongoose.Types.ObjectId);
    } catch (err) {
      console.error(`Failed to resolve or create topic: "${topicStr}"`, err);
    }
  }

  return resolvedIds;
}

import mongoose from 'mongoose';
export { router as contributionRoutes };
