import { Router } from 'express';
import { buildContainer } from '../../../shared/container/buildContainer';
import { authMiddleware } from '../middlewares/authMiddleware';
import { requireRole } from '../middlewares/requireRole';

const router = Router();
const { adminReadingAiController } = buildContainer();

router.post(
  '/admin/readings/:id/ai-analyze',
  authMiddleware,
  requireRole('admin'),
  adminReadingAiController.analyzeReading
);

router.get(
  '/admin/readings/:id/ai-suggestions',
  authMiddleware,
  requireRole('admin'),
  adminReadingAiController.getSuggestions
);

router.patch(
  '/admin/ai-vocabulary-suggestions/:id',
  authMiddleware,
  requireRole('admin'),
  adminReadingAiController.updateSuggestion
);

router.post(
  '/admin/ai-vocabulary-suggestions/:id/approve',
  authMiddleware,
  requireRole('admin'),
  adminReadingAiController.approveSuggestion
);

router.post(
  '/admin/ai-vocabulary-suggestions/:id/reject',
  authMiddleware,
  requireRole('admin'),
  adminReadingAiController.rejectSuggestion
);

router.post(
  '/admin/readings/:id/reprocess',
  authMiddleware,
  requireRole('admin'),
  adminReadingAiController.reprocessReading
);

export { router as adminReadingAiRoutes };
