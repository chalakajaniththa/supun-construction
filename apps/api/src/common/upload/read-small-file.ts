import busboy from 'busboy';
import type { Request } from 'express';
import { AppException } from '../errors/app-exception.js';
import { HttpStatus } from '@nestjs/common';

export interface SmallFile {
  fileName: string;
  data: Buffer;
}

/**
 * Reads one small multipart file (field `file`) into memory — for imports, never for documents
 * (those are streamed to storage). 400 FILE_REQUIRED without a file, 413 FILE_TOO_LARGE above maxBytes.
 */
export function readSmallFile(req: Request, maxBytes: number): Promise<SmallFile> {
  return new Promise((resolve, reject) => {
    let bb: busboy.Busboy;
    try {
      bb = busboy({ headers: req.headers, limits: { files: 1, fileSize: maxBytes } });
    } catch {
      reject(AppException.badRequest('FILE_REQUIRED', 'Choose a file to upload.'));
      return;
    }
    let found: SmallFile | null = null;
    let tooLarge = false;
    bb.on('file', (name, stream, info) => {
      if (name !== 'file') {
        stream.resume();
        return;
      }
      const chunks: Buffer[] = [];
      stream.on('data', (c: Buffer) => chunks.push(c));
      stream.on('limit', () => {
        tooLarge = true;
      });
      stream.on('end', () => {
        found = { fileName: info.filename || 'file', data: Buffer.concat(chunks) };
      });
    });
    bb.on('error', (err) => reject(err));
    bb.on('close', () => {
      if (tooLarge) {
        reject(
          new AppException(
            HttpStatus.PAYLOAD_TOO_LARGE,
            'FILE_TOO_LARGE',
            'The file is too large.',
            {
              maxMb: Math.round(maxBytes / 1_048_576),
            },
          ),
        );
      } else if (!found || !found.data.length) {
        reject(AppException.badRequest('FILE_REQUIRED', 'Choose a file to upload.'));
      } else resolve(found);
    });
    req.pipe(bb);
  });
}
