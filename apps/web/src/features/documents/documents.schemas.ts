import { z } from 'zod';
import { zNonEmptyString, zOptionalString } from '@/lib/validators/common';

export const CLASSIFICATION_OPTIONS = ['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'SECRET'] as const;

// ── Create document form schema ───────────────────────────────────────────────

export const createDocumentSchema = z.object({
  title: zNonEmptyString.max(255, 'Title must be at most 255 characters'),
  description: zOptionalString,
  classificationLevel: z.enum(CLASSIFICATION_OPTIONS).refine((v) => v !== undefined, {
    message: 'Classification level is required',
  }),
  tags: z.array(z.string().trim().min(1)).default([]),
});

export type CreateDocumentFormValues = z.infer<typeof createDocumentSchema>;

// ── Update document form schema ───────────────────────────────────────────────

export const updateDocumentSchema = createDocumentSchema.partial().extend({
  title: zNonEmptyString.max(255),
});

export type UpdateDocumentFormValues = z.infer<typeof updateDocumentSchema>;

// ── Workflow comment schema ───────────────────────────────────────────────────

export const workflowCommentSchema = z.object({
  comment: zOptionalString,
});

export type WorkflowCommentFormValues = z.infer<typeof workflowCommentSchema>;

// ── ACL entry form schema ─────────────────────────────────────────────────────

export const addAclEntrySchema = z.object({
  subjectType: z.enum(['USER', 'ROLE', 'GROUP']),
  subjectId: zNonEmptyString,
  permission: z.enum(['READ', 'WRITE', 'DELETE', 'APPROVE', 'AUDIT', 'SHARE']),
  effect: z.enum(['ALLOW', 'DENY']),
});

export type AddAclEntryFormValues = z.infer<typeof addAclEntrySchema>;
