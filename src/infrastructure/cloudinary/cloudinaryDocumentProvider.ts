import { v2 as cloudinary } from 'cloudinary';

import type {
  DocumentProvider,
  UploadDocumentInput,
  UploadedDocument,
} from './documentProvider.js';

const SIGNED_URL_TTL_SECONDS = 300;

export class CloudinaryDocumentProvider implements DocumentProvider {
  constructor(cloudName: string, apiKey: string, apiSecret: string) {
    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
      secure: true,
    });
  }

  uploadDocument({ buffer, folder }: UploadDocumentInput): Promise<UploadedDocument> {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { folder, resource_type: 'image', type: 'authenticated' },
        (err, result) => {
          if (err !== undefined || result === undefined) {
            reject(new Error(err?.message ?? 'Cloudinary upload returned no result'));
            return;
          }
          resolve({ publicId: result.public_id, secureUrl: result.secure_url });
        },
      );
      uploadStream.end(buffer);
    });
  }

  getSignedUrl(publicId: string, format: string): string {
    return cloudinary.utils.private_download_url(publicId, format, {
      resource_type: 'image',
      type: 'authenticated',
      expires_at: Math.floor(Date.now() / 1000) + SIGNED_URL_TTL_SECONDS,
    });
  }
}
