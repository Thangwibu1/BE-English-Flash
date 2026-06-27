export class AppError extends Error {
  constructor(
    public code: string,
    public message: string,
    public statusCode = 400,
    public details?: unknown
  ) {
    super(message);
    Object.setPrototypeOf(this, AppError.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}
