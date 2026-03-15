-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('DOCUMENT_CREATED', 'DOCUMENT_UPLOADED', 'DOCUMENT_SUBMITTED', 'DOCUMENT_APPROVED', 'DOCUMENT_REJECTED', 'DOCUMENT_ARCHIVED', 'DOCUMENT_DOWNLOAD_URL_ISSUED', 'DOCUMENT_DOWNLOADED');

-- CreateTable
CREATE TABLE "audit_log" (
    "id" TEXT NOT NULL,
    "documentId" TEXT,
    "actorId" TEXT NOT NULL,
    "actorRole" TEXT,
    "action" "AuditAction" NOT NULL,
    "fromStatus" "DocumentStatus",
    "toStatus" "DocumentStatus",
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audit_log_documentId_idx" ON "audit_log"("documentId");

-- CreateIndex
CREATE INDEX "audit_log_actorId_idx" ON "audit_log"("actorId");

-- CreateIndex
CREATE INDEX "audit_log_action_idx" ON "audit_log"("action");

-- CreateIndex
CREATE INDEX "audit_log_createdAt_idx" ON "audit_log"("createdAt");

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "document_metadata"("id") ON DELETE SET NULL ON UPDATE CASCADE;
