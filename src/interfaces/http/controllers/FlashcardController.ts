import { Request, Response, NextFunction } from 'express';
import { CreateDeckUseCase } from '../../../app/use-cases/flashcard/CreateDeckUseCase';
import { ListDecksUseCase } from '../../../app/use-cases/flashcard/ListDecksUseCase';
import { GetDeckDetailUseCase } from '../../../app/use-cases/flashcard/GetDeckDetailUseCase';
import { AddCardToDeckUseCase } from '../../../app/use-cases/flashcard/AddCardToDeckUseCase';
import { ReviewFlashcardUseCase } from '../../../app/use-cases/flashcard/ReviewFlashcardUseCase';

export class FlashcardController {
  constructor(
    private createDeckUseCase: CreateDeckUseCase,
    private listDecksUseCase: ListDecksUseCase,
    private getDeckDetailUseCase: GetDeckDetailUseCase,
    private addCardToDeckUseCase: AddCardToDeckUseCase,
    private reviewFlashcardUseCase: ReviewFlashcardUseCase
  ) {}

  listDecks = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const result = await this.listDecksUseCase.execute({ userId });

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  getDeckDetail = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const userId = req.user!.id;

      const result = await this.getDeckDetailUseCase.execute({
        deckId: id,
        userId,
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  createDeck = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ownerId = req.user!.id;
      const { name, description, visibility } = req.body;

      const result = await this.createDeckUseCase.execute({
        ownerId,
        name,
        description,
        visibility,
      });

      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  addCard = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params; // deckId
      const userId = req.user!.id;
      const { vocabularyId } = req.body;

      const result = await this.addCardToDeckUseCase.execute({
        deckId: id,
        vocabularyId,
        userId,
      });

      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  reviewCard = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params; // deckId
      const userId = req.user!.id;
      const { cardId, vocabularyId, rating } = req.body;

      const result = await this.reviewFlashcardUseCase.execute({
        userId,
        deckId: id,
        cardId,
        vocabularyId,
        rating,
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };
}
