-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "document_metadata" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "ownerId" TEXT NOT NULL,
    "filename" TEXT,
    "contentType" TEXT,
    "objectKey" TEXT,
    "status" "DocumentStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_metadata_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "document_metadata_objectKey_key" ON "document_metadata"("objectKey");

-- CreateIndex
CREATE INDEX "document_metadata_ownerId_idx" ON "document_metadata"("ownerId");

-- CreateIndex
CREATE INDEX "document_metadata_status_idx" ON "document_metadata"("status");
