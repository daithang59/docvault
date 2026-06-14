import { describe, expect, it } from 'vitest';
import { buildDocumentSavedViewOptions } from './document-saved-views';
import {
  buildDocumentCommandCenter,
  filterDocumentQuickViewsByAnalyticsVisibility,
  filterDocumentSavedViewsByAnalyticsVisibility,
  filterDocumentSearchSuggestionsByAnalyticsVisibility,
} from './document-command-center';
import {
  buildDocumentQuickViewOptions,
  buildDocumentSearchSuggestions,
} from './document-filter-model';
import type { DocumentListItem } from './documents.types';
import type { AnalyticsVisibility } from '@/lib/auth/permissions';

const now = new Date('2026-06-13T09:00:00.000Z');
const elevatedAnalytics: AnalyticsVisibility = {
  canViewApprovalAggregates: true,
  canViewRetentionAggregates: true,
  canViewSecurityAggregates: true,
  canViewSensitiveDocumentAggregates: true,
};
const approverAnalytics: AnalyticsVisibility = {
  canViewApprovalAggregates: true,
  canViewRetentionAggregates: false,
  canViewSecurityAggregates: false,
  canViewSensitiveDocumentAggregates: false,
};

const documents: DocumentListItem[] = [
  {
    id: 'doc-pending-dlp',
    title: 'Incident Export',
    description: 'Security review package',
    status: 'PENDING',
    classification: 'SECRET',
    dlpStatus: 'DETECTED',
    retentionClass: 'SECRET_90D',
    retentionUntil: '2026-06-25T00:00:00.000Z',
    ownerId: 'editor-1',
    ownerDisplay: 'Editor One',
    currentVersion: 2,
    filename: 'incident.csv',
    tags: ['security'],
    createdAt: '2026-06-01T00:00:00.000Z',
    updatedAt: '2026-06-12T08:00:00.000Z',
  },
  {
    id: 'doc-draft',
    title: 'Policy Draft',
    status: 'DRAFT',
    classification: 'INTERNAL',
    ownerId: 'editor-2',
    currentVersion: 1,
    filename: 'policy.docx',
    tags: ['policy'],
    createdAt: '2026-06-02T00:00:00.000Z',
    updatedAt: '2026-06-11T08:00:00.000Z',
  },
  {
    id: 'doc-published',
    title: 'Library Index',
    status: 'PUBLISHED',
    classification: 'INTERNAL',
    dlpStatus: 'CLEAR',
    retentionClass: 'INTERNAL_365D',
    retentionUntil: '2026-12-01T00:00:00.000Z',
    ownerId: 'viewer-1',
    currentVersion: 1,
    filename: 'library.pdf',
    tags: ['library'],
    createdAt: '2026-05-01T00:00:00.000Z',
    updatedAt: '2026-06-10T08:00:00.000Z',
  },
  {
    id: 'doc-held',
    title: 'Legal Hold Archive',
    status: 'ARCHIVED',
    classification: 'CONFIDENTIAL',
    legalHold: true,
    ownerId: 'records-1',
    currentVersion: 3,
    filename: 'archive.pdf',
    tags: ['records'],
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-06-09T08:00:00.000Z',
  },
];

