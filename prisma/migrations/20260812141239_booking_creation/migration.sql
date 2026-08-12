-- CreateEnum
CREATE TYPE "booking_status" AS ENUM ('PENDING_PAYMENT', 'CONFIRMED', 'PAYMENT_FAILED', 'CANCELLED', 'COMPLETED');

-- Note: Prisma's migration diff tool wanted to DROP the rides GiST indexes
-- here — spurious. It can't see hand-added indexes on `Unsupported` columns
-- (claude.md §16/§77), so it thinks they're drift. Deliberately not
-- included; the indexes from migration 20260812123854_ride_creation stay.

-- CreateTable
CREATE TABLE "bookings" (
    "id" UUID NOT NULL,
    "ride_id" UUID NOT NULL,
    "passenger_id" UUID NOT NULL,
    "seat_count" INTEGER NOT NULL,
    "pickup_lat" DOUBLE PRECISION NOT NULL,
    "pickup_lng" DOUBLE PRECISION NOT NULL,
    "drop_lat" DOUBLE PRECISION NOT NULL,
    "drop_lng" DOUBLE PRECISION NOT NULL,
    "fare_per_seat" DECIMAL(10,2) NOT NULL,
    "total_fare" DECIMAL(10,2) NOT NULL,
    "prepaid_amount" DECIMAL(10,2) NOT NULL,
    "prepayment_order_id" TEXT,
    "status" "booking_status" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bookings_ride_id_idx" ON "bookings"("ride_id");

-- CreateIndex
CREATE INDEX "bookings_passenger_id_idx" ON "bookings"("passenger_id");

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_ride_id_fkey" FOREIGN KEY ("ride_id") REFERENCES "rides"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_passenger_id_fkey" FOREIGN KEY ("passenger_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
