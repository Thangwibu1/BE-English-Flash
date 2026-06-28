import { Router } from 'express';
import { buildContainer } from '../../../shared/container/buildContainer';
import { authMiddleware } from '../middlewares/authMiddleware';

const router = Router();
const { streakController } = buildContainer();

router.get('/me/streak', authMiddleware, streakController.getMyStreak);
router.post('/me/activity', authMiddleware, streakController.trackActivityForTesting);
router.get('/me/stats', authMiddleware, streakController.getStats);

export { router as streakRoutes };
