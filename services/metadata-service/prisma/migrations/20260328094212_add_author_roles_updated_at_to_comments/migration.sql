-- Add authorRoles as nullable text array (roles will be empty for existing rows)
ALTER TABLE "document_comments" ADD COLUMN "authorRoles" TEXT[] DEFAULT '{}';

-- Add updatedAt as nullable first, then backfill with createdAt, then set NOT NULL
ALTER TABLE "document_comments" ADD COLUMN "updatedAt" TIMESTAMP(3);
UPDATE "document_comments" SET "updatedAt" = "createdAt";
ALTER TABLE "document_comments" ALTER COLUMN "updatedAt" SET NOT NULL;
ALTER TABLE "document_comments" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;
