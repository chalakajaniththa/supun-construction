import { z } from 'zod';

export const loginSchema = z.object({
  username: z.string().trim().min(1, 'REQUIRED').max(100),
  password: z.string().min(1, 'REQUIRED').max(200),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const PASSWORD_MIN_LENGTH = 8;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'REQUIRED').max(200),
    newPassword: z.string().min(PASSWORD_MIN_LENGTH, 'PASSWORD_TOO_SHORT').max(200),
    confirmPassword: z.string().min(1, 'REQUIRED').max(200),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'PASSWORDS_DO_NOT_MATCH',
  })
  .refine((v) => v.newPassword !== v.currentPassword, {
    path: ['newPassword'],
    message: 'PASSWORD_SAME_AS_OLD',
  });
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export interface MeResponse {
  id: string;
  username: string;
  mustChangePassword: boolean;
  /** True while the password is still the default from the install (.env ADMIN_PASSWORD). */
  usingDefaultPassword: boolean;
  lastLoginAt: string | null;
}
