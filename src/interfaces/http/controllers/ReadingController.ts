import { Request, Response, NextFunction } from 'express';
import { ListReadingsUseCase } from '../../../app/use-cases/reading/ListReadingsUseCase';
import { GetReadingDetailUseCase } from '../../../app/use-cases/reading/GetReadingDetailUseCase';
import { CreateReadingUseCase } from '../../../app/use-cases/reading/CreateReadingUseCase';
import { UpdateReadingUseCase } from '../../../app/use-cases/reading/UpdateReadingUseCase';
import { DeleteReadingUseCase } from '../../../app/use-cases/reading/DeleteReadingUseCase';
import { ReprocessReadingUseCase } from '../../../app/use-cases/reading/ReprocessReadingUseCase';
import { TrackReadingLookupUseCase } from '../../../app/use-cases/reading/TrackReadingLookupUseCase';
import { UpdateReadingProgressUseCase } from '../../../app/use-cases/reading/UpdateReadingProgressUseCase';

export class ReadingController {
  constructor(
    private listReadingsUseCase: ListReadingsUseCase,
    private getReadingDetailUseCase: GetReadingDetailUseCase,
    private createReadingUseCase: CreateReadingUseCase,
    private updateReadingUseCase: UpdateReadingUseCase,
    private deleteReadingUseCase: DeleteReadingUseCase,
    private reprocessReadingUseCase: ReprocessReadingUseCase,
    private trackReadingLookupUseCase: TrackReadingLookupUseCase,
    private updateReadingProgressUseCase: UpdateReadingProgressUseCase
  ) {}

  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const search = req.query.search as string;
      const level = req.query.level as string;
      const topicId = req.query.topicId as string;
      const page = Number(req.query.page || 1);
      const limit = Number(req.query.limit || 20);

      const result = await this.listReadingsUseCase.execute({
        search,
        level,
        topicId,
        status: 'published',
        page,
        limit,
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

      const result = await this.getReadingDetailUseCase.execute({
        readingId: id,
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

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const createdBy = req.user!.id;
      const result = await this.createReadingUseCase.execute({
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

      const result = await this.updateReadingUseCase.execute({
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
      await this.deleteReadingUseCase.execute({ id });

      res.json({
        success: true,
        message: 'Reading deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  reprocess = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const result = await this.reprocessReadingUseCase.execute({
        readingId: id,
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  trackLookup = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params; // readingId
      const userId = req.user!.id;
      const { vocabularyId, readingSpanId, lookupText } = req.body;

      await this.trackReadingLookupUseCase.execute({
        userId,
        readingId: id,
        vocabularyId,
        readingSpanId,
        lookupText,
      });

      res.json({
        success: true,
        message: 'Lookup tracked successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  updateProgress = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params; // readingId
      const userId = req.user!.id;
      const { progressPercent, lastPositionIndex } = req.body;

      const result = await this.updateReadingProgressUseCase.execute({
        userId,
        readingId: id,
        progressPercent,
        lastPositionIndex,
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
