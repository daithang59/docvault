CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS "documents" (
  "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  "title" text NOT NULL,
  "description" text,
  "ownerId" text NOT NULL,
  "classification" text NOT NULL DEFAULT 'INTERNAL',
  "status" text NOT NULL DEFAULT 'DRAFT',
  "currentVersion" integer NOT NULL DEFAULT 0,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "document_versions" (
  "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  "docId" uuid NOT NULL REFERENCES "documents"("id") ON DELETE CASCADE,
  "version" integer NOT NULL,
  "objectKey" text NOT NULL,
  "checksum" text NOT NULL,
  "size" integer NOT NULL,
  "filename" text NOT NULL,
  "contentType" text,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "createdBy" text NOT NULL,
  UNIQUE ("docId", "version")
);

CREATE TABLE IF NOT EXISTS "document_acl" (
  "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  "docId" uuid NOT NULL REFERENCES "documents"("id") ON DELETE CASCADE,
  "subjectType" text NOT NULL,
  "subjectId" text,
  "permission" text NOT NULL,
  "effect" text NOT NULL
);

CREATE INDEX IF NOT EXISTS "documents_ownerId_idx" ON "documents" ("ownerId");
CREATE INDEX IF NOT EXISTS "documents_status_idx" ON "documents" ("status");
CREATE INDEX IF NOT EXISTS "document_versions_docId_createdAt_idx"
  ON "document_versions" ("docId", "createdAt");
CREATE INDEX IF NOT EXISTS "document_acl_docId_permission_idx"
  ON "document_acl" ("docId", "permission");
CREATE INDEX IF NOT EXISTS "document_acl_subjectType_subjectId_idx"
  ON "document_acl" ("subjectType", "subjectId");
