import { env } from '../../config/env.js';
import { CloudinaryDocumentProvider } from './cloudinaryDocumentProvider.js';
import type { DocumentProvider } from './documentProvider.js';

export const documentProvider: DocumentProvider = new CloudinaryDocumentProvider(
  env.CLOUDINARY_CLOUD_NAME,
  env.CLOUDINARY_API_KEY,
  env.CLOUDINARY_API_SECRET,
);

export { extractFormatFromSecureUrl } from './documentProvider.js';
export type { DocumentProvider } from './documentProvider.js';
