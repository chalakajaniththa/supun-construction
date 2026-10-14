import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { ApiErrorBody } from '@sc/shared';
import type { Response } from 'express';
import { mapPrismaError } from './prisma-error.mapper.js';

const STATUS_CODES: Partial<Record<number, string>> = {
  400: 'VALIDATION_FAILED',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  429: 'TOO_MANY_ATTEMPTS',
};

/** Global filter: every error becomes `{ statusCode, message, code, details }`. */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exceptions');

  catch(exception: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();
    const body = this.toBody(exception);
    if (body.statusCode >= 500) {
      this.logger.error(
        exception instanceof Error ? (exception.stack ?? exception.message) : exception,
      );
    }
    res.status(body.statusCode).json(body);
  }

  toBody(exception: unknown): ApiErrorBody {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const response = exception.getResponse();
      if (typeof response === 'object' && response !== null) {
        const r = response as Partial<ApiErrorBody> & { error?: string };
        const message = Array.isArray(r.message) ? r.message.join('; ') : r.message;
        return {
          statusCode: status,
          message: message ?? exception.message,
          code: r.code ?? STATUS_CODES[status],
          details: r.details,
        };
      }
      return { statusCode: status, message: String(response), code: STATUS_CODES[status] };
    }
    const mapped = mapPrismaError(exception);
    if (mapped) return mapped;
    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Something went wrong.',
      code: 'INTERNAL_ERROR',
    };
  }
}
