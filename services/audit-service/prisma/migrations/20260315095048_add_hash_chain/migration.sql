/*
  Warnings:

  - The primary key for the `audit_events` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - Added the required column `hash` to the `audit_events` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "audit_events" DROP CONSTRAINT "audit_events_pkey",
ADD COLUMN     "hash" TEXT NOT NULL,
ADD COLUMN     "prevHash" TEXT,
ALTER COLUMN "eventId" DROP DEFAULT,
ALTER COLUMN "eventId" SET DATA TYPE TEXT,
ALTER COLUMN "timestamp" SET DATA TYPE TIMESTAMP(3),
ADD CONSTRAINT "audit_events_pkey" PRIMARY KEY ("eventId");

-- RenameIndex
ALTER INDEX "audit_events_resource_idx" RENAME TO "audit_events_resourceType_resourceId_idx";
