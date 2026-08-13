import type { DevicePlatform } from '../../../generated/prisma/enums.js';
import { prisma } from '../../../infrastructure/database/prismaClient.js';

// claude.md §45: `deviceToken` is the unique key — a device/app-install's
// FCM token is a single physical identity. Re-registering the same token
// (app reopened, token refreshed and re-sent, or a different account logs
// in on the same device) reassigns it to the calling user rather than
// erroring or creating a duplicate row.
export async function upsertDevice(userId: string, deviceToken: string, platform: DevicePlatform): Promise<void> {
  await prisma.userDevice.upsert({
    where: { deviceToken },
    update: { userId, platform, lastSeenAt: new Date() },
    create: { userId, deviceToken, platform },
  });
}

export async function findTokensByUserId(userId: string): Promise<string[]> {
  const devices = await prisma.userDevice.findMany({ where: { userId }, select: { deviceToken: true } });
  return devices.map((d) => d.deviceToken);
}

// claude.md §45: "when FCM indicates a token is invalid/unregistered,
// deactivate or remove it" — removal, since user_devices has no status
// field in the given schema (§45's conceptual fields are exhaustive: id,
// user_id, device_token, platform, last_seen_at, created_at, updated_at).
export async function removeTokens(tokens: string[]): Promise<void> {
  if (tokens.length === 0) {
    return;
  }
  await prisma.userDevice.deleteMany({ where: { deviceToken: { in: tokens } } });
}
