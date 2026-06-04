export type DemoEvidenceTargetKey =
  | 'document-workbench'
  | 'document-detail'
  | 'approval-readiness'
  | 'notification-work-queue'
  | 'security-posture'
  | 'evidence-center'
  | 'retention-records';

export type DemoEvidenceState = 'ready' | 'capture';

export interface DemoEvidenceTarget {
  key: DemoEvidenceTargetKey;
  title: string;
  route: string;
  role: string;
  state: DemoEvidenceState;
  purpose: string;
  evidence: string[];
  reportCallout: string;
}

export interface DemoEvidenceStep {
  sequence: number;
  title: string;
  route: string;
  role: string;
  outcome: string;
  captureKeys: DemoEvidenceTargetKey[];
}

export interface DemoEvidenceKitSummary {
  requiredCaptures: number;
  readyCaptures: number;
  demoSteps: number;
  routeCount: number;
}

export interface DemoEvidenceKitModel {
  generatedAt: string;
  scopeLabel: string;
  scopeNote: string;
  outOfScope: string[];
  summary: DemoEvidenceKitSummary;
  captureTargets: DemoEvidenceTarget[];
  demoSteps: DemoEvidenceStep[];
}

export function buildDemoEvidenceKit({
  generatedAt = new Date().toISOString(),
}: {
  generatedAt?: string;
} = {}): DemoEvidenceKitModel {
  const captureTargets: DemoEvidenceTarget[] = [
    {
      key: 'document-workbench',
      title: 'Document smart workbench',
      route: '/documents?view=needs-action',
      role: 'editor/admin',
      state: 'ready',
      purpose:
        'Show commercial document discovery with quick views, active chips, filters, and URL state.',
      evidence: [
        'Quick views with counts',
        'Owner/tag/status/classification filters',
        'Active chips and reset action',
        'Stable URL query state',
      ],
      reportCallout:
        'DocVault is no longer a basic upload list; it has an operational workbench for repeated document review.',
    },
    {
      key: 'document-detail',
      title: 'Document detail posture',
      route: '/documents/:id',
      role: 'editor/approver/compliance/admin',
      state: 'ready',
      purpose:
        'Show metadata summary, preview posture, policy denial reason, and evidence links without content leakage.',
      evidence: [
        'Metadata summary',
        'Version preview/download posture',
        'Compliance Officer denial reason',
        'Evidence links to Audit/Evidence/Retention/Security',
      ],
      reportCallout:
        'Document inspection explains policy and evidence posture without exposing object keys or grant tokens.',
    },
    {
      key: 'approval-readiness',
      title: 'Approval readiness',
      route: '/approvals',
      role: 'approver/admin',
      state: 'ready',
      purpose:
        'Show that approval is supported by assignment, SLA status, and readiness criteria, not only approve/reject buttons.',
      evidence: [
        'Assignment lane and SLA status',
        'Overdue/due-soon/on-time summary',
        'Readiness checklist in review drawer',
        'Attention reasons for missing metadata/DLP/retention',
        'Reject reason presets',
        'Workflow history context',
      ],
      reportCallout:
        'Approvers get runtime SLA triage and readiness aid before approving, while backend assignment locking remains future work.',
    },
    {
      key: 'notification-work-queue',
      title: 'Notification work queue',
      route: '/notifications',
      role: 'any authenticated role',
      state: 'ready',
      purpose:
        'Show actionable work queues for approval, document, retention, and security events.',
      evidence: [
        'Summary cards',
        'Group filters',
        'Read/unread filters',
        'Target links back to workflows',
      ],
      reportCallout:
        'Notifications are presented as a web runtime work queue, not a DevSecOps alerting pipeline.',
    },
    {
      key: 'security-posture',
      title: 'Security posture',
      route: '/security',
      role: 'compliance/admin',
      state: 'ready',
      purpose:
        'Show deterministic security intelligence from audit metadata, DLP, malware and access-deny signals.',
      evidence: [
        'Audit-chain posture',
        'Risk scoring and anomalies',
        'Recommendation playbook with SLA',
        'Recommendation evidence packet',
      ],
      reportCallout:
        'The security dashboard provides AI-ready deterministic intelligence without reading file content.',
    },
    {
      key: 'evidence-center',
      title: 'Evidence Center',
      route: '/evidence',
      role: 'compliance/admin',
      state: 'ready',
      purpose:
        'Show metadata-only compliance evidence bundling and printable case presentation.',
      evidence: [
        'Source cards',
        'Bundle manifest export',
        'Printable evidence report',
        'Case presentation readiness',
      ],
      reportCallout:
        'Evidence Center turns runtime controls into an audit-friendly package with excluded sensitive fields.',
    },
    {
      key: 'retention-records',
      title: 'Retention records',
      route: '/retention',
      role: 'compliance/admin',
      state: 'ready',
      purpose:
        'Show records lifecycle posture by classification, due dates, archived records, and audit evidence.',
      evidence: [
        'Tracked/due-soon/overdue counters',
        'Retention class and deadline',
        'Archived records',
        'Retention audit event path',
      ],
      reportCallout:
        'DocVault includes records-management evidence instead of stopping at document CRUD.',
    },
  ];

  const demoSteps: DemoEvidenceStep[] = [
    {
      sequence: 1,
      title: 'Open Demo Kit and state scope',
      route: '/demo-kit',
      role: 'admin/compliance',
      outcome:
        'Presenter explains this is Web/runtime evidence only and DevSecOps is intentionally out of scope.',
      captureKeys: [],
    },
    {
      sequence: 2,
      title: 'Show document workbench and detail posture',
      route: '/documents?view=needs-action',
      role: 'editor/admin',
      outcome:
        'Audience sees quick views, filters, metadata summary, preview posture, and evidence links.',
      captureKeys: ['document-workbench', 'document-detail'],
    },
    {
      sequence: 3,
      title: 'Review approval readiness',
      route: '/approvals',
      role: 'approver/admin',
      outcome:
        'Approver checks assignment lane, SLA state, readiness, workflow history, and reject reason presets.',
      captureKeys: ['approval-readiness'],
    },
    {
      sequence: 4,
      title: 'Follow runtime work queues',
      route: '/notifications',
      role: 'any authenticated role',
      outcome:
        'Notification Center links approval, security, retention, and document events to target workflows.',
      captureKeys: ['notification-work-queue'],
    },
    {
      sequence: 5,
      title: 'Package compliance evidence',
      route: '/evidence',
      role: 'compliance/admin',
      outcome:
        'Compliance user exports metadata-only manifest/report and presents audit case readiness.',
      captureKeys: ['security-posture', 'evidence-center', 'retention-records'],
    },
  ];

  return {
    generatedAt,
    scopeLabel: 'Web runtime evidence',
    scopeNote:
      'Metadata/content-safe capture plan for advisor demo and report screenshots.',
    outOfScope: [
      'DevSecOps pipeline evidence',
      'Production approval lock/state-machine enforcement',
      'LLM content summarization or content Q&A',
    ],
    summary: {
      requiredCaptures: captureTargets.length,
      readyCaptures: captureTargets.filter((item) => item.state === 'ready')
        .length,
      demoSteps: demoSteps.length,
      routeCount: new Set([
        ...captureTargets.map((item) => item.route),
        ...demoSteps.map((item) => item.route),
      ]).size,
    },
    captureTargets,
    demoSteps,
  };
}

export function buildDemoEvidenceKitMarkdown(
  model: DemoEvidenceKitModel,
): string {
  const lines = [
    '# DocVault Web Runtime Evidence Kit',
    '',
    `Generated at: ${model.generatedAt}`,
    '',
    `Scope: ${model.scopeLabel}`,
    '',
    model.scopeNote,
    '',
    '## Capture Targets',
    '',
    ...model.captureTargets.flatMap((target) => [
      `- ${target.title} (${target.route})`,
      `  - Role: ${target.role}`,
      `  - Evidence: ${target.evidence.join('; ')}`,
      `  - Report note: ${target.reportCallout}`,
    ]),
    '',
    '## Presenter Flow',
    '',
    ...model.demoSteps.map(
      (step) =>
        `${step.sequence}. ${step.title} - ${step.route} - ${step.outcome}`,
    ),
    '',
    '## Out Of Scope',
    '',
    ...model.outOfScope.map((item) => `- Out of scope: ${item}`),
  ];

  return lines.join('\n');
}
