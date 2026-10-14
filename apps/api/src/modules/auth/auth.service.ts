import { randomUUID } from 'node:crypto';
import { HttpStatus, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { ChangePasswordInput, LoginInput, MeResponse } from '@sc/shared';
import * as argon2 from 'argon2';
import { AppException } from '../../common/errors/app-exception.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import type { JwtPayload } from '../../common/auth/session-user.js';

interface UserRow {
  id: string;
  username: string;
  mustChangePassword: boolean;
  usingDefaultPassword: boolean;
  lastLoginAt: Date | null;
}

export function toMe(user: UserRow): MeResponse {
  return {
    id: user.id,
    username: user.username,
    mustChangePassword: user.mustChangePassword,
    usingDefaultPassword: user.usingDefaultPassword,
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
  };
}

@Injectable()
export class AuthService {
  /** Only used to equalise timing for unknown usernames. */
  private readonly dummyHash = hashPassword(randomUUID());

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async login(input: LoginInput): Promise<{ token: string; me: MeResponse }> {
    const user = await this.prisma.user.findUnique({ where: { username: input.username } });
    // Always run a hash verification so timing does not reveal whether the user exists.
    const ok = user
      ? await argon2.verify(user.passwordHash, input.password).catch(() => false)
      : await argon2
          .verify(await this.dummyHash, input.password)
          .catch(() => false)
          .then(() => false);
    if (!user || !ok) {
      throw new AppException(
        HttpStatus.UNAUTHORIZED,
        'INVALID_CREDENTIALS',
        'Wrong username or password.',
      );
    }
    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });
    return { token: await this.sign(updated), me: toMe(updated) };
  }

  async me(userId: string): Promise<MeResponse> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppException(HttpStatus.UNAUTHORIZED, 'UNAUTHORIZED', 'Please log in.');
    return toMe(user);
  }

  async changePassword(
    userId: string,
    input: ChangePasswordInput,
  ): Promise<{ token: string; me: MeResponse }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppException(HttpStatus.UNAUTHORIZED, 'UNAUTHORIZED', 'Please log in.');
    const ok = await argon2.verify(user.passwordHash, input.currentPassword).catch(() => false);
    if (!ok) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        'WRONG_PASSWORD',
        'The current password is not correct.',
      );
    }
    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await hashPassword(input.newPassword),
        mustChangePassword: false,
        usingDefaultPassword: false,
      },
    });
    return { token: await this.sign(updated), me: toMe(updated) };
  }

  private sign(user: { id: string; username: string }): Promise<string> {
    const payload: JwtPayload = { sub: user.id, username: user.username };
    return this.jwt.signAsync(payload);
  }
}

export function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, { type: argon2.argon2id });
}
