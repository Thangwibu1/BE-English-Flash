import { Request, Response, NextFunction } from 'express';
import { ListTopicsUseCase } from '../../../app/use-cases/topic/ListTopicsUseCase';
import { CreateTopicUseCase } from '../../../app/use-cases/topic/CreateTopicUseCase';
import { UpdateTopicUseCase } from '../../../app/use-cases/topic/UpdateTopicUseCase';
import { DeleteTopicUseCase } from '../../../app/use-cases/topic/DeleteTopicUseCase';

export class TopicController {
  constructor(
    private listTopicsUseCase: ListTopicsUseCase,
    private createTopicUseCase: CreateTopicUseCase,
    private updateTopicUseCase: UpdateTopicUseCase,
    private deleteTopicUseCase: DeleteTopicUseCase
  ) {}

  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.listTopicsUseCase.execute();
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
      const { name, description, parentTopicId } = req.body;
      const createdBy = req.user!.id;

      const result = await this.createTopicUseCase.execute({
        name,
        description,
        parentTopicId,
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
      const { name, description, parentTopicId } = req.body;
      const updatedBy = req.user!.id;

      const result = await this.updateTopicUseCase.execute({
        id,
        name,
        description,
        parentTopicId,
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
      await this.deleteTopicUseCase.execute({ id });

      res.json({
        success: true,
        message: 'Topic deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  };
}
