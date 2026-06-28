import { Router, Request, Response, NextFunction } from 'express';
import { authMiddleware } from '../middlewares/authMiddleware';
import { requireRole } from '../middlewares/requireRole';
import { ContributionSubmissionModel } from '../../../infrastructure/database/mongoose/models/ContributionSubmissionModel';
import { VocabularyModel } from '../../../infrastructure/database/mongoose/models/VocabularyModel';
import { ReadingModel } from '../../../infrastructure/database/mongoose/models/ReadingModel';
import { AppError } from '../../../core/errors/AppError';
import { buildContainer } from '../../../shared/container/buildContainer';

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

        // --- Handle aiMissingItems: create approved vocabulary for missing items ---
        const aiMissingItems: any[] = payload.aiMissingItems || payload.suggestedVocabularyItems || [];
        for (const item of aiMissingItems) {
          const sv = item.suggestedVocabulary || item;
          const normalizedText = sv.normalizedText || sv.text?.trim().toLowerCase();
          if (!normalizedText) continue;

          const exists = await VocabularyModel.findOne({ normalizedText, deletedAt: null });
          if (!exists) {
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
              topicIds: [],
              status: 'approved',
              createdBy: contrib.submittedBy,
            });
          }
        }

        // --- Create the official Reading document ---
        const slug = payload.slug
          || payload.title?.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
          || `reading-${Date.now()}`;

        const reading = await ReadingModel.create({
          title: payload.title,
          slug,
          subtitle: payload.subtitle || undefined,
          content: payload.bodyText || payload.content,
          level: payload.level,
          topicIds: payload.topicIds || payload.topics || [],
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

import mongoose from 'mongoose';
export { router as contributionRoutes };
