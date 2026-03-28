-- AlterEnum
ALTER TYPE "WorkflowAction" ADD VALUE 'RETENTION';

-- CreateTable
CREATE TABLE "document_comments" (
    "id" TEXT NOT NULL,
    "docId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_comments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "document_comments_docId_createdAt_idx" ON "document_comments"("docId", "createdAt");

-- AddForeignKey
ALTER TABLE "document_comments" ADD CONSTRAINT "document_comments_docId_fkey" FOREIGN KEY ("docId") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
