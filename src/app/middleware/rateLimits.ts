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

// claude.md §49 lists rate limiting per endpoint, but limits were opt-in per
// router, so everything not explicitly named — the whole admin module, the
// notification list/read endpoints, chat history — had no limit whatsoever,
// and any newly added router inherited that by default.
//
// This is the catch-all for authenticated endpoints that aren't expensive
// enough to deserve their own bucket (ride search, ride/booking creation and
// support chat keep theirs). It is set high enough that normal use never
// touches it: it exists so an authenticated client cannot hammer the database
// without limit, not to shape traffic.
//
// Keyed per user, since every route it guards is behind `authenticate`.
export const authenticatedReadLimit = rateLimit({
  keyPrefix: 'authenticated-read-user',
  windowSeconds: env.AUTHENTICATED_READ_RATE_LIMIT_WINDOW_SECONDS,
  max: env.AUTHENTICATED_READ_RATE_LIMIT_MAX,
  keyFn: (req) => req.user!.id,
});
