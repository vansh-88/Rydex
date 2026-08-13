import { env } from '../../config/env.js';
import { rateLimit } from '../../infrastructure/redis/rateLimit.js';

// Rate limits shared by more than one module live here; a limit used by a
// single router stays declared in that router (see auth/support/ride
// routes.ts). This one guards every Cloudinary upload path — the vehicle
// module's document upload and the user module's driver-license submission —
// and both must draw from the *same* bucket, so a user can't get twice the
// allowance by alternating between the two endpoints.
export const documentUploadLimit = rateLimit({
  keyPrefix: 'document-upload-user',
  windowSeconds: env.DOCUMENT_UPLOAD_RATE_LIMIT_WINDOW_SECONDS,
  max: env.DOCUMENT_UPLOAD_RATE_LIMIT_MAX,
  keyFn: (req) => req.user!.id,
});
