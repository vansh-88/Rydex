-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "final_payment_order_id" TEXT;

-- claude.md §16: origin/destination are `Unsupported(...)` in schema.prisma
-- (no native Prisma geography type), so Prisma's migration-diff engine has
-- no record of these hand-written GiST indexes from migration
-- 20260812123854_ride_creation and generated DROP INDEX statements for both
-- when this migration was first created, reconciling them away as
-- "unknown". Removed those DROP INDEXes. `IF NOT EXISTS` (not a plain
-- CREATE INDEX) matters here: on a fresh database (shadow DB, a new
-- environment), migration 20260812123854 already created both indexes
-- earlier in the same replay — a plain CREATE INDEX here would collide with
-- that. On the dev DB this was first fixed against, the indexes had
-- actually been dropped by the erroneous statements above, so this creates
-- them for real there. Either way, this migration's net effect is only the
-- bookings column above.
CREATE INDEX IF NOT EXISTS "rides_origin_gist" ON "rides" USING GIST ("origin");

CREATE INDEX IF NOT EXISTS "rides_destination_gist" ON "rides" USING GIST ("destination");
