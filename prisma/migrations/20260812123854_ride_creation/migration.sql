-- CreateEnum
CREATE TYPE "ride_status" AS ENUM ('PENDING_PAYMENT', 'OPEN', 'FULL', 'STARTED', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "rides" (
    "id" UUID NOT NULL,
    "driver_id" UUID NOT NULL,
    "vehicle_id" UUID NOT NULL,
    "origin" geography(Point,4326) NOT NULL,
    "destination" geography(Point,4326) NOT NULL,
    "origin_address" TEXT,
    "destination_address" TEXT,
    "departure_time" TIMESTAMPTZ(3) NOT NULL,
    "available_seats" INTEGER NOT NULL,
    "total_seats" INTEGER NOT NULL,
    "fare_per_seat" DECIMAL(10,2) NOT NULL,
    "distance_meters" INTEGER NOT NULL,
    "duration_seconds" INTEGER NOT NULL,
    "route_geometry" TEXT NOT NULL,
    "posting_commission_amount" DECIMAL(10,2) NOT NULL,
    "posting_commission_order_id" TEXT NOT NULL,
    "status" "ride_status" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "rides_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "rides_driver_id_idx" ON "rides"("driver_id");

-- CreateIndex
CREATE INDEX "rides_vehicle_id_idx" ON "rides"("vehicle_id");

-- CreateIndex
CREATE INDEX "rides_departure_time_status_idx" ON "rides"("departure_time", "status");

-- CreateIndex (claude.md §16 — spatial GiST indexes; not declarable via
-- Prisma's @@index on an Unsupported column, added by hand)
CREATE INDEX "rides_origin_gist" ON "rides" USING GIST ("origin");

-- CreateIndex
CREATE INDEX "rides_destination_gist" ON "rides" USING GIST ("destination");

-- AddForeignKey
ALTER TABLE "rides" ADD CONSTRAINT "rides_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rides" ADD CONSTRAINT "rides_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
