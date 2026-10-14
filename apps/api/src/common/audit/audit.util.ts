import type { AuditAction } from '@sc/shared';

const SECRET_KEYS = /pass(word)?|secret|token|hash/i;

/** Replaces values of secret-looking keys with "[redacted]", recursively. */
export function redact(value: unknown, depth = 0): unknown {
  if (depth > 6 || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) {
    out[k] = SECRET_KEYS.test(k) ? '[redacted]' : redact(v, depth + 1);
  }
  return out;
}

export function actionForMethod(method: string): AuditAction | undefined {
  switch (method.toUpperCase()) {
    case 'POST':
      return 'CREATE';
    case 'PUT':
    case 'PATCH':
      return 'UPDATE';
    case 'DELETE':
      return 'DELETE';
    default:
      return undefined;
  }
}

/** "/settings/company" → "Setting"; "/projects/123/boq-items" → "Project" (first segment). */
export function entityFromPath(path: string): string {
  const first = path.replace(/^\/+/, '').split(/[/?]/)[0] ?? 'unknown';
  const singular = first.endsWith('ies')
    ? `${first.slice(0, -3)}y`
    : first.endsWith('s')
      ? first.slice(0, -1)
      : first;
  return singular
    .split('-')
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join('');
}
