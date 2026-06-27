import { Router } from 'express';
import { buildContainer } from '../../../shared/container/buildContainer';
import { validateRequest } from '../middlewares/validateRequest';
import { authMiddleware } from '../middlewares/authMiddleware';
import {
  createDeckSchema,
  addCardSchema,
  reviewCardSchema,
} from '../validators/flashcard.validators';

const router = Router();
const { flashcardController } = buildContainer();

router.get('/', authMiddleware, flashcardController.listDecks);
router.get('/:id', authMiddleware, flashcardController.getDeckDetail);

router.post(
  '/',
  authMiddleware,
  validateRequest(createDeckSchema),
  flashcardController.createDeck
);

router.post(
  '/:id/cards',
  authMiddleware,
  validateRequest(addCardSchema),
  flashcardController.addCard
);

router.post(
  '/:id/review',
  authMiddleware,
  validateRequest(reviewCardSchema),
  flashcardController.reviewCard
);

export { router as flashcardRoutes };
