-- Document share links (internal, authenticated, time-limited)
CREATE TYPE "DocumentSharePermission" AS ENUM ('VIEW', 'DOWNLOAD');

CREATE TABLE "document_share_links" (
  "id" TEXT NOT NULL,
  "docId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "permission" "DocumentSharePermission" NOT NULL DEFAULT 'VIEW',
  "createdBy" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "maxAccessCount" INTEGER,
  "accessCount" INTEGER NOT NULL DEFAULT 0,
  "lastAccessedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "revokedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "document_share_links_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "document_share_links_tokenHash_key" ON "document_share_links"("tokenHash");
CREATE INDEX "document_share_links_docId_createdAt_idx" ON "document_share_links"("docId", "createdAt");
CREATE INDEX "document_share_links_expiresAt_idx" ON "document_share_links"("expiresAt");

ALTER TABLE "document_share_links" ADD CONSTRAINT "document_share_links_docId_fkey" FOREIGN KEY ("docId") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
