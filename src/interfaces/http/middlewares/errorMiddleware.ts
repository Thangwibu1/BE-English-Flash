import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../../core/errors/AppError';

export function errorMiddleware(
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Log all errors with method and URL
  console.error(`[Error] ${req.method} ${req.originalUrl || req.url}:`, error);

  if (error instanceof AppError) {
    return res.status(error.statusCode).json({
      success: false,
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
      },
    });
  }

  return res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Internal server error',
    },
  });
}
