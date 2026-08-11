/*
  Warnings:

  - Changed the type of `document_type` on the `user_documents` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "user_document_type" AS ENUM ('DRIVING_LICENSE');

-- CreateEnum
CREATE TYPE "driver_license_status" AS ENUM ('NONE', 'PENDING', 'VERIFIED', 'REJECTED');

-- AlterTable
ALTER TABLE "user_documents" DROP COLUMN "document_type",
ADD COLUMN     "document_type" "user_document_type" NOT NULL;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "driver_license_rejection_reason" TEXT,
ADD COLUMN     "driver_license_status" "driver_license_status" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "driver_license_verified_at" TIMESTAMPTZ(3),
ADD COLUMN     "driver_license_verified_by" UUID;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_driver_license_verified_by_fkey" FOREIGN KEY ("driver_license_verified_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
