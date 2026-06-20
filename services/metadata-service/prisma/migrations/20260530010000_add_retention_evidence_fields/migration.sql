-- Add explicit retention evidence fields for records-management demos.
ALTER TABLE "documents"
  ADD COLUMN "retentionClass" TEXT,
  ADD COLUMN "retentionUntil" TIMESTAMP(3),
  ADD COLUMN "retentionReason" TEXT;

-- Backfill published records so existing demo data has retention evidence.
UPDATE "documents"
SET
  "retentionClass" = CASE "classification"::text
    WHEN 'PUBLIC' THEN 'PUBLIC_730D'
    WHEN 'INTERNAL' THEN 'INTERNAL_365D'
    WHEN 'CONFIDENTIAL' THEN 'CONFIDENTIAL_180D'
    WHEN 'SECRET' THEN 'SECRET_30D'
    ELSE NULL
  END,
  "retentionUntil" = CASE "classification"::text
    WHEN 'PUBLIC' THEN "publishedAt" + INTERVAL '730 days'
    WHEN 'INTERNAL' THEN "publishedAt" + INTERVAL '365 days'
    WHEN 'CONFIDENTIAL' THEN "publishedAt" + INTERVAL '180 days'
    WHEN 'SECRET' THEN "publishedAt" + INTERVAL '30 days'
    ELSE NULL
  END,
  "retentionReason" = CASE "classification"::text
    WHEN 'PUBLIC' THEN 'PUBLIC records are retained for 730 days after publication'
    WHEN 'INTERNAL' THEN 'INTERNAL records are retained for 365 days after publication'
    WHEN 'CONFIDENTIAL' THEN 'CONFIDENTIAL records are retained for 180 days after publication'
    WHEN 'SECRET' THEN 'SECRET records are retained for 30 days after publication'
    ELSE NULL
  END
WHERE "publishedAt" IS NOT NULL
  AND "retentionClass" IS NULL;

CREATE INDEX "documents_retentionUntil_idx" ON "documents"("retentionUntil");
CREATE INDEX "documents_status_retentionUntil_idx" ON "documents"("status", "retentionUntil");
