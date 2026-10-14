/** Stable error codes returned by the API (`code` field) and translated by the web (`errors.<code>`). */
export const ERROR_CODES = [
  'VALIDATION_FAILED',
  'UNAUTHORIZED',
  'INVALID_CREDENTIALS',
  'TOO_MANY_ATTEMPTS',
  'WRONG_PASSWORD',
  'FORBIDDEN',
  'NOT_FOUND',
  'DUPLICATE',
  'CONFLICT',
  'ALLOCATION_OVERLAP',
  'PAYROLL_LOCKED',
  'INSUFFICIENT_STOCK',
  'UNKNOWN_SETTING',
  'UNSUPPORTED_FILE_TYPE',
  'FILE_TOO_LARGE',
  'FILE_REQUIRED',
  'OWNER_NOT_FOUND',
  'CLIENT_HAS_PROJECTS',
  'INTERNAL_ERROR',
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

export interface ApiErrorBody {
  statusCode: number;
  message: string;
  code?: ErrorCode | string;
  details?: unknown;
}
