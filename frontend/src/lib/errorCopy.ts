// Backend error code -> a sentence a passenger or driver can act on.
//
// Two things about the backend's error design shape this file:
//
// 1. Every ownership failure returns 404, never 403 (so resource existence is
//    never leaked). The not-found copy is therefore also what a user sees on a
//    permission error, and has to read sensibly in both cases — which is why
//    none of it says "this does not exist".
// 2. `ROUTE_NOT_FOUND` is used for two unrelated things: a 404 for an unknown
//    API path, and a 422 when the map provider cannot connect two points.
//    Only the second is ever user-facing, so it is resolved by status.
const COPY: Record<string, string> = {
  // Auth
  UNAUTHORIZED: 'Your session has expired. Please sign in again.',
  REFRESH_TOKEN_EXPIRED: 'Your session has expired. Please sign in again.',
  REFRESH_TOKEN_REUSE_DETECTED:
    'You were signed out for security reasons. Please sign in again.',
  ACCOUNT_SUSPENDED: 'This account has been suspended. Contact support if you think this is wrong.',
  FORBIDDEN: 'You do not have access to this.',

  // OTP
  INVALID_OTP: 'That code is not correct. Check it and try again.',
  OTP_EXPIRED: 'That code has expired. Request a new one.',
  OTP_TOO_MANY_ATTEMPTS: 'Too many incorrect attempts. Request a new code.',
  OTP_RESEND_COOLDOWN: 'Please wait a moment before requesting another code.',
  SIGNUP_DETAILS_REQUIRED: 'We need a few details to finish creating your account.',

  // Uniqueness
  EMAIL_ALREADY_IN_USE: 'That email is already linked to another account.',
  PHONE_ALREADY_IN_USE: 'That phone number is already linked to another account.',
  REGISTRATION_NUMBER_ALREADY_IN_USE: 'That registration number is already registered.',

  // Driver onboarding
  ALREADY_DRIVER: 'You are already registered as a driver.',
  DRIVER_APPLICATION_PENDING: 'Your driver application is already under review.',
  VEHICLE_REJECTED:
    'This vehicle was rejected and cannot be resubmitted. Add the vehicle again to have it reviewed.',
  VEHICLE_NOT_ELIGIBLE:
    'This vehicle cannot be used yet — it needs to be verified and have enough seats.',

  // Rides
  RIDE_NOT_FOUND: 'We could not find that ride. It may have been cancelled.',
  INVALID_RIDE_STATE: 'This ride has already moved on from that step. Refresh to see its status.',
  RIDE_NOT_BOOKABLE: 'This ride is no longer accepting bookings.',
  NO_SEATS_AVAILABLE: 'Those seats were just taken. Try a different ride.',
  CANNOT_BOOK_OWN_RIDE: 'You cannot book a seat on a ride you are driving.',

  // Bookings and ratings
  BOOKING_NOT_FOUND: 'We could not find that booking.',
  BOOKING_NOT_CANCELLABLE: 'This trip has already started, so it can no longer be cancelled.',
  BOOKING_ALREADY_CANCELLED: 'This booking is already cancelled.',
  RIDE_NOT_COMPLETED: 'You can rate this trip once it has been completed.',
  BOOKING_NOT_RATEABLE: 'This trip cannot be rated.',
  ALREADY_RATED: 'You have already rated this trip. Ratings cannot be changed.',

  // Payments
  PAYMENT_NOT_FOUND: 'We could not find that payment.',
  PAYMENT_PROVIDER_ERROR: 'The payment provider is not responding. Please try again shortly.',
  IDEMPOTENCY_CONFLICT: 'This looks like a different request reusing an earlier one. Start again.',
  IDEMPOTENCY_KEY_IN_PROGRESS: 'This is still being processed. Give it a moment.',

  // Uploads
  UNSUPPORTED_FILE_TYPE: 'Upload a JPEG, PNG or PDF.',
  FILE_TOO_LARGE: 'That file is too large. The limit is 5 MB.',
  PAYLOAD_TOO_LARGE: 'That request was too large.',
  INVALID_UPLOAD: 'That file could not be read. Try a different one.',

  // Infrastructure
  RATE_LIMITED: 'Too many requests. Please wait a moment and try again.',
  SUPPORT_CHAT_RATE_LIMITED: 'You are sending messages too quickly. Please slow down.',
  SUPPORT_CHAT_DAILY_LIMIT_REACHED: "You have reached today's support message limit.",
  MAP_PROVIDER_ERROR: 'We could not look up that location right now. Please try again.',
  GEOCODE_NOT_FOUND: 'We could not find that place. Try a nearby landmark or city.',
  AI_PROVIDER_ERROR: 'Support could not answer that just now. Try rephrasing, or ask something simpler.',
  AI_PROVIDER_TIMEOUT: 'Support is taking too long to respond. Please try again.',
  AI_PROVIDER_RATE_LIMITED: 'Support is busy right now. Please try again shortly.',
  EMAIL_SEND_FAILED: 'We could not send that email. Please try again.',
  SERVICE_UNAVAILABLE: 'Rydex is temporarily unavailable. Please try again shortly.',
  DATABASE_UNAVAILABLE: 'Rydex is temporarily unavailable. Please try again shortly.',
  REDIS_UNAVAILABLE: 'Rydex is temporarily unavailable. Please try again shortly.',
  INTERNAL_ERROR: 'Something went wrong on our end. Please try again.',
  INVALID_CURSOR: 'That page of results is no longer valid. Reload the list.',
};

const FALLBACK = 'Something went wrong. Please try again.';

export function errorCopy(code: string | undefined, status?: number): string {
  if (code === undefined) return FALLBACK;

  // The one genuinely overloaded code — see the note above.
  if (code === 'ROUTE_NOT_FOUND') {
    return status === 422
      ? 'We could not find a driving route between those two places.'
      : FALLBACK;
  }

  return COPY[code] ?? FALLBACK;
}

// VALIDATION_ERROR messages already name the offending field
// ("pickupLat: expected number, received undefined"), which is useful next to
// a form field but not as a toast. Callers that can attach the message to a
// field should; everything else gets the generic line.
export function isFieldValidationError(code: string | undefined): boolean {
  return code === 'VALIDATION_ERROR';
}
