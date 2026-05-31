import { Request, Response, NextFunction } from 'express';
import { logger } from '../../utils/logger';
import { FlowMindError } from './index';

export function errorHandler(
  error: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (error instanceof FlowMindError) {
    logger.warn({ code: error.code, statusCode: error.statusCode }, error.message);
    res.status(error.statusCode).json({
      success: false,
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
      },
    });
    return;
  }

  logger.error({ err: error }, 'Unhandled error');
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
    },
  });
}
