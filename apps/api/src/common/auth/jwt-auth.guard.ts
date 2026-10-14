import { type CanActivate, type ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { AppException } from '../errors/app-exception.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SESSION_COOKIE } from './auth.constants.js';
import { IS_PUBLIC_KEY } from './public.decorator.js';
import type { AuthedRequest, JwtPayload } from './session-user.js';

/** Global guard: every route needs a valid `sc_session` JWT cookie unless marked @Public(). */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const token = (req.cookies as Record<string, string> | undefined)?.[SESSION_COOKIE];
    if (!token) throw unauthorized();

    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(token);
    } catch {
      throw unauthorized();
    }
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, username: true },
    });
    if (!user) throw unauthorized();
    req.user = user;
    return true;
  }
}

function unauthorized(): AppException {
  return new AppException(HttpStatus.UNAUTHORIZED, 'UNAUTHORIZED', 'Please log in.');
}
