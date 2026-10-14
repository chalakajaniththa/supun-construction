import { HttpException, HttpStatus } from '@nestjs/common';
import type { ErrorCode } from '@sc/shared';

/** A domain error with a stable `code` the web translates (errors.<code>). */
export class AppException extends HttpException {
  constructor(
    status: HttpStatus,
    public readonly code: ErrorCode,
    message: string,
    public readonly details?: unknown,
  ) {
    super({ statusCode: status, message, code, details }, status);
  }

  static notFound(message = 'Not found', details?: unknown): AppException {
    return new AppException(HttpStatus.NOT_FOUND, 'NOT_FOUND', message, details);
  }

  static conflict(code: ErrorCode, message: string, details?: unknown): AppException {
    return new AppException(HttpStatus.CONFLICT, code, message, details);
  }

  static badRequest(code: ErrorCode, message: string, details?: unknown): AppException {
    return new AppException(HttpStatus.BAD_REQUEST, code, message, details);
  }
}
