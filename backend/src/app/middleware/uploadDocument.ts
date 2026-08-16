import type { NextFunction, Request, Response } from 'express';
import multer from 'multer';

import { AppError } from '../../shared/errors/AppError.js';

// claude.md §14: max file size / allowed file types — not called out in
// §63's configurable-env-var list, so this stays a constant.
const MAX_DOCUMENT_SIZE_BYTES = 5 * 1024 * 1024;

const ALLOWED_SIGNATURES: { matches: (buf: Buffer) => boolean }[] = [
  // JPEG: FF D8 FF
  { matches: (buf) => buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff },
  // PNG: 89 50 4E 47
  {
    matches: (buf) =>
      buf.length >= 4 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47,
  },
  // PDF: 25 50 44 46 ("%PDF")
  {
    matches: (buf) =>
      buf.length >= 4 && buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46,
  },
];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_DOCUMENT_SIZE_BYTES },
});

export const uploadDocument = upload.single('document');

// claude.md §14: never trust a client-provided MIME type alone — check the
// actual file signature (magic bytes) server-side.
export function validateDocumentFile(req: Request, _res: Response, next: NextFunction): void {
  const file = req.file;

  if (!file) {
    next(new AppError(400, 'VALIDATION_ERROR', 'A document file is required'));
    return;
  }

  const isAllowed = ALLOWED_SIGNATURES.some((sig) => sig.matches(file.buffer));
  if (!isAllowed) {
    next(new AppError(400, 'UNSUPPORTED_FILE_TYPE', 'Only JPEG, PNG, or PDF files are allowed'));
    return;
  }

  next();
}
