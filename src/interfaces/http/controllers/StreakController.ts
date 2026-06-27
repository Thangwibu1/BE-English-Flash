import { Request, Response, NextFunction } from 'express';
import { GetStreakUseCase } from '../../../app/use-cases/streak/GetStreakUseCase';
import { TrackLearningActivityUseCase } from '../../../app/use-cases/streak/TrackLearningActivityUseCase';

export class StreakController {
  constructor(
    private getStreakUseCase: GetStreakUseCase,
    private trackLearningActivityUseCase: TrackLearningActivityUseCase
  ) {}

  getStreak = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHENTICATED', message: 'Authentication required' }
        });
      }

      const streakData = await this.getStreakUseCase.execute({ userId });
      
      res.status(200).json({
        success: true,
        data: streakData
      });
    } catch (error) {
      next(error);
    }
  };

  trackActivity = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHENTICATED', message: 'Authentication required' }
        });
      }

      const { activityType } = req.body;
      if (!activityType) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'activityType is required' }
        });
      }

      await this.trackLearningActivityUseCase.execute({ userId, activityType });

      res.status(200).json({
        success: true,
        message: 'Activity tracked successfully'
      });
    } catch (error) {
      next(error);
    }
  };
}
