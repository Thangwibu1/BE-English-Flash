import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../../core/errors/AppError';

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError('UNAUTHENTICATED', 'Please login first', 401));
    }

    if (!roles.includes(req.user.role)) {
      return next(new AppError('FORBIDDEN', 'You do not have permission to access this resource', 403));
    }

    next();
  };
}
