-- Multi-tenancy: organizations + memberships, and organizationId on org-scoped tables.

-- 1. Enum for membership role
CREATE TYPE "OrganizationRole" AS ENUM ('MEMBER', 'ADMIN');

-- 2. Organizations
CREATE TABLE "organizations" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");
CREATE INDEX "organizations_ownerId_idx" ON "organizations"("ownerId");

-- 3. Memberships
CREATE TABLE "organization_memberships" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" "OrganizationRole" NOT NULL DEFAULT 'MEMBER',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "organization_memberships_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "organization_memberships_organizationId_userId_key" ON "organization_memberships"("organizationId", "userId");
CREATE INDEX "organization_memberships_userId_idx" ON "organization_memberships"("userId");

ALTER TABLE "organization_memberships"
  ADD CONSTRAINT "organization_memberships_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 4. Add organizationId columns (nullable first, for backfill)
ALTER TABLE "documents" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "document_saved_views" ADD COLUMN "organizationId" TEXT;

-- 5. Backfill: create a default organization owned by existing document owners.
--    All pre-existing data is assigned to this single default org so the
--    NOT NULL constraint can be applied safely.
INSERT INTO "organizations" ("id", "name", "slug", "ownerId", "createdAt", "updatedAt")
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Default Organization',
  'default',
  COALESCE((SELECT "ownerId" FROM "documents" ORDER BY "createdAt" ASC LIMIT 1), 'system'),
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);

-- Make every distinct existing document owner a member of the default org.
INSERT INTO "organization_memberships" ("id", "organizationId", "userId", "role", "createdAt")
SELECT gen_random_uuid(), '00000000-0000-0000-0000-000000000001', "ownerId", 'ADMIN', CURRENT_TIMESTAMP
FROM (SELECT DISTINCT "ownerId" FROM "documents") AS owners
ON CONFLICT ("organizationId", "userId") DO NOTHING;

-- Also enroll any saved-view owners not already enrolled.
INSERT INTO "organization_memberships" ("id", "organizationId", "userId", "role", "createdAt")
SELECT gen_random_uuid(), '00000000-0000-0000-0000-000000000001', "ownerId", 'MEMBER', CURRENT_TIMESTAMP
FROM (SELECT DISTINCT "ownerId" FROM "document_saved_views") AS sv_owners
ON CONFLICT ("organizationId", "userId") DO NOTHING;

UPDATE "documents" SET "organizationId" = '00000000-0000-0000-0000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "document_saved_views" SET "organizationId" = '00000000-0000-0000-0000-000000000001' WHERE "organizationId" IS NULL;

-- 6. Enforce NOT NULL now that data is backfilled
ALTER TABLE "documents" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "document_saved_views" ALTER COLUMN "organizationId" SET NOT NULL;

-- 7. Indexes for org-scoped queries
CREATE INDEX "documents_organizationId_idx" ON "documents"("organizationId");
CREATE INDEX "documents_organizationId_status_idx" ON "documents"("organizationId", "status");
CREATE INDEX "document_saved_views_organizationId_scope_idx" ON "document_saved_views"("organizationId", "scope");
