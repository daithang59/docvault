import { describe, expect, it } from 'vitest';
import { buildSystemReadinessModel } from './system-readiness';

describe('buildSystemReadinessModel', () => {
  it('summarizes admin/product readiness from session roles and runtime config', () => {
    const model = buildSystemReadinessModel({
      user: {
        username: 'admin1',
        sub: 'admin-sub',
        displayName: 'Admin One',
        roles: ['admin', 'compliance_officer'],
      },
      appName: 'DocVault',
      apiBaseUrl: 'http://localhost:3000/api',
    });

    expect(model.score).toBe(100);
    expect(model.cards).toEqual([
      expect.objectContaining({
        key: 'session',
        label: 'Session',
        state: 'ready',
        value: 'Authenticated',
      }),
      expect.objectContaining({
        key: 'role-coverage',
        label: 'Role coverage',
        state: 'ready',
        value: '2 roles',
      }),
      expect.objectContaining({
        key: 'gateway',
        label: 'API gateway',
        state: 'ready',
        value: 'Configured',
      }),
      expect.objectContaining({
        key: 'evidence-export',
        label: 'Evidence export',
        state: 'ready',
        value: 'Available',
      }),
    ]);
    expect(model.capabilities.map((item) => item.label)).toEqual([
      'Create, upload, and submit documents',
      'Approve or reject review items',
      'Export metadata-only evidence packets',
      'Manage ACLs and application readiness',
    ]);
  });

  it('marks evidence export as blocked for users without compliance access', () => {
    const model = buildSystemReadinessModel({
      user: {
        username: 'viewer1',
        sub: 'viewer-sub',
        roles: ['viewer'],
      },
      appName: 'DocVault',
      apiBaseUrl: '',
    });

    expect(model.score).toBe(50);
    expect(model.cards.find((card) => card.key === 'gateway')).toMatchObject({
      state: 'attention',
      value: 'Missing URL',
    });
    expect(model.cards.find((card) => card.key === 'evidence-export')).toMatchObject({
      state: 'blocked',
      value: 'Role required',
    });
  });
});
