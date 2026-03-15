-- AlterTable
ALTER TABLE "document_metadata" ADD COLUMN     "bucket" TEXT,
ADD COLUMN     "etag" TEXT,
ADD COLUMN     "sizeBytes" INTEGER;
