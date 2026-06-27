import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../../core/errors/AppError';
import { JwtAuthTokenService } from '../../../infrastructure/auth/JwtAuthTokenService';

declare global {
  namespace Express {
    interface Request {
      user?: { id: string; role: string } | null;
    }
  }
}

const tokenService = new JwtAuthTokenService();

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return next(new AppError('UNAUTHENTICATED', 'Please login first', 401));
  }

  try {
    const payload = tokenService.verify(token);
    req.user = payload;
    next();
  } catch (error) {
    return next(new AppError('UNAUTHENTICATED', 'Invalid or expired token', 401));
  }
}

export function optionalAuthMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    req.user = null;
    return next();
  }

  try {
    const payload = tokenService.verify(token);
    req.user = payload;
  } catch (error) {
    req.user = null;
  }
  next();
}
