import type { ApiErrorBody } from '@sc/shared';
import { ApiError, buildUrl } from './api-client';

/**
 * Multipart upload with progress (XMLHttpRequest — fetch has no upload progress).
 * Text fields are sent first, then the file as the `file` part.
 */
export function uploadWithProgress<T>(
  path: string,
  fields: Record<string, string | null | undefined>,
  file: File,
  onProgress?: (fraction: number) => void,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const form = new FormData();
    for (const [k, v] of Object.entries(fields)) {
      if (v !== undefined && v !== null && v !== '') form.append(k, v);
    }
    form.append('file', file, file.name);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', buildUrl(path));
    xhr.withCredentials = true;
    xhr.responseType = 'text';
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(e.loaded / e.total);
    };
    xhr.onload = () => {
      let data: unknown;
      try {
        data = xhr.responseText ? JSON.parse(xhr.responseText) : undefined;
      } catch {
        data = undefined;
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(data as T);
        return;
      }
      const e = (data ?? {}) as Partial<ApiErrorBody>;
      const code =
        typeof e.code === 'string'
          ? e.code
          : xhr.status === 413
            ? 'FILE_TOO_LARGE'
            : 'INTERNAL_ERROR';
      reject(new ApiError(xhr.status, code, e.message ?? xhr.statusText, e.details));
    };
    xhr.onerror = () => reject(new ApiError(0, 'NETWORK', 'Network error'));
    xhr.send(form);
  });
}

/** "1.4 MB" — sizes for people, not computers. */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export const documentFileUrl = (documentId: string, versionId: string, inline = false) =>
  buildUrl(
    `/documents/${documentId}/versions/${versionId}/download`,
    inline ? { inline: 1 } : undefined,
  );
