import { env } from '../../config/env.js';
import { CloudinaryDocumentProvider } from './cloudinaryDocumentProvider.js';
import { extractFormatFromSecureUrl } from './documentProvider.js';
import type { DocumentProvider } from './documentProvider.js';

export const documentProvider: DocumentProvider = new CloudinaryDocumentProvider(
  env.CLOUDINARY_CLOUD_NAME,
  env.CLOUDINARY_API_KEY,
  env.CLOUDINARY_API_SECRET,
);

// Every read of a stored document needs this same pair of calls (claude.md
// §14: no permanently-usable stored link) — shared here so callers reviewing
// driver licenses, vehicle documents, etc. don't each re-derive it.
export function toSignedDocumentUrl(cloudinaryPublicId: string, secureUrl: string): string {
  return documentProvider.getSignedUrl(cloudinaryPublicId, extractFormatFromSecureUrl(secureUrl));
}

export { extractFormatFromSecureUrl } from './documentProvider.js';
export type { DocumentProvider } from './documentProvider.js';
