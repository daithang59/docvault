import { z } from 'zod';
import { zNonEmptyString, zOptionalString } from '@/lib/validators/common';

export const CLASSIFICATION_OPTIONS = ['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'SECRET'] as const;

// ── Create document form schema ───────────────────────────────────────────────

export const createDocumentSchema = z.object({
  title: zNonEmptyString.max(255, 'Title must be at most 255 characters'),
  description: zOptionalString,
  classification: z.enum(CLASSIFICATION_OPTIONS).refine((v) => v !== undefined, {
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
  reason: zOptionalString,
});

export type WorkflowCommentFormValues = z.infer<typeof workflowCommentSchema>;

// ── ACL entry form schema ─────────────────────────────────────────────────────

export const addAclEntrySchema = z.object({
  subjectType: z.enum(['USER', 'ROLE', 'GROUP', 'ALL']),
  subjectId: zOptionalString,
  permission: z.enum(['READ', 'DOWNLOAD', 'WRITE', 'APPROVE']),
  effect: z.enum(['ALLOW', 'DENY']),
}).refine((value) => value.subjectType === 'ALL' || Boolean(value.subjectId?.trim()), {
  message: 'Subject ID is required unless subject type is ALL',
  path: ['subjectId'],
});

export type AddAclEntryFormValues = z.infer<typeof addAclEntrySchema>;
