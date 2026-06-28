import { Request, Response, NextFunction } from 'express';
import { AnalyzeReadingVocabularyUseCase } from '../../../app/use-cases/admin/readings/AnalyzeReadingVocabularyUseCase';
import { GetReadingAiSuggestionsUseCase } from '../../../app/use-cases/admin/readings/GetReadingAiSuggestionsUseCase';
import { UpdateAiVocabularySuggestionUseCase } from '../../../app/use-cases/admin/readings/UpdateAiVocabularySuggestionUseCase';
import { ApproveAiVocabularySuggestionUseCase } from '../../../app/use-cases/admin/readings/ApproveAiVocabularySuggestionUseCase';
import { RejectAiVocabularySuggestionUseCase } from '../../../app/use-cases/admin/readings/RejectAiVocabularySuggestionUseCase';
import { ReprocessReadingUseCase } from '../../../app/use-cases/reading/ReprocessReadingUseCase';
import { AppError } from '../../../core/errors/AppError';

export class AdminReadingAiController {
  constructor(private deps: {
    analyzeReadingVocabularyUseCase: AnalyzeReadingVocabularyUseCase;
    getReadingAiSuggestionsUseCase: GetReadingAiSuggestionsUseCase;
    updateAiVocabularySuggestionUseCase: UpdateAiVocabularySuggestionUseCase;
    approveAiVocabularySuggestionUseCase: ApproveAiVocabularySuggestionUseCase;
    rejectAiVocabularySuggestionUseCase: RejectAiVocabularySuggestionUseCase;
    reprocessReadingUseCase: ReprocessReadingUseCase;
  }) {}

  analyzeReading = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const readingId = req.params.id;
      const adminUserId = req.user?.id;
      if (!adminUserId) {
        throw new AppError('UNAUTHENTICATED', 'Authentication required', 401);
      }
      const { force } = req.body;

      const result = await this.deps.analyzeReadingVocabularyUseCase.execute({
        readingId,
        adminUserId,
        force: Boolean(force),
      });

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  getSuggestions = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const readingId = req.params.id;
      const status = req.query.status as string;

      const result = await this.deps.getReadingAiSuggestionsUseCase.execute({
        readingId,
        status,
      });

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  updateSuggestion = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const suggestionId = req.params.id;
      const adminUserId = req.user?.id;
      if (!adminUserId) {
        throw new AppError('UNAUTHENTICATED', 'Authentication required', 401);
      }
      const patch = req.body;

      const result = await this.deps.updateAiVocabularySuggestionUseCase.execute({
        suggestionId,
        adminUserId,
        patch,
      });

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  approveSuggestion = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const suggestionId = req.params.id;
      const adminUserId = req.user?.id;
      if (!adminUserId) {
        throw new AppError('UNAUTHENTICATED', 'Authentication required', 401);
      }

      const result = await this.deps.approveAiVocabularySuggestionUseCase.execute({
        suggestionId,
        adminUserId,
      });

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  rejectSuggestion = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const suggestionId = req.params.id;
      const adminUserId = req.user?.id;
      if (!adminUserId) {
        throw new AppError('UNAUTHENTICATED', 'Authentication required', 401);
      }
      const { adminNote } = req.body;

      const result = await this.deps.rejectAiVocabularySuggestionUseCase.execute({
        suggestionId,
        adminUserId,
        adminNote,
      });

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  reprocessReading = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const readingId = req.params.id;

      const result = await this.deps.reprocessReadingUseCase.execute({
        readingId,
      });

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };
}
