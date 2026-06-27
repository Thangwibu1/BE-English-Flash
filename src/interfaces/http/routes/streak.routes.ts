import { Router } from 'express';
import { buildContainer } from '../../../shared/container/buildContainer';
import { authMiddleware } from '../middlewares/authMiddleware';

const router = Router();
const { streakController } = buildContainer();

router.get('/me/streak', authMiddleware, streakController.getStreak);
router.post('/me/activity', authMiddleware, streakController.trackActivity);

export { router as streakRoutes };
