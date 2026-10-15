import type { ReportFormat, ReportId } from '@sc/shared';
import { ApiError, buildUrl } from './api-client';

/** "attachment; filename=…; filename*=UTF-8''…" → the file name. */
export function fileNameFrom(disposition: string | null, fallback: string): string {
  if (!disposition) return fallback;
  const star = /filename\*=UTF-8''([^;]+)/i.exec(disposition);
  if (star?.[1]) return decodeURIComponent(star[1]);
  const plain = /filename="?([^";]+)"?/i.exec(disposition);
  return plain?.[1] ?? fallback;
}

/**
 * Downloads a report (GET /reports/:id) and hands it to the browser as a file.
 * Errors come back as ApiError so the page can show a translated message.
 */
export async function downloadReport(
  reportId: ReportId,
  format: ReportFormat,
  params: Record<string, string | number | undefined | null>,
  locale: string,
): Promise<string> {
  let res: Response;
  try {
    res = await fetch(buildUrl(`/reports/${reportId}`, { ...params, format, locale }), {
      credentials: 'include',
      cache: 'no-store',
    });
  } catch {
    throw new ApiError(0, 'NETWORK', 'Network error');
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { code?: string; message?: string };
    throw new ApiError(res.status, body.code ?? 'INTERNAL_ERROR', body.message ?? res.statusText);
  }
  const blob = await res.blob();
  const name = fileNameFrom(res.headers.get('Content-Disposition'), `${reportId}.${format}`);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
  return name;
}
