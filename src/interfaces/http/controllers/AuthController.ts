import { Request, Response, NextFunction } from 'express';
import { RegisterUseCase } from '../../../app/use-cases/auth/RegisterUseCase';
import { LoginUseCase } from '../../../app/use-cases/auth/LoginUseCase';
import { GetCurrentUserUseCase } from '../../../app/use-cases/auth/GetCurrentUserUseCase';

export class AuthController {
  constructor(
    private registerUseCase: RegisterUseCase,
    private loginUseCase: LoginUseCase,
    private getCurrentUserUseCase: GetCurrentUserUseCase
  ) {}

  register = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { username, email, password } = req.body;
      const result = await this.registerUseCase.execute({ username, email, password });

      res.status(201).json({
        success: true,
        data: {
          user: {
            _id: result.user.id,
            username: result.user.username,
            email: result.user.email,
            displayName: result.user.displayName,
            avatarUrl: result.user.avatarUrl,
            role: result.user.role,
          },
          accessToken: result.accessToken,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  login = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { identifier, password } = req.body;
      const result = await this.loginUseCase.execute({ identifier, password });

      res.status(200).json({
        success: true,
        data: {
          user: {
            _id: result.user.id,
            username: result.user.username,
            email: result.user.email,
            displayName: result.user.displayName,
            avatarUrl: result.user.avatarUrl,
            role: result.user.role,
          },
          accessToken: result.accessToken,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  getMe = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHENTICATED',
            message: 'Please login first',
          },
        });
      }

      const user = await this.getCurrentUserUseCase.execute({ userId });

      res.status(200).json({
        success: true,
        data: {
          _id: user.id,
          username: user.username,
          email: user.email,
          displayName: user.displayName,
          avatarUrl: user.avatarUrl,
          role: user.role,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  logout = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.status(200).json({
        success: true,
        message: 'Logged out successfully',
      });
    } catch (error) {
      next(error);
    }
  };
}
