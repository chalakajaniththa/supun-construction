import { createHash } from 'node:crypto';
import { Transform, type TransformCallback } from 'node:stream';
import type { Request } from 'express';
import busboy from 'busboy';
import { mimeTypeFor } from '@sc/shared';
import type { StorageService } from '../../common/storage/storage.service.js';

export interface StoredFile {
  key: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
}

export type UploadProblem = 'FILE_REQUIRED' | 'UNSUPPORTED_FILE_TYPE' | 'FILE_TOO_LARGE';

export interface ReceivedUpload {
  fields: Record<string, string>;
  file: StoredFile | null;
  problem: UploadProblem | null;
}

/** Counts bytes and computes the sha256 of everything that flows through. */
class HashingCounter extends Transform {
  private readonly hash = createHash('sha256');
  bytes = 0;

  override _transform(chunk: Buffer, _enc: BufferEncoding, cb: TransformCallback): void {
    this.hash.update(chunk);
    this.bytes += chunk.length;
    cb(null, chunk);
  }

  digest(): string {
    return this.hash.digest('hex');
  }
}

/** Keeps a file name readable but safe for storage keys and headers. */
export function safeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? '';
  const dot = base.lastIndexOf('.');
  const clean = (part: string) =>
    part
      .normalize('NFKD')
      .replace(/[^\w.\- ]+/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^[-.]+|[-.]+$/g, '');
  const stem = clean(dot > 0 ? base.slice(0, dot) : base).slice(0, 100) || 'file';
  const ext =
    dot > 0
      ? clean(base.slice(dot + 1))
          .slice(0, 10)
          .toLowerCase()
      : '';
  return ext ? `${stem}.${ext}` : stem;
}

/**
 * Reads a multipart request: text fields + one file part named `file`. The file is streamed
 * straight to S3 (never buffered in memory) while its size and sha256 are computed.
 * Wrong type / too big / missing file → `problem` is set and nothing is left in storage.
 */
export function receiveUpload(
  req: Request,
  opts: { storage: StorageService; maxBytes: number; makeKey: (fileName: string) => string },
): Promise<ReceivedUpload> {
  return new Promise<ReceivedUpload>((resolve, reject) => {
    const fields: Record<string, string> = {};
    let problem: UploadProblem | null = null;
    let uploading: Promise<StoredFile | null> | null = null;
    let settled = false;

    let bb: busboy.Busboy;
    try {
      bb = busboy({
        headers: req.headers,
        defParamCharset: 'utf8',
        limits: { files: 1, fields: 30, fieldSize: 20_000, fileSize: opts.maxBytes },
      });
    } catch {
      // Not multipart at all.
      resolve({ fields, file: null, problem: 'FILE_REQUIRED' });
      return;
    }

    const fail = (err: unknown) => {
      if (settled) return;
      settled = true;
      reject(err);
    };

    bb.on('field', (name, value) => {
      fields[name] = value;
    });

    bb.on('file', (name, stream, info) => {
      const mimeType = mimeTypeFor(info.filename ?? '');
      if (name !== 'file' || uploading) {
        stream.resume();
        return;
      }
      if (!mimeType) {
        problem = 'UNSUPPORTED_FILE_TYPE';
        stream.resume();
        return;
      }
      const fileName = (info.filename ?? 'file').split(/[\\/]/).pop()!.slice(-200);
      const key = opts.makeKey(fileName);
      const counter = new HashingCounter();
      const abort = new AbortController();
      let tooBig = false;
      stream.on('limit', () => {
        tooBig = true;
        problem = 'FILE_TOO_LARGE';
        abort.abort();
        stream.resume();
      });
      stream.pipe(counter);
      uploading = opts.storage
        .uploadStream({ key, body: counter, contentType: mimeType, signal: abort.signal })
        .then(async () => {
          if (tooBig) {
            await opts.storage.deleteObject(key).catch(() => undefined);
            return null;
          }
          return { key, fileName, mimeType, sizeBytes: counter.bytes, sha256: counter.digest() };
        })
        .catch(async (err: unknown) => {
          if (tooBig) {
            await opts.storage.deleteObject(key).catch(() => undefined);
            return null;
          }
          throw err;
        });
    });

    bb.on('error', fail);
    bb.on('close', () => {
      void (async () => {
        try {
          const file = uploading ? await uploading : null;
          if (settled) return;
          settled = true;
          resolve({
            fields,
            file,
            problem: problem ?? (file ? null : 'FILE_REQUIRED'),
          });
        } catch (err) {
          fail(err);
        }
      })();
    });
    req.on('aborted', () => fail(new Error('Upload aborted by the client')));
    req.pipe(bb);
  });
}

/** Content-Disposition with an ASCII fallback and the UTF-8 name (RFC 6266 / 5987). */
export function contentDisposition(fileName: string, inline: boolean): string {
  const ascii = fileName.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  const encoded = encodeURIComponent(fileName).replace(
    /['()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `${inline ? 'inline' : 'attachment'}; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}
