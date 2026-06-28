import { Router, Request, Response, NextFunction } from 'express';
import { authMiddleware } from '../middlewares/authMiddleware';
import { requireRole } from '../middlewares/requireRole';
import { ContributionSubmissionModel } from '../../../infrastructure/database/mongoose/models/ContributionSubmissionModel';
import { VocabularyModel } from '../../../infrastructure/database/mongoose/models/VocabularyModel';
import { ReadingModel } from '../../../infrastructure/database/mongoose/models/ReadingModel';
import { AppError } from '../../../core/errors/AppError';
import { buildContainer } from '../../../shared/container/buildContainer';

const router = Router();

// GET all contributions (Admin or Contributor)
router.get('/', authMiddleware, requireRole('admin', 'contributor'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query: any = { deletedAt: null };
    if (req.user!.role === 'contributor') {
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
    } else if (contrib.type === 'reading') {
      if (contrib.action === 'create') {
        await ReadingModel.create({
          ...payload,
          status: 'published',
          createdBy: contrib.submittedBy,
        });
      } else if (contrib.action === 'update' && contrib.targetId) {
        await ReadingModel.updateOne({ _id: contrib.targetId }, { $set: payload });
      }
    } else if (contrib.type === 'reading_with_ai_vocabulary') {
      if (contrib.action === 'create') {
        const { reprocessReadingUseCase } = buildContainer();

        // 1. Loop through suggestedVocabularyItems and create new vocabularies
        const suggestedVocabularyItems = payload.suggestedVocabularyItems || [];
        for (const item of suggestedVocabularyItems) {
          const normalizedText = item.normalizedText || item.text.trim().toLowerCase();
          
          // Check if already exists in official dictionary
          const exists = await VocabularyModel.findOne({ normalizedText, deletedAt: null });
          if (!exists) {
            await VocabularyModel.create({
              text: item.text,
              normalizedText,
              type: item.type,
              level: item.level,
              partOfSpeech: item.partOfSpeech || undefined,
              meanings: [{
                meaningVi: item.meaningVi,
                meaningEn: item.meaningEn || undefined,
                examples: item.exampleEn ? [{
                  exampleEn: item.exampleEn,
                  exampleVi: item.exampleVi || undefined,
                }] : [],
              }],
              forms: item.forms ? item.forms.map((f: string) => ({ formText: f, normalizedFormText: f.toLowerCase() })) : [{ formText: item.text, normalizedFormText: normalizedText }],
              topicIds: [], // default empty
              status: 'approved',
              createdBy: contrib.submittedBy,
            });
          }
        }

        // 2. Create official Reading
        const reading = await ReadingModel.create({
          title: payload.title,
          slug: payload.slug || payload.title.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
          subtitle: payload.subtitle || undefined,
          content: payload.bodyText,
          level: payload.level,
          topicIds: payload.topics || [], // topics is actually topicIds
          source: payload.source || 'user_contribution',
          estimatedReadingTimeMinutes: payload.estimatedReadingTimeMinutes || 0,
          spans: [], // calculated in reprocess
          vocabularyIds: [], // calculated in reprocess
          status: 'published',
          createdBy: contrib.submittedBy,
        });

        // 3. Reprocess reading highlights
        await reprocessReadingUseCase.execute({
          readingId: reading._id.toString(),
        });
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
