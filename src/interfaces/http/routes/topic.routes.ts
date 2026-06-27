import { Router } from 'express';
import { buildContainer } from '../../../shared/container/buildContainer';
import { validateRequest } from '../middlewares/validateRequest';
import { authMiddleware } from '../middlewares/authMiddleware';
import { requireRole } from '../middlewares/requireRole';
import { createTopicSchema, updateTopicSchema } from '../validators/topic.validators';

const router = Router();
const { topicController } = buildContainer();

router.get('/', topicController.list);

router.post(
  '/',
  authMiddleware,
  requireRole('admin'),
  validateRequest(createTopicSchema),
  topicController.create
);

router.patch(
  '/:id',
  authMiddleware,
  requireRole('admin'),
  validateRequest(updateTopicSchema),
  topicController.update
);

router.delete(
  '/:id',
  authMiddleware,
  requireRole('admin'),
  topicController.delete
);

export { router as topicRoutes };
