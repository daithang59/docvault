CREATE TYPE "DocumentSavedViewScope" AS ENUM ('PRIVATE', 'TEAM');

CREATE TABLE "document_saved_views" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "filters" JSONB NOT NULL,
  "scope" "DocumentSavedViewScope" NOT NULL DEFAULT 'PRIVATE',
  "ownerId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "document_saved_views_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "document_saved_views_ownerId_scope_idx" ON "document_saved_views"("ownerId", "scope");
CREATE INDEX "document_saved_views_scope_createdAt_idx" ON "document_saved_views"("scope", "createdAt");
