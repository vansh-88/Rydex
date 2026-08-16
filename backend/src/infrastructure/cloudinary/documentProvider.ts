export interface UploadDocumentInput {
  buffer: Buffer;
  folder: string;
}

export interface UploadedDocument {
  publicId: string;
  secureUrl: string;
}

// claude.md §14/§17-style strategy: business logic depends on this
// interface, never on the Cloudinary SDK directly.
export interface DocumentProvider {
  uploadDocument(input: UploadDocumentInput): Promise<UploadedDocument>;
  // Documents are uploaded as Cloudinary "authenticated" delivery type
  // (claude.md §14: no unrestricted document access), so every read needs a
  // freshly signed, short-lived URL rather than the raw stored secureUrl.
  getSignedUrl(publicId: string, format: string): string;
}

// Cloudinary's own secure_url always carries the real extension it assigned
// at upload time — read it back from there instead of storing a redundant
// "format" column.
export function extractFormatFromSecureUrl(secureUrl: string): string {
  const format = secureUrl.split('.').pop();
  return format ?? '';
}
