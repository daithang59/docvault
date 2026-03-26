export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg-app)]">
      <div className="flex flex-col items-center gap-3">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-[var(--border-soft)] border-t-[var(--color-primary)]" />
        <p className="text-sm font-medium text-[var(--text-muted)]">Loading…</p>
      </div>
    </div>
  );
}
