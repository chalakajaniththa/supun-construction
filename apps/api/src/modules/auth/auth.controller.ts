import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  type ChangePasswordInput,
  type LoginInput,
  type MeResponse,
  changePasswordSchema,
  loginSchema,
} from '@sc/shared';
import type { Request, Response } from 'express';
import { AuditAction, AuditEntity, SkipAudit } from '../../common/audit/audit.decorator.js';
import { SESSION_COOKIE, SESSION_TTL_SECONDS } from '../../common/auth/auth.constants.js';
import { Public } from '../../common/auth/public.decorator.js';
import { CurrentUser, type SessionUser } from '../../common/auth/session-user.js';
import { AppException } from '../../common/errors/app-exception.js';
import { ZodValidationPipe } from '../../common/zod/zod-validation.pipe.js';
import type { Env } from '../../config/env.js';
import { AuthService } from './auth.service.js';
import { LoginRateLimiter } from './login-rate-limiter.js';

@Controller('auth')
@AuditEntity('User')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly limiter: LoginRateLimiter,
    private readonly config: ConfigService<Env, true>,
  ) {}

  @Public()
  @SkipAudit()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body(new ZodValidationPipe(loginSchema)) body: LoginInput,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<MeResponse> {
    const key = req.ip ?? 'unknown';
    if (this.limiter.isBlocked(key)) {
      res.setHeader('Retry-After', String(this.limiter.retryAfterSeconds(key)));
      throw new AppException(
        HttpStatus.TOO_MANY_REQUESTS,
        'TOO_MANY_ATTEMPTS',
        'Too many wrong attempts. Please wait a minute and try again.',
      );
    }
    try {
      const { token, me } = await this.auth.login(body);
      this.limiter.reset(key);
      this.setCookie(res, token);
      return me;
    } catch (err) {
      this.limiter.recordFailure(key);
      throw err;
    }
  }

  @Public()
  @SkipAudit()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout(@Res({ passthrough: true }) res: Response): { ok: true } {
    res.clearCookie(SESSION_COOKIE, this.cookieOptions());
    return { ok: true };
  }

  @Get('me')
  me(@CurrentUser() user: SessionUser): Promise<MeResponse> {
    return this.auth.me(user.id);
  }

  @AuditAction('UPDATE')
  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @CurrentUser() user: SessionUser,
    @Body(new ZodValidationPipe(changePasswordSchema)) body: ChangePasswordInput,
    @Res({ passthrough: true }) res: Response,
  ): Promise<MeResponse> {
    const { token, me } = await this.auth.changePassword(user.id, body);
    this.setCookie(res, token);
    return me;
  }

  private cookieOptions() {
    return {
      httpOnly: true,
      sameSite: 'lax' as const,
      secure: this.config.get('COOKIE_SECURE', { infer: true }),
      path: '/',
    };
  }

  private setCookie(res: Response, token: string): void {
    res.cookie(SESSION_COOKIE, token, {
      ...this.cookieOptions(),
      maxAge: SESSION_TTL_SECONDS * 1000,
    });
  }
}
