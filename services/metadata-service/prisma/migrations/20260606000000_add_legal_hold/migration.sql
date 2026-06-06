-- Add legal hold fields to documents
ALTER TABLE "documents" ADD COLUMN "legalHold" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "documents" ADD COLUMN "legalHoldReason" TEXT;
ALTER TABLE "documents" ADD COLUMN "legalHoldBy" TEXT;
ALTER TABLE "documents" ADD COLUMN "legalHoldAt" TIMESTAMP(3);

CREATE INDEX "documents_legalHold_idx" ON "documents"("legalHold");
