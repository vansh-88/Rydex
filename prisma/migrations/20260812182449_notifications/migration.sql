-- CreateEnum
CREATE TYPE "device_platform" AS ENUM ('IOS', 'ANDROID', 'WEB');

-- CreateEnum
CREATE TYPE "notification_type" AS ENUM ('RIDE_BOOKED', 'BOOKING_CONFIRMED', 'BOOKING_CANCELLED', 'RIDE_CANCELLED', 'RIDE_STARTING', 'RIDE_COMPLETED', 'PAYMENT_SUCCESS', 'PAYMENT_FAILED', 'REFUND_PROCESSED');

-- claude.md §16/§97: this migration has nothing to do with rides' spatial
-- indexes — Prisma's diff engine proposed dropping them again (same
-- recurring cause as the 20260812171513 fix: `rides.origin`/`destination`
-- are `Unsupported(...)` columns, so their hand-written GiST indexes are
-- invisible to schema.prisma and get flagged as "unknown" on every
-- migration). Removed. See claude.md §97 for the standing process note this
-- prompted: always run `prisma migrate dev --create-only` and strip any
-- `DROP INDEX "rides_origin_gist"`/`"rides_destination_gist"` before
-- applying, for as long as these columns stay `Unsupported`.

-- CreateTable
CREATE TABLE "user_devices" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "device_token" TEXT NOT NULL,
    "platform" "device_platform" NOT NULL,
    "last_seen_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "user_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "notification_type" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "data" JSONB,
    "read_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_devices_device_token_key" ON "user_devices"("device_token");

-- CreateIndex
CREATE INDEX "user_devices_user_id_idx" ON "user_devices"("user_id");

-- CreateIndex
CREATE INDEX "notifications_user_id_created_at_idx" ON "notifications"("user_id", "created_at");

-- AddForeignKey
ALTER TABLE "user_devices" ADD CONSTRAINT "user_devices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
