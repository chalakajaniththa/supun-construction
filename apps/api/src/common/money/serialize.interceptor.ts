import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import { map, type Observable } from 'rxjs';
import { decimalToJson, isDecimalLike } from './money.js';

/** Recursively converts Decimal → string (money 2 dp, qty up to 3 dp) and BigInt → string. */
export function serializeValue(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Date) return value;
  if (isDecimalLike(value)) return decimalToJson(value);
  if (Array.isArray(value)) return value.map(serializeValue);
  if (typeof value === 'object') {
    if (Buffer.isBuffer(value)) return value;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = serializeValue(v);
    return out;
  }
  return value;
}

@Injectable()
export class SerializeInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(map((data) => serializeValue(data)));
  }
}
