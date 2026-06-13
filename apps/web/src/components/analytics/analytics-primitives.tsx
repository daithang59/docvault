import type { ReactNode } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils/cn';

export type AnalyticsTone = 'info' | 'success' | 'warning' | 'critical';

export interface AnalyticsSegment {
  key: string;
  label: string;
  value: number;
  percentage: number;
  tone: AnalyticsTone;
  href?: string;
}

interface ScoreGaugeProps {
  label: string;
  value: number;
  tone: AnalyticsTone;
  description: string;
  href?: string;
  className?: string;
}

interface SegmentDonutProps {
  label: string;
  segments: AnalyticsSegment[];
  className?: string;
}

interface PriorityBarListProps {
  label: string;
  segments: AnalyticsSegment[];
  className?: string;
}

interface MetricTileProps {
  label: string;
  value: number | string;
  description: string;
  tone?: AnalyticsTone;
  icon?: ReactNode;
  href?: string;
  className?: string;
}

export function ScoreGauge({
  label,
  value,
  tone,
  description,
  href,
  className,
}: ScoreGaugeProps) {
  const clampedValue = clampPercentage(value);
  const content = (
    <>
      <div
        aria-label={`${label} score ${clampedValue} percent`}
        className="relative flex h-32 w-32 shrink-0 items-center justify-center rounded-full"
        role="img"
        style={{
          background: `conic-gradient(${toneColor(tone)} ${clampedValue * 3.6}deg, var(--bg-muted) 0deg)`,
        }}
      >
        <div className="absolute inset-3 rounded-full bg-[var(--bg-card)]" />
        <div className="relative text-center">
          <p className="text-3xl font-bold leading-none text-[var(--text-strong)]">
            {clampedValue}%
          </p>
          <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-faint)]">
            score
          </p>
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-[var(--text-strong)]">{label}</p>
        <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">{description}</p>
        {href ? (
          <p className="mt-3 text-xs font-semibold text-[var(--color-primary)]">
            Open details
          </p>
        ) : null}
      </div>
    </>
  );

  if (href) {
    return (
      <Link
        className={cn(
          'group flex min-w-0 items-center gap-5 rounded-lg border p-5 transition hover:bg-[var(--bg-card-hover)]',
          toneSurfaceClass(tone),
          className,
        )}
        href={href}
      >
        {content}
      </Link>
    );
  }

  return (
    <div
      className={cn(
        'flex min-w-0 items-center gap-5 rounded-lg border p-5',
        toneSurfaceClass(tone),
        className,
      )}
    >
      {content}
    </div>
  );
}

export function SegmentDonut({ label, segments, className }: SegmentDonutProps) {
  const summary = segments.map((segment) => `${segment.label} ${segment.value}`).join(', ');

  return (
    <div
      className={cn(
        'rounded-lg border border-[var(--border-soft)] bg-[var(--bg-card)] p-4',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-[var(--text-strong)]">{label}</p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            {segments.reduce((total, segment) => total + segment.value, 0)} total signals
          </p>
        </div>
        <div
          aria-label={`${label}: ${summary}`}
          className="relative h-20 w-20 shrink-0 rounded-full"
          role="img"
          style={{ background: buildConicGradient(segments) }}
        >
          <div className="absolute inset-4 rounded-full bg-[var(--bg-card)]" />
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {segments.map((segment) => (
          <SegmentLegendItem key={segment.key} segment={segment} />
        ))}
      </div>
    </div>
  );
}

export function PriorityBarList({ label, segments, className }: PriorityBarListProps) {
  return (
    <div
      className={cn(
        'rounded-lg border border-[var(--border-soft)] bg-[var(--bg-card)] p-4',
        className,
      )}
    >
      <p className="text-sm font-semibold text-[var(--text-strong)]">{label}</p>
      <div className="mt-4 space-y-3">
        {segments.map((segment) => (
          <SegmentBarItem
            key={segment.key}
            segment={segment}
          />
        ))}
      </div>
    </div>
  );
}

export function MetricTile({
  label,
  value,
  description,
  tone = 'info',
  icon,
  href,
  className,
}: MetricTileProps) {
  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
            {label}
          </p>
          <p className="mt-2 text-2xl font-bold text-[var(--text-strong)]">{value}</p>
        </div>
        {icon ? (
          <div
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border',
              toneSurfaceClass(tone),
            )}
          >
            {icon}
          </div>
        ) : null}
      </div>
      <p className="mt-3 text-xs leading-5 text-[var(--text-muted)]">{description}</p>
    </>
  );

  if (href) {
    return (
      <Link
        className={cn(
          'block rounded-lg border border-[var(--border-soft)] bg-[var(--bg-card)] p-4 transition hover:bg-[var(--bg-card-hover)]',
          className,
        )}
        href={href}
      >
        {content}
      </Link>
    );
  }

  return (
    <div
      className={cn(
        'rounded-lg border border-[var(--border-soft)] bg-[var(--bg-card)] p-4',
        className,
      )}
    >
      {content}
    </div>
  );
}

