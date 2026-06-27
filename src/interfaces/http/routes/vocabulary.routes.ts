import { Router } from 'express';
import { buildContainer } from '../../../shared/container/buildContainer';
import { validateRequest } from '../middlewares/validateRequest';
import { authMiddleware, optionalAuthMiddleware } from '../middlewares/authMiddleware';
import { requireRole } from '../middlewares/requireRole';
import { createVocabularySchema, updateVocabularySchema } from '../validators/vocabulary.validators';

const router = Router();
const { vocabularyController } = buildContainer();

router.get('/', optionalAuthMiddleware, vocabularyController.list);
router.get('/:id', optionalAuthMiddleware, vocabularyController.getById);

router.post(
  '/',
  authMiddleware,
  requireRole('admin'),
  validateRequest(createVocabularySchema),
  vocabularyController.create
);

router.patch(
  '/:id',
  authMiddleware,
  requireRole('admin'),
  validateRequest(updateVocabularySchema),
  vocabularyController.update
);

router.delete(
  '/:id',
  authMiddleware,
  requireRole('admin'),
  vocabularyController.delete
);

router.post('/:id/save', authMiddleware, vocabularyController.save);
router.post('/:id/mark-known', authMiddleware, vocabularyController.markKnown);
router.post('/:id/mark-difficult', authMiddleware, vocabularyController.markDifficult);

export { router as vocabularyRoutes };
