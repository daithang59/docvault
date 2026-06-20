-- Sequential approval chain for documents
ALTER TABLE "documents" ADD COLUMN "approvalChain" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "documents" ADD COLUMN "approvalStep" INTEGER NOT NULL DEFAULT 0;