function SegmentBarItem({ segment }: { segment: AnalyticsSegment }) {
  const content = (
    <>
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <span className="text-xs font-medium text-[var(--text-main)]">
          {segment.label}
        </span>
        <span className="text-xs font-semibold text-[var(--text-strong)]">
          {segment.value} · {clampPercentage(segment.percentage)}%
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[var(--bg-muted)]">
        <div
          className="h-full rounded-full"
          style={{
            width: `${clampPercentage(segment.percentage)}%`,
            background: toneColor(segment.tone),
          }}
        />
      </div>
    </>
  );

  if (segment.href) {
    return (
      <Link
        className="block rounded-md transition hover:bg-[var(--bg-card-hover)]"
        href={segment.href}
      >
        {content}
      </Link>
    );
  }

  return <div className="rounded-md">{content}</div>;
}

function SegmentLegendItem({ segment }: { segment: AnalyticsSegment }) {
  const content = (
    <div className="flex items-center justify-between gap-3">
      <span className="flex min-w-0 items-center gap-2">
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ background: toneColor(segment.tone) }}
        />
        <span className="truncate text-xs font-medium text-[var(--text-main)]">
          {segment.label}
        </span>
      </span>
      <span className="shrink-0 text-xs font-semibold text-[var(--text-strong)]">
        {segment.value}
      </span>
    </div>
  );

  if (segment.href) {
    return (
      <Link className="block rounded-md py-1 transition hover:bg-[var(--bg-card-hover)]" href={segment.href}>
        {content}
      </Link>
    );
  }

  return <div className="py-1">{content}</div>;
}

function buildConicGradient(segments: AnalyticsSegment[]): string {
  const visibleSegments = segments.filter((segment) => segment.value > 0);
  const total = visibleSegments.reduce((sum, segment) => sum + segment.value, 0);

  if (total <= 0) {
    return 'conic-gradient(var(--bg-muted) 0deg 360deg)';
  }

  let cursor = 0;
  const stops = visibleSegments.map((segment) => {
    const start = cursor;
    const width = (segment.value / total) * 360;
    const end = start + width;
    cursor = end;
    return `${toneColor(segment.tone)} ${start}deg ${end}deg`;
  });

  return `conic-gradient(${stops.join(', ')})`;
}

function clampPercentage(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function toneColor(tone: AnalyticsTone): string {
  if (tone === 'critical') return 'var(--state-error-text)';
  if (tone === 'warning') return 'var(--status-pending-text)';
  if (tone === 'success') return 'var(--status-published-text)';
  return 'var(--color-primary)';
}

function toneSurfaceClass(tone: AnalyticsTone): string {
  if (tone === 'critical') {
    return 'border-[var(--state-error-border)] bg-[var(--state-error-bg)] text-[var(--state-error-text)]';
  }
  if (tone === 'warning') {
    return 'border-[var(--status-pending-border)] bg-[var(--status-pending-bg)] text-[var(--status-pending-text)]';
  }
  if (tone === 'success') {
    return 'border-[var(--status-published-border)] bg-[var(--status-published-bg)] text-[var(--status-published-text)]';
  }
  return 'border-[var(--border-soft)] bg-[var(--bg-card)] text-[var(--color-primary)]';
}