describe('buildDocumentCommandCenter', () => {
  it('builds document control summaries from lifecycle, classification, saved views, and attention cues', () => {
    const savedViews = buildDocumentSavedViewOptions(documents);
    const model = buildDocumentCommandCenter(documents, savedViews, {
      now,
      analyticsVisibility: elevatedAnalytics,
    });

    expect(model.controlGauge).toEqual({
      label: 'Control queue clear',
      value: 25,
      tone: 'critical',
      description: '1 of 4 documents have no active DLP, retention, legal hold, or lifecycle handoff cue.',
      href: '/documents',
    });
    expect(model.metrics).toEqual([
      expect.objectContaining({
        key: 'total-documents',
        label: 'Total documents',
        value: 4,
        href: '/documents',
        tone: 'info',
      }),
      expect.objectContaining({
        key: 'pending-review',
        label: 'Pending review',
        value: 1,
        href: '/documents?view=pending-review',
        tone: 'warning',
      }),
      expect.objectContaining({
        key: 'sensitive-documents',
        label: 'Sensitive',
        value: 2,
        href: '/documents?view=sensitive',
        tone: 'critical',
      }),
      expect.objectContaining({
        key: 'retention-due-soon',
        label: 'Retention due soon',
        value: 1,
        href: '/documents?q=retention%3Adue-soon',
        tone: 'warning',
      }),
    ]);
    expect(model.lifecycleSegments).toEqual([
      expect.objectContaining({ key: 'DRAFT', label: 'Draft', value: 1, percentage: 25 }),
      expect.objectContaining({ key: 'PENDING', label: 'Pending', value: 1, percentage: 25 }),
      expect.objectContaining({ key: 'PUBLISHED', label: 'Published', value: 1, percentage: 25 }),
      expect.objectContaining({ key: 'ARCHIVED', label: 'Archived', value: 1, percentage: 25 }),
      expect.objectContaining({ key: 'DELETED', label: 'Deleted', value: 0, percentage: 0 }),
    ]);
    expect(model.classificationSegments).toEqual([
      expect.objectContaining({ key: 'PUBLIC', label: 'Public', value: 0, percentage: 0 }),
      expect.objectContaining({ key: 'INTERNAL', label: 'Internal', value: 2, percentage: 50 }),
      expect.objectContaining({ key: 'CONFIDENTIAL', label: 'Confidential', value: 1, percentage: 25 }),
      expect.objectContaining({ key: 'SECRET', label: 'Secret', value: 1, percentage: 25 }),
    ]);
    expect(model.attentionSegments).toEqual([
      expect.objectContaining({
        key: 'dlp-detected',
        label: 'DLP detected',
        value: 1,
        percentage: 25,
        href: '/documents?q=dlp%3Adetected',
        tone: 'critical',
      }),
      expect.objectContaining({
        key: 'pending-review',
        label: 'Pending review',
        value: 1,
        percentage: 25,
        href: '/documents?view=pending-review',
        tone: 'warning',
      }),
      expect.objectContaining({
        key: 'retention-due-soon',
        label: 'Retention due soon',
        value: 1,
        percentage: 25,
        href: '/documents?q=retention%3Adue-soon',
        tone: 'warning',
      }),
      expect.objectContaining({
        key: 'legal-hold',
        label: 'Legal hold',
        value: 1,
        percentage: 25,
        href: '/documents?q=has%3Alegal-hold',
        tone: 'info',
      }),
      expect.objectContaining({
        key: 'draft-handoff',
        label: 'Draft handoff',
        value: 1,
        percentage: 25,
        href: '/documents?view=drafts',
        tone: 'info',
      }),
    ]);
    expect(model.savedViewSegments.map((segment) => segment.key)).toEqual([
      'saved-action-queue',
      'saved-sensitive-attention',
      'saved-pending-review',
      'saved-security-triage',
    ]);
    expect(model.savedViewSegments[0]).toEqual(
      expect.objectContaining({
        label: 'Action queue',
        value: 2,
        percentage: 50,
        href: '/documents?view=needs-action',
      }),
    );
  });

  it('returns stable empty summaries when there are no documents', () => {
    const model = buildDocumentCommandCenter([], [], {
      now,
      analyticsVisibility: elevatedAnalytics,
    });

    expect(model.controlGauge).toEqual({
      label: 'Control queue clear',
      value: 0,
      tone: 'info',
      description: 'No documents are available for control-center measurement.',
      href: '/documents',
    });
    expect(model.metrics.map((metric) => metric.value)).toEqual([0, 0, 0, 0]);
    expect(model.lifecycleSegments.every((segment) => segment.percentage === 0)).toBe(true);
    expect(model.classificationSegments.every((segment) => segment.percentage === 0)).toBe(true);
    expect(model.attentionSegments.every((segment) => segment.percentage === 0)).toBe(true);
    expect(model.savedViewSegments).toEqual([]);
  });

  it('keeps sensitive document aggregates hidden from approvers while preserving approval summaries', () => {
    const savedViews = buildDocumentSavedViewOptions(documents);
    const model = buildDocumentCommandCenter(documents, savedViews, {
      now,
      analyticsVisibility: approverAnalytics,
    });

    expect(model.metrics.map((metric) => metric.key)).toEqual([
      'total-documents',
      'pending-review',
    ]);
    expect(model.classificationSegments).toEqual([]);
    expect(model.attentionSegments.map((segment) => segment.key)).toEqual([
      'pending-review',
      'draft-handoff',
    ]);
    expect(model.savedViewSegments.map((segment) => segment.key)).not.toContain(
      'saved-sensitive-attention',
    );
    expect(model.savedViewSegments.map((segment) => segment.key)).not.toContain(
      'saved-confidential-library',
    );
    expect(model.savedViewSegments.map((segment) => segment.key)).toContain(
      'saved-pending-review',
    );
  });

  it('filters sensitive document filter controls with the same analytics visibility policy', () => {
    const quickViews = filterDocumentQuickViewsByAnalyticsVisibility(
      buildDocumentQuickViewOptions(documents),
      approverAnalytics,
    );
    const savedViews = filterDocumentSavedViewsByAnalyticsVisibility(
      buildDocumentSavedViewOptions(documents),
      approverAnalytics,
    );
    const suggestions = filterDocumentSearchSuggestionsByAnalyticsVisibility(
      buildDocumentSearchSuggestions(documents),
      approverAnalytics,
    );

    expect(quickViews.map((view) => view.value)).toContain('pending-review');
    expect(quickViews.map((view) => view.value)).not.toContain('sensitive');
    expect(savedViews.map((view) => view.id)).toContain('saved-pending-review');
    expect(savedViews.map((view) => view.id)).not.toContain('saved-sensitive-attention');
    expect(savedViews.map((view) => view.id)).not.toContain('saved-confidential-library');
    expect(suggestions.map((suggestion) => suggestion.token)).toContain('status:pending');
    expect(suggestions.map((suggestion) => suggestion.token)).not.toContain('class:confidential');
    expect(suggestions.map((suggestion) => suggestion.token)).not.toContain('dlp:detected');
    expect(suggestions.map((suggestion) => suggestion.token)).not.toContain('retention:due-soon');
    expect(suggestions.map((suggestion) => suggestion.token)).not.toContain('has:legal-hold');
  });
});
