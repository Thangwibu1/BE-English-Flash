import { Request, Response, NextFunction } from 'express';
import { ListVocabulariesUseCase } from '../../../app/use-cases/vocabulary/ListVocabulariesUseCase';
import { GetVocabularyDetailUseCase } from '../../../app/use-cases/vocabulary/GetVocabularyDetailUseCase';
import { CreateVocabularyUseCase } from '../../../app/use-cases/vocabulary/CreateVocabularyUseCase';
import { UpdateVocabularyUseCase } from '../../../app/use-cases/vocabulary/UpdateVocabularyUseCase';
import { DeleteVocabularyUseCase } from '../../../app/use-cases/vocabulary/DeleteVocabularyUseCase';
import { SaveVocabularyUseCase } from '../../../app/use-cases/vocabulary/SaveVocabularyUseCase';
import { MarkVocabularyKnownUseCase } from '../../../app/use-cases/vocabulary/MarkVocabularyKnownUseCase';
import { MarkVocabularyDifficultUseCase } from '../../../app/use-cases/vocabulary/MarkVocabularyDifficultUseCase';

export class VocabularyController {
  constructor(
    private listVocabulariesUseCase: ListVocabulariesUseCase,
    private getVocabularyDetailUseCase: GetVocabularyDetailUseCase,
    private createVocabularyUseCase: CreateVocabularyUseCase,
    private updateVocabularyUseCase: UpdateVocabularyUseCase,
    private deleteVocabularyUseCase: DeleteVocabularyUseCase,
    private saveVocabularyUseCase: SaveVocabularyUseCase,
    private markVocabularyKnownUseCase: MarkVocabularyKnownUseCase,
    private markVocabularyDifficultUseCase: MarkVocabularyDifficultUseCase
  ) {}

  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const search = req.query.search as string;
      const type = req.query.type as string;
      const level = req.query.level as string;
      const topicId = req.query.topicId as string;
      const page = Number(req.query.page || 1);
      const limit = Number(req.query.limit || 20);
      const userId = req.user?.id;

      const result = await this.listVocabulariesUseCase.execute({
        search,
        type,
        level,
        topicId,
        page,
        limit,
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

  getById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const userId = req.user?.id;

      const result = await this.getVocabularyDetailUseCase.execute({ id, userId });

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const createdBy = req.user!.id;
      const result = await this.createVocabularyUseCase.execute({
        ...req.body,
        createdBy,
      });

      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const updatedBy = req.user!.id;

      const result = await this.updateVocabularyUseCase.execute({
        id,
        ...req.body,
        updatedBy,
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  delete = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      await this.deleteVocabularyUseCase.execute({ id });

      res.json({
        success: true,
        message: 'Vocabulary item deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  save = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const userId = req.user!.id;

      const result = await this.saveVocabularyUseCase.execute({
        userId,
        vocabularyId: id,
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  markKnown = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const userId = req.user!.id;

      const result = await this.markVocabularyKnownUseCase.execute({
        userId,
        vocabularyId: id,
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  markDifficult = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const userId = req.user!.id;

      const result = await this.markVocabularyDifficultUseCase.execute({
        userId,
        vocabularyId: id,
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
