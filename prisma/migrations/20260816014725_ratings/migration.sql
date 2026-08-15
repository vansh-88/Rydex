-- Ratings: bidirectional, role-scoped reputation.
--
-- HAND-CORRECTED from `prisma migrate diff` output. Two corrections were
-- required; do not regenerate this file blindly.
--
-- 1. Prisma emitted `DROP INDEX "rides_origin_gist"` and
--    `DROP INDEX "rides_destination_gist"`. Both were removed. `rides.origin`
--    and `rides.destination` are `Unsupported("geography(Point,4326)")`, so
--    Prisma's diff engine has no record their GiST indexes should exist and
--    reconciles them away on ANY migration — this one does not touch `rides`
--    at all. Dropping them silently degrades ride search to a sequential scan.
--    This is the third occurrence; see steps.md §21.
--
-- 2. Prisma emitted `DROP COLUMN rating_average` / `DROP COLUMN rating_count`
--    followed by four `ADD COLUMN`s, because it cannot infer a rename. Rewritten
--    as `RENAME COLUMN` so the migration is non-destructive on principle rather
--    than by luck (the columns happen to be empty today; a rename keeps that
--    irrelevant).

-- CreateEnum
CREATE TYPE "rating_role" AS ENUM ('DRIVER', 'PASSENGER');

-- AlterTable: existing reputation becomes the driver-scoped pair, and the
-- passenger-scoped pair is added alongside it.
ALTER TABLE "users" RENAME COLUMN "rating_average" TO "driver_rating_average";
ALTER TABLE "users" RENAME COLUMN "rating_count" TO "driver_rating_count";

ALTER TABLE "users" ADD COLUMN "passenger_rating_average" DECIMAL(3,2),
                    ADD COLUMN "passenger_rating_count" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "ratings" (
    "id" UUID NOT NULL,
    "ride_id" UUID NOT NULL,
    "booking_id" UUID NOT NULL,
    "rater_id" UUID NOT NULL,
    "ratee_id" UUID NOT NULL,
    "ratee_role" "rating_role" NOT NULL,
    "score" INTEGER NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ratings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ratings_ratee_id_ratee_role_idx" ON "ratings"("ratee_id", "ratee_role");

-- CreateIndex
-- Load-bearing, not merely an index: this is what makes double-rating
-- impossible, and it is the database that arbitrates two concurrent
-- submissions rather than an application pre-check that would race.
CREATE UNIQUE INDEX "ratings_booking_id_rater_id_key" ON "ratings"("booking_id", "rater_id");

-- AddForeignKey
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_ride_id_fkey" FOREIGN KEY ("ride_id") REFERENCES "rides"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_rater_id_fkey" FOREIGN KEY ("rater_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_ratee_id_fkey" FOREIGN KEY ("ratee_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Defensive: re-assert the spatial indexes this migration must never remove.
-- If a future regenerate slips a DROP INDEX past review, these restore them.
CREATE INDEX IF NOT EXISTS "rides_origin_gist" ON "rides" USING GIST ("origin");
CREATE INDEX IF NOT EXISTS "rides_destination_gist" ON "rides" USING GIST ("destination");
