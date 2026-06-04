import { describe, expect, it } from 'vitest';
import {
  buildEvidenceBundle,
  buildEvidenceCaseNarrative,
  buildEvidenceCenterModel,
} from './evidence-center';
import { buildEvidenceReportHtml } from './evidence-report';
import type { SecuritySummary } from '@/features/audit/audit.types';
import type { RetentionEvidenceResult } from '@/features/retention/retention.types';

function securitySummary(): SecuritySummary {
  return {
    chain: { valid: true, checked: 42 },
    totals: {
      deniedEvents: 3,
      malwareBlocked: 1,
      dlpDetections: 2,
      downloadDenied: 4,
    },
    repeatedDenyActors: [],
    riskyDocuments: [],
    behaviorSignals: [],
    recommendations: [
      {
        id: 'document-access-review:doc-secret',
        type: 'DOCUMENT_ACCESS_REVIEW',
        severity: 'critical',
        title: 'Review <script>alert("x")</script> document',
        reason: 'Document doc-secret reached risk score 95.',
        recommendedAction: 'Review ACLs and recent grants.',
        evidence: ['SECRET classification'],
        affectedDocumentIds: ['doc-secret'],
        affectedActorIds: [],
        auditFilters: { documentId: 'doc-secret' },
        workflow: { status: 'OPEN' },
      },
    ],
  };
}

function retentionEvidence(): RetentionEvidenceResult {
  return {
    checkedAt: '2026-06-02T08:00:00.000Z',
    summary: {
      tracked: 1,
      active: 0,
      dueSoon: 1,
      overdue: 0,
      archived: 0,
    },
    records: [
      {
        docId: 'doc-secret',
        title: 'Secret <b>Plan</b>',
        status: 'PUBLISHED',
        classification: 'SECRET',
        publishedAt: '2026-05-01T08:00:00.000Z',
        archivedAt: null,
        retentionClass: 'SECRET_7Y',
        retentionUntil: '2033-05-01T08:00:00.000Z',
        retentionReason: 'Secret retention policy',
        retentionStatus: 'DUE_SOON',
        daysRemaining: 5,
      },
    ],
  };
}

describe('buildEvidenceReportHtml', () => {
  it('builds a printable metadata-only report and escapes user-controlled text', () => {
    const model = buildEvidenceCenterModel({
      securitySummary: securitySummary(),
      retentionEvidence: retentionEvidence(),
      generatedAt: '2026-06-02T09:00:00.000Z',
    });
    const bundle = buildEvidenceBundle(model, {
      selectedRecommendationIds: ['document-access-review:doc-secret'],
      selectedDocumentIds: ['doc-secret'],
      generatedAt: '2026-06-02T09:30:00.000Z',
    });
    const narrative = buildEvidenceCaseNarrative(bundle);

    const html = buildEvidenceReportHtml(bundle, narrative);

    expect(html).toContain('<!doctype html>');
    expect(html).toContain('DOCVAULT-EVIDENCE-BUNDLE-20260602093000');
    expect(html).toContain('Metadata-only report');
    expect(html).toContain('Audit chain valid');
    expect(html).toContain('Evidence Packet Sections');
    expect(html).toContain('Visual Timeline');
    expect(html).toContain('<h3>Metadata</h3>');
    expect(html).toContain('<h3>Workflow</h3>');
    expect(html).toContain('<h3>Retention</h3>');
    expect(html).toContain('<h3>Audit</h3>');
    expect(html).toContain('docvault-evidence-secret-b-plan-b.json');
    expect(html).toContain('Review &lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; document');
    expect(html).toContain('Secret &lt;b&gt;Plan&lt;/b&gt;');
    expect(html).not.toContain('<script>alert("x")</script>');
    expect(html).not.toContain('<b>Plan</b>');
    expect(html).not.toContain('documents/doc-secret/v1/secret.pdf');
    expect(html).not.toContain('grant-token');
    expect(html).not.toContain('download-token');
    expect(html).not.toContain('https://storage.example/secret.pdf');
    expect(html).not.toContain('classified bytes');
  });
});
