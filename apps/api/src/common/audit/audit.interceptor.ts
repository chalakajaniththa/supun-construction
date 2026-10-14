import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  Logger,
  type NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Response } from 'express';
import { mergeMap, type Observable } from 'rxjs';
import type { AuthedRequest } from '../auth/session-user.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AUDIT_ACTION_KEY, AUDIT_ENTITY_KEY, SKIP_AUDIT_KEY } from './audit.decorator.js';
import { actionForMethod, entityFromPath, redact } from './audit.util.js';

/**
 * Records every successful POST/PUT/PATCH/DELETE in AuditLog before the response is sent.
 * A failure to write the audit row is logged but never fails the request.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const methodAction = actionForMethod(req.method);
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_AUDIT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!methodAction || skip) return next.handle();
    const action =
      this.reflector.getAllAndOverride<typeof methodAction>(AUDIT_ACTION_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? methodAction;

    const entity =
      this.reflector.getAllAndOverride<string>(AUDIT_ENTITY_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? entityFromPath(req.path);

    return next.handle().pipe(
      mergeMap(async (result: unknown) => {
        const res = context.switchToHttp().getResponse<Response>();
        const params = (req.params ?? {}) as Record<string, string>;
        const resultId =
          result && typeof result === 'object' && 'id' in result
            ? String((result as { id: unknown }).id)
            : undefined;
        const entityId = params.id ?? params.key ?? resultId ?? null;
        try {
          await this.prisma.auditLog.create({
            data: {
              entity,
              entityId,
              action,
              username: req.user?.username ?? null,
              summary: JSON.parse(
                JSON.stringify({
                  method: req.method,
                  path: req.originalUrl ?? req.url,
                  params,
                  body: redact(req.body ?? null),
                  statusCode: res.statusCode,
                }),
              ),
            },
          });
        } catch (err) {
          this.logger.error(`Could not write audit log: ${String(err)}`);
        }
        return result;
      }),
    );
  }
}
