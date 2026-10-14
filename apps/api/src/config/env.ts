import { z } from 'zod';

const booleanString = z
  .enum(['true', 'false', '1', '0', ''])
  .default('false')
  .transform((v) => v === 'true' || v === '1');

/** Environment schema — the API refuses to start when a required variable is missing or invalid. */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  TZ: z.string().default('Asia/Colombo'),
  DATABASE_URL: z
    .string()
    .min(1)
    .refine((v) => v.startsWith('postgres://') || v.startsWith('postgresql://'), {
      message: 'must be a postgres:// URL',
    }),
  JWT_SECRET: z.string().min(16, 'must be at least 16 characters'),
  ADMIN_USERNAME: z.string().trim().min(1).default('admin'),
  ADMIN_PASSWORD: z.string().min(6),
  S3_ENDPOINT: z.url(),
  S3_REGION: z.string().default('us-east-1'),
  S3_ACCESS_KEY: z.string().min(1),
  S3_SECRET_KEY: z.string().min(1),
  S3_BUCKET: z
    .string()
    .regex(/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/, 'must be a valid S3 bucket name')
    .default('supun-docs'),
  GOTENBERG_URL: z.url(),
  /** Largest document upload in megabytes. */
  MAX_UPLOAD_MB: z.coerce.number().int().min(1).max(1024).default(50),
  SEED_SAMPLE_DATA: booleanString,
  COOKIE_SECURE: booleanString,
});

export type Env = z.infer<typeof envSchema>;

/** Used by ConfigModule.forRoot({ validate }). Throws a readable error listing every bad variable. */
export function validateEnv(raw: Record<string, unknown>): Env {
  const result = envSchema.safeParse(raw);
  if (!result.success) {
    const lines = result.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`);
    throw new Error(`Invalid environment configuration:\n${lines.join('\n')}`);
  }
  return result.data;
}
