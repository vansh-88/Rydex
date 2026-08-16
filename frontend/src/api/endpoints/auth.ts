import { apiRequest } from '@/api/client';
import type { AuthTokens, UserProfile } from '@/api/types';

// A stable per-browser id, sent with verify-otp so the backend can scope
// refresh tokens to this device. That is what makes "sign out everywhere"
// meaningful and lets one device's session be revoked without killing the
// others.
const DEVICE_ID_KEY = 'rydex.deviceId';

function getDeviceId(): string | undefined {
  try {
    const existing = localStorage.getItem(DEVICE_ID_KEY);
    if (existing !== null) return existing;

    const created = crypto.randomUUID();
    localStorage.setItem(DEVICE_ID_KEY, created);
    return created;
  } catch {
    // Storage unavailable (private mode). The backend treats deviceId as
    // optional, so the session still works — it just cannot be told apart
    // from this device's other sessions.
    return undefined;
  }
}

export function requestOtp(email: string): Promise<{ message: string }> {
  return apiRequest('/auth/request-otp', { method: 'POST', body: { email } });
}

export interface VerifyOtpInput {
  email: string;
  otp: string;
  // Required only when the email has no account yet. The backend checks for
  // their absence *before* consuming the OTP, which is what lets the login
  // form ask for them and retry with the same code.
  name?: string;
  phone?: string;
}

export function verifyOtp(input: VerifyOtpInput): Promise<AuthTokens> {
  return apiRequest('/auth/verify-otp', {
    method: 'POST',
    body: { ...input, deviceId: getDeviceId() },
  });
}

export function logout(refreshToken: string, allDevices = false): Promise<{ message: string }> {
  return apiRequest('/auth/logout', {
    method: 'POST',
    body: { refreshToken, allDevices },
  });
}

export function getMe(signal?: AbortSignal): Promise<UserProfile> {
  return apiRequest('/users/me', { signal });
}

export interface UpdateProfileInput {
  name?: string;
  phone?: string;
  email?: string;
  profileImageUrl?: string | null;
}

export function updateMe(input: UpdateProfileInput): Promise<UserProfile> {
  return apiRequest('/users/me', { method: 'PATCH', body: input });
}
