/*
  Warnings:

  - The values [PENDING_APPROVAL,APPROVED,REJECTED] on the enum `DocumentStatus` will be removed. If these variants are still used in the database, this will fail.
  - The primary key for the `document_acl` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `document_versions` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `documents` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `classification` column on the `documents` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `status` column on the `documents` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the `audit_log` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `document_metadata` table. If the table is not empty, all the data it contains will be lost.
  - Changed the type of `subjectType` on the `document_acl` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `permission` on the `document_acl` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `effect` on the `document_acl` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "ClassificationLevel" AS ENUM ('PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'SECRET');

-- CreateEnum
CREATE TYPE "AclSubjectType" AS ENUM ('USER', 'ROLE', 'GROUP', 'ALL');

-- CreateEnum
CREATE TYPE "DocumentPermission" AS ENUM ('READ', 'DOWNLOAD', 'WRITE', 'APPROVE');

-- CreateEnum
CREATE TYPE "AclEffect" AS ENUM ('ALLOW', 'DENY');

-- CreateEnum
CREATE TYPE "WorkflowAction" AS ENUM ('SUBMIT', 'APPROVE', 'REJECT', 'ARCHIVE');

-- AlterEnum
BEGIN;
CREATE TYPE "DocumentStatus_new" AS ENUM ('DRAFT', 'PENDING', 'PUBLISHED', 'ARCHIVED');
ALTER TABLE "public"."document_metadata" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "documents" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "documents" ALTER COLUMN "status" TYPE "DocumentStatus_new" USING ("status"::text::"DocumentStatus_new");
ALTER TYPE "DocumentStatus" RENAME TO "DocumentStatus_old";
ALTER TYPE "DocumentStatus_new" RENAME TO "DocumentStatus";
DROP TYPE "public"."DocumentStatus_old" CASCADE;
COMMIT;

-- DropForeignKey
ALTER TABLE "audit_log" DROP CONSTRAINT "audit_log_documentId_fkey";

-- DropForeignKey
ALTER TABLE "document_acl" DROP CONSTRAINT "document_acl_docId_fkey";

-- DropForeignKey
ALTER TABLE "document_versions" DROP CONSTRAINT "document_versions_docId_fkey";

-- AlterTable
ALTER TABLE "document_acl" DROP CONSTRAINT "document_acl_pkey",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "docId" SET DATA TYPE TEXT,
DROP COLUMN "subjectType",
ADD COLUMN     "subjectType" "AclSubjectType" NOT NULL,
DROP COLUMN "permission",
ADD COLUMN     "permission" "DocumentPermission" NOT NULL,
DROP COLUMN "effect",
ADD COLUMN     "effect" "AclEffect" NOT NULL,
ADD CONSTRAINT "document_acl_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "document_versions" DROP CONSTRAINT "document_versions_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "docId" SET DATA TYPE TEXT,
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ADD CONSTRAINT "document_versions_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "documents" DROP CONSTRAINT "documents_pkey",
ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "publishedAt" TIMESTAMP(3),
ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
DROP COLUMN "classification",
ADD COLUMN     "classification" "ClassificationLevel" NOT NULL DEFAULT 'INTERNAL',
DROP COLUMN "status",
ADD COLUMN     "status" "DocumentStatus" NOT NULL DEFAULT 'DRAFT',
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updatedAt" DROP DEFAULT,
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3),
ADD CONSTRAINT "documents_pkey" PRIMARY KEY ("id");

-- DropTable
DROP TABLE "audit_log";

-- DropTable
DROP TABLE "document_metadata";

-- DropEnum
DROP TYPE "AuditAction";

-- CreateTable
CREATE TABLE "document_workflow_history" (
    "id" TEXT NOT NULL,
    "docId" TEXT NOT NULL,
    "fromStatus" "DocumentStatus" NOT NULL,
    "toStatus" "DocumentStatus" NOT NULL,
    "action" "WorkflowAction" NOT NULL,
    "actorId" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_workflow_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "document_workflow_history_docId_createdAt_idx" ON "document_workflow_history"("docId", "createdAt");

-- CreateIndex
CREATE INDEX "document_acl_docId_permission_idx" ON "document_acl"("docId", "permission");

-- CreateIndex
CREATE INDEX "document_acl_subjectType_subjectId_idx" ON "document_acl"("subjectType", "subjectId");

-- CreateIndex
CREATE INDEX "documents_status_idx" ON "documents"("status");

-- CreateIndex
CREATE INDEX "documents_tags_idx" ON "documents" USING GIN ("tags");

-- AddForeignKey
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_docId_fkey" FOREIGN KEY ("docId") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_acl" ADD CONSTRAINT "document_acl_docId_fkey" FOREIGN KEY ("docId") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_workflow_history" ADD CONSTRAINT "document_workflow_history_docId_fkey" FOREIGN KEY ("docId") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
