import type { ApiErrorBody } from '@sc/shared';

/** Error thrown for any non-2xx API response (or a network failure: status 0, code NETWORK). */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  signal?: AbortSignal;
  /** Don't redirect to /login on 401 (used by the login form and the login page check). */
  skipAuthRedirect?: boolean;
}

export const API_BASE = '/api';

export function buildUrl(path: string, query?: RequestOptions['query']): string {
  const url = `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;
  if (!query) return url;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== null && v !== '') params.set(k, String(v));
  }
  const qs = params.toString();
  return qs ? `${url}?${qs}` : url;
}

let redirecting = false;

function redirectToLogin(): void {
  if (typeof window === 'undefined' || redirecting) return;
  if (window.location.pathname.startsWith('/login')) return;
  redirecting = true;
  const next = encodeURIComponent(window.location.pathname + window.location.search);
  // Clear a stale cookie first so the proxy does not keep sending us back.
  void fetch(`${API_BASE}/auth/logout`, { method: 'POST', credentials: 'include' }).finally(() => {
    // A full page load on purpose: it drops all cached client state of the old session.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = `/login?next=${next}`;
  });
}

/** fetch wrapper: JSON in/out, cookies included, errors → ApiError, 401 → /login. */
export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, query, signal, skipAuthRedirect } = options;
  let res: Response;
  try {
    res = await fetch(buildUrl(path, query), {
      method,
      credentials: 'include',
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
      cache: 'no-store',
    });
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') throw err;
    throw new ApiError(0, 'NETWORK', 'Network error');
  }

  if (res.status === 204) return undefined as T;
  const text = await res.text();
  const data: unknown = text ? safeJson(text) : undefined;

  if (!res.ok) {
    const e = (data ?? {}) as Partial<ApiErrorBody>;
    if (res.status === 401 && !skipAuthRedirect) redirectToLogin();
    throw new ApiError(
      res.status,
      typeof e.code === 'string' ? e.code : codeForStatus(res.status),
      typeof e.message === 'string' ? e.message : res.statusText,
      e.details,
    );
  }
  return data as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function codeForStatus(status: number): string {
  if (status === 401) return 'UNAUTHORIZED';
  if (status === 404) return 'NOT_FOUND';
  if (status === 409) return 'CONFLICT';
  if (status === 400) return 'VALIDATION_FAILED';
  if (status === 429) return 'TOO_MANY_ATTEMPTS';
  if (status === 502 || status === 503 || status === 504) return 'NETWORK';
  return 'INTERNAL_ERROR';
}

/** The i18n key (inside the `errors` namespace) for an error. */
export function errorMessageKey(err: unknown, known: (key: string) => boolean): string {
  if (err instanceof ApiError && known(err.code)) return err.code;
  return 'generic';
}
