'use client';

import Link from 'next/link';
import {
  Camera,
  CheckCircle,
  ClipboardCheck,
  Copy,
  Download,
  ExternalLink,
  FileText,
  Route,
  ShieldCheck,
} from 'lucide-react';
import {
  buildDemoEvidenceKitMarkdown,
  type DemoEvidenceKitModel,
  type DemoEvidenceTarget,
} from '@/features/demo/demo-evidence-kit';

interface DemoEvidenceKitPanelProps {
  model: DemoEvidenceKitModel;
}

export function DemoEvidenceKitPanel({ model }: DemoEvidenceKitPanelProps) {
  const markdown = buildDemoEvidenceKitMarkdown(model);

  async function copyChecklist() {
    await navigator.clipboard.writeText(markdown);
  }

  function downloadMarkdown() {
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'docvault-web-runtime-evidence-kit.md';
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-3 md:grid-cols-4">
        <SummaryTile
          icon={ClipboardCheck}
          label="Capture targets"
          value={String(model.summary.requiredCaptures)}
        />
        <SummaryTile
          icon={CheckCircle}
          label="Ready items"
          value={String(model.summary.readyCaptures)}
        />
        <SummaryTile
          icon={Route}
          label="Presenter steps"
          value={String(model.summary.demoSteps)}
        />
        <SummaryTile
          icon={ShieldCheck}
          label="Scope"
          value="Web"
        />
      </section>

      <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase text-[var(--color-primary)]">
              {model.scopeLabel}
            </p>
            <h2 className="mt-1 text-lg font-semibold text-[var(--text-strong)]">
              Metadata/content-safe capture plan
            </h2>
            <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
              {model.scopeNote}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={copyChecklist}
              className="inline-flex items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-sm font-medium text-[var(--text-strong)] transition-colors hover:bg-[var(--surface-hover)]"
            >
              <Copy className="h-4 w-4" />
              Copy checklist
            </button>
            <button
              type="button"
              onClick={downloadMarkdown}
              className="inline-flex items-center gap-2 rounded-md bg-[var(--color-primary)] px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--color-primary-dark)]"
            >
              <Download className="h-4 w-4" />
              Download markdown
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-2 md:grid-cols-3">
          {model.outOfScope.map((item) => (
            <div
              key={item}
              className="rounded-md border border-dashed border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-xs text-[var(--text-muted)]"
            >
              Out of scope: {item}
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center gap-2">
          <Camera className="h-4 w-4 text-[var(--color-primary)]" />
          <h2 className="text-base font-semibold text-[var(--text-strong)]">
            Screenshot Targets
          </h2>
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          {model.captureTargets.map((target) => (
            <CaptureTargetCard key={target.key} target={target} />
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
        <div className="mb-4 flex items-center gap-2">
          <FileText className="h-4 w-4 text-[var(--color-primary)]" />
          <h2 className="text-base font-semibold text-[var(--text-strong)]">
            Presenter Flow
          </h2>
        </div>
        <ol className="space-y-3">
          {model.demoSteps.map((step) => (
            <li
              key={step.sequence}
              className="grid gap-3 rounded-md border border-[var(--border)] bg-[var(--surface-muted)] p-3 md:grid-cols-[3rem_minmax(0,1fr)_auto]"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-[var(--color-primary)]/10 text-sm font-semibold text-[var(--color-primary)]">
                {step.sequence}
              </div>
              <div>
                <p className="font-medium text-[var(--text-strong)]">
                  {step.title}
                </p>
                <p className="mt-1 text-sm leading-6 text-[var(--text-muted)]">
                  {step.outcome}
                </p>
                <p className="mt-2 text-xs text-[var(--text-muted)]">
                  Role: {step.role}
                </p>
              </div>
              <Link
                href={step.route}
                className="inline-flex items-center gap-2 self-start rounded-md border border-[var(--border)] px-3 py-2 text-sm font-medium text-[var(--text-strong)] transition-colors hover:bg-[var(--surface-hover)]"
              >
                Open
                <ExternalLink className="h-4 w-4" />
              </Link>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

function SummaryTile({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof ClipboardCheck;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <p className="text-xs text-[var(--text-muted)]">{label}</p>
          <p className="text-lg font-semibold text-[var(--text-strong)]">
            {value}
          </p>
        </div>
      </div>
    </div>
  );
}

function CaptureTargetCard({ target }: { target: DemoEvidenceTarget }) {
  return (
    <article className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[var(--text-strong)]">
            {target.title}
          </p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            {target.role}
          </p>
        </div>
        <Link
          href={target.route}
          className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] px-2 py-1 text-xs font-medium text-[var(--text-strong)] transition-colors hover:bg-[var(--surface-hover)]"
        >
          {target.route}
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </div>
      <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">
        {target.purpose}
      </p>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {target.evidence.map((item) => (
          <li
            key={item}
            className="flex items-start gap-2 text-sm text-[var(--text-strong)]"
          >
            <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
      <p className="mt-4 rounded-md bg-[var(--surface-muted)] px-3 py-2 text-xs leading-5 text-[var(--text-muted)]">
        {target.reportCallout}
      </p>
    </article>
  );
}
