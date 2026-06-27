import { Router } from 'express';
import { buildContainer } from '../../../shared/container/buildContainer';
import { validateRequest } from '../middlewares/validateRequest';
import { authMiddleware, optionalAuthMiddleware } from '../middlewares/authMiddleware';
import { requireRole } from '../middlewares/requireRole';
import {
  createReadingSchema,
  updateReadingSchema,
  trackLookupSchema,
  updateProgressSchema,
} from '../validators/reading.validators';

const router = Router();
const { readingController } = buildContainer();

router.get('/', optionalAuthMiddleware, readingController.list);
router.get('/:id', optionalAuthMiddleware, readingController.getById);

router.post(
  '/',
  authMiddleware,
  requireRole('admin'),
  validateRequest(createReadingSchema),
  readingController.create
);

router.patch(
  '/:id',
  authMiddleware,
  requireRole('admin'),
  validateRequest(updateReadingSchema),
  readingController.update
);

router.delete(
  '/:id',
  authMiddleware,
  requireRole('admin'),
  readingController.delete
);

router.post(
  '/:id/reprocess',
  authMiddleware,
  requireRole('admin'),
  readingController.reprocess
);

router.post(
  '/:id/lookups',
  authMiddleware,
  validateRequest(trackLookupSchema),
  readingController.trackLookup
);

router.post(
  '/:id/progress',
  authMiddleware,
  validateRequest(updateProgressSchema),
  readingController.updateProgress
);

export { router as readingRoutes };
