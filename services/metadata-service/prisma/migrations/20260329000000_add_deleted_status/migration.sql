-- Add DELETED to DocumentStatus enum
ALTER TYPE "DocumentStatus" ADD VALUE IF NOT EXISTS 'DELETED';

-- Add DELETE to WorkflowAction enum
ALTER TYPE "WorkflowAction" ADD VALUE IF NOT EXISTS 'DELETE';
