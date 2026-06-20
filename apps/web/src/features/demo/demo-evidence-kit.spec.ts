import { describe, expect, it } from 'vitest';
import {
  buildDemoEvidenceKit,
  buildDemoEvidenceKitMarkdown,
} from './demo-evidence-kit';

describe('buildDemoEvidenceKit', () => {
  it('builds a runtime web evidence kit without DevSecOps claims', () => {
    const model = buildDemoEvidenceKit({
      generatedAt: '2026-06-04T09:00:00.000Z',
    });

    expect(model.generatedAt).toBe('2026-06-04T09:00:00.000Z');
    expect(model.scopeLabel).toBe('Web runtime evidence');
    expect(model.outOfScope).toContain('DevSecOps pipeline evidence');
    expect(model.summary.requiredCaptures).toBeGreaterThan(5);
    expect(model.summary.readyCaptures).toBe(model.captureTargets.length);

    expect(model.captureTargets.map((item) => item.key)).toEqual([
      'document-workbench',
      'document-detail',
      'approval-readiness',
      'notification-work-queue',
      'security-posture',
      'evidence-center',
      'retention-records',
    ]);
  });

  it('prioritizes approval readiness and evidence routes for the presenter', () => {
    const model = buildDemoEvidenceKit({
      generatedAt: '2026-06-04T09:00:00.000Z',
    });

    const approval = model.captureTargets.find(
      (item) => item.key === 'approval-readiness',
    );
    const evidence = model.captureTargets.find(
      (item) => item.key === 'evidence-center',
    );

    expect(approval).toMatchObject({
      route: '/approvals',
      evidence: expect.arrayContaining([
        'Readiness checklist in review drawer',
        'Reject reason presets',
      ]),
    });
    expect(evidence?.route).toBe('/evidence');
    expect(model.demoSteps.some((step) => step.route === '/demo-kit')).toBe(true);
  });
});

describe('buildDemoEvidenceKitMarkdown', () => {
  it('exports a concise report checklist without content-bearing data', () => {
    const model = buildDemoEvidenceKit({
      generatedAt: '2026-06-04T09:00:00.000Z',
    });
    const markdown = buildDemoEvidenceKitMarkdown(model);

    expect(markdown).toContain('# DocVault Web Runtime Evidence Kit');
    expect(markdown).toContain('Metadata/content-safe capture plan');
    expect(markdown).toContain('/approvals');
    expect(markdown).toContain('Approval readiness');
    expect(markdown).toContain('Out of scope: DevSecOps pipeline evidence');
    expect(markdown).not.toContain('Jenkins');
    expect(markdown).not.toContain('Argo CD');
  });
});
