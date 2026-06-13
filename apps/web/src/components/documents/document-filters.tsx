'use client';

import type { ComponentType } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useOwnerDisplayNames } from '@/features/approvals/approvals.hooks';
import {
  Bookmark,
  ChevronDown,
  Clock,
  FileText,
  RotateCcw,
  Save,
  Search,
  Shield,
  SlidersHorizontal,
  Tag,
  Trash2,
  User,
  X,
} from 'lucide-react';
import { DocumentStatus, ClassificationLevel } from '@/types/document';
import {
  DEFAULT_DOCUMENT_FILTERS,
  clearDocumentFilter,
  getActiveDocumentFilterChips,
  type DocumentFilterOptions,
  type DocumentFiltersState,
  type DocumentQuickViewOption,
  type DocumentSearchSuggestion,
  type DocumentSearchSuggestionKind,
} from '@/features/documents/document-filter-model';
import type { DocumentSavedViewOption } from '@/features/documents/document-saved-views';
import { cn } from '@/lib/utils/cn';

interface DocumentFiltersProps {
  filters: DocumentFiltersState;
  options: DocumentFilterOptions;
  quickViews: DocumentQuickViewOption[];
  searchSuggestions?: DocumentSearchSuggestion[];
  savedViews?: DocumentSavedViewOption[];
  activeSavedViewId?: string | null;
  resultCount: number;
  totalCount: number;
  onChange: (filters: DocumentFiltersState) => void;
  onApplySavedView?: (view: DocumentSavedViewOption) => void;
  onSaveCurrentView?: (label: string) => void;
  onDeleteSavedView?: (id: string) => void;
}

const STATUSES: DocumentStatus[] = ['DRAFT', 'PENDING', 'PUBLISHED', 'ARCHIVED', 'DELETED'];
const CLASSIFICATIONS: ClassificationLevel[] = ['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'SECRET'];

const SORT_OPTIONS = [
  { value: 'updatedAt:desc', label: 'Recently updated' },
  { value: 'updatedAt:asc', label: 'Oldest updated' },
  { value: 'createdAt:desc', label: 'Newest created' },
  { value: 'title:asc', label: 'Title A-Z' },
  { value: 'title:desc', label: 'Title Z-A' },
  { value: 'status:asc', label: 'Status A-Z' },
  { value: 'classification:asc', label: 'Classification A-Z' },
  { value: 'ownerId:asc', label: 'Owner A-Z' },
];

export function DocumentFilters({
  filters,
  options,
  quickViews,
  searchSuggestions = [],
  savedViews = [],
  activeSavedViewId = null,
  resultCount,
  totalCount,
  onChange,
  onApplySavedView,
  onSaveCurrentView,
  onDeleteSavedView,
}: DocumentFiltersProps) {
  const [savedViewName, setSavedViewName] = useState('');
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [savePanelOpen, setSavePanelOpen] = useState(false);

  function setField<K extends keyof DocumentFiltersState>(key: K, value: DocumentFiltersState[K]) {
    onChange({ ...filters, [key]: value });
  }

  function clearFilter(key: keyof DocumentFiltersState) {
    onChange(clearDocumentFilter(filters, key));
  }

  function resetFilters() {
    onChange(DEFAULT_DOCUMENT_FILTERS);
  }

  function appendSearchToken(token: string) {
    const currentSearch = filters.search.trim();
    if (currentSearch.toLowerCase().includes(token.toLowerCase())) return;
    setField('search', currentSearch ? `${currentSearch} ${token}` : token);
  }

  // Owner options arrive as raw ids when the list payload lacks display names.
  // Resolve them through the org directory so the dropdown and owner chips show
  // human names instead of opaque keycloak subs.
  const ownerIds = useMemo(
    () => options.owners.map((owner) => owner.value),
    [options.owners],
  );
  const { data: ownerDisplayNames } = useOwnerDisplayNames(ownerIds);
  const ownerOptions = useMemo(
    () =>
      options.owners.map((owner) => ({
        value: owner.value,
        label:
          ownerDisplayNames?.[owner.value]?.displayName ?? owner.label,
      })),
    [options.owners, ownerDisplayNames],
  );

  function resolveSuggestionLabel(suggestion: DocumentSearchSuggestion): string {
    if (suggestion.kind !== 'owner') return suggestion.label;
    // The token is `owner:<id>` (or quoted) — swap the id for a display name.
    const match = suggestion.token.match(/^owner:"?([^"]+)"?$/i);
    const ownerId = match?.[1];
    const displayName = ownerId
      ? ownerDisplayNames?.[ownerId]?.displayName
      : undefined;
    return displayName ? `owner:${displayName}` : suggestion.label;
  }

  const resolvedOptions = useMemo(
    () => ({ ...options, owners: ownerOptions }),
    [options, ownerOptions],
  );
  const activeChips = getActiveDocumentFilterChips(filters, resolvedOptions);
  const hasActiveFilters = activeChips.length > 0;
  // Chips minus the quick-view chip — the view is already represented by the tab strip.
  const detailChips = activeChips.filter((chip) => chip.key !== 'view');
  // Count of advanced filters living inside the popover (status/class/owner/tag).
  const popoverFilterCount = [
    filters.status,
    filters.classification,
    filters.ownerId,
    filters.tag,
  ].filter(Boolean).length;
  const canSaveView = Boolean(savedViewName.trim() && onSaveCurrentView);
  const isSortDirty =
    filters.sort !== DEFAULT_DOCUMENT_FILTERS.sort ||
    filters.sortDir !== DEFAULT_DOCUMENT_FILTERS.sortDir;

  return (
    <div
      className="mb-4 rounded-xl border p-3"
      style={{ background: 'var(--bg-card)', borderColor: 'var(--border-soft)' }}
    >
      {/* ── Row 1: View tabs + saved views ─────────────────────────── */}
      <div className="flex items-center gap-2">
        <div
          className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto pb-0.5"
          role="tablist"
          aria-label="Document views"
        >
          {quickViews.map((view) => {
            const active = activeSavedViewId === null && filters.view === view.value;
            return (
              <button
                key={view.value}
                type="button"
                role="tab"
                aria-selected={active}
                title={view.description}
                onClick={() => setField('view', view.value)}
                className={cn(
                  'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold transition',
                  active
                    ? 'bg-[var(--color-primary)] text-white'
                    : 'text-[var(--text-muted)] hover:bg-[var(--bg-muted)] hover:text-[var(--text-main)]',
                )}
              >
                <span>{view.label}</span>
                <span
                  className={cn(
                    'rounded-full px-1.5 text-[10px] tabular-nums',
                    active ? 'bg-white/20 text-white' : 'bg-[var(--bg-muted)] text-[var(--text-faint)]',
                  )}
                >
                  {view.count}
                </span>
              </button>
            );
          })}

          {savedViews.length > 0 ? (
            <>
              <span className="mx-1 h-5 w-px shrink-0 bg-[var(--border-soft)]" aria-hidden="true" />
              {savedViews.map((view) => {
                const active = activeSavedViewId === view.id;
                return (
                  <span
                    key={view.id}
                    className={cn(
                      'inline-flex h-8 shrink-0 items-center overflow-hidden rounded-lg border transition',
                      active
                        ? 'border-[var(--border-focus)] bg-[var(--color-primary)] text-white'
                        : 'border-[var(--border-soft)] bg-[var(--bg-card)] text-[var(--text-muted)]',
                    )}
                  >
                    <button
                      type="button"
                      title={view.description}
                      onClick={() => onApplySavedView?.(view)}
                      className="inline-flex h-full items-center gap-1.5 px-2.5 text-xs font-semibold"
                    >
                      <Bookmark className="h-3 w-3 shrink-0" />
                      <span className="max-w-[10rem] truncate">{view.label}</span>
                      <span
                        className={cn(
                          'rounded-full px-1.5 text-[10px] tabular-nums',
                          active ? 'bg-white/20 text-white' : 'bg-[var(--bg-muted)] text-[var(--text-faint)]',
                        )}
                      >
                        {view.count}
                      </span>
                    </button>
                    {view.source === 'custom' && onDeleteSavedView ? (
                      <button
                        type="button"
                        aria-label={`Delete saved view ${view.label}`}
                        onClick={() => onDeleteSavedView(view.id)}
                        className={cn(
                          'flex h-full w-7 items-center justify-center border-l transition',
                          active
                            ? 'border-white/20 text-white hover:bg-white/10'
                            : 'border-[var(--border-soft)] text-[var(--text-faint)] hover:bg-[var(--bg-muted)] hover:text-[var(--state-error-text)]',
                        )}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    ) : null}
                  </span>
                );
              })}
            </>
          ) : null}
        </div>

        <p className="hidden shrink-0 text-xs text-[var(--text-muted)] tabular-nums sm:block">
          {resultCount} / {totalCount}
        </p>
      </div>

      {/* ── Row 2: Search + Filter popover + Sort + Save ───────────── */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            value={filters.search}
            onChange={(event) => setField('search', event.target.value)}
            placeholder="Search documents…"
            aria-label="Search documents"
            title="Search syntax: status:pending, class:confidential, tag:finance, owner:editor, file:report.pdf"
            className="h-9 w-full rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] py-2 pl-9 pr-8 text-sm text-[var(--input-text)] placeholder:text-[var(--input-placeholder)] outline-none transition focus:border-[var(--border-focus)] focus:ring-2 focus:ring-[var(--focus-ring)]"
          />
          {filters.search ? (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => setField('search', '')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-faint)] transition hover:text-[var(--text-main)]"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>

        {/* Filter popover */}
        <Popover
          open={filterPanelOpen}
          onOpenChange={setFilterPanelOpen}
          align="end"
          trigger={
            <button
              type="button"
              className={cn(
                'inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-sm font-medium transition',
                popoverFilterCount > 0
                  ? 'border-[var(--border-focus)] bg-[var(--color-primary-light)] text-[var(--color-primary)]'
                  : 'border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-muted)] hover:bg-[var(--bg-muted)] hover:text-[var(--text-main)]',
              )}
            >
              <SlidersHorizontal className="h-4 w-4" />
              <span className="hidden sm:inline">Filter</span>
              {popoverFilterCount > 0 ? (
                <span className="rounded-full bg-[var(--color-primary)] px-1.5 text-[10px] font-bold text-white tabular-nums">
                  {popoverFilterCount}
                </span>
              ) : null}
            </button>
          }
        >
          <div className="w-72 p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                Filters
              </p>
              {popoverFilterCount > 0 ? (
                <button
                  type="button"
                  onClick={() =>
                    onChange({
                      ...filters,
                      status: '',
                      classification: '',
                      ownerId: '',
                      tag: '',
                    })
                  }
                  className="text-xs font-medium text-[var(--text-faint)] transition hover:text-[var(--state-error-text)]"
                >
                  Clear all
                </button>
              ) : null}
            </div>

            <div className="space-y-2.5">
              <FilterField label="Status">
                <SelectFilter
                  value={filters.status}
                  onChange={(value) => setField('status', value as DocumentStatus | '')}
                  options={STATUSES.map((status) => ({ value: status, label: formatEnum(status) }))}
                  placeholder="All Status"
                  ariaLabel="Filter by status"
                />
              </FilterField>

              <FilterField label="Classification">
                <SelectFilter
                  value={filters.classification}
                  onChange={(value) => setField('classification', value as ClassificationLevel | '')}
                  options={CLASSIFICATIONS.map((classification) => ({
                    value: classification,
                    label: formatEnum(classification),
                  }))}
                  placeholder="All Classifications"
                  ariaLabel="Filter by classification"
                />
              </FilterField>

              <FilterField label="Owner">
                <SelectFilter
                  value={filters.ownerId}
                  onChange={(value) => setField('ownerId', value)}
                  options={ownerOptions}
                  placeholder="All Owners"
                  icon={User}
                  ariaLabel="Filter by owner"
                />
              </FilterField>

              <FilterField label="Tag">
                <SelectFilter
                  value={filters.tag}
                  onChange={(value) => setField('tag', value)}
                  options={options.tags.map((tag) => ({ value: tag, label: tag }))}
                  placeholder="All Tags"
                  icon={Tag}
                  ariaLabel="Filter by tag"
                />
              </FilterField>
            </div>

            {searchSuggestions.length > 0 ? (
              <div className="mt-3 border-t border-[var(--border-soft)] pt-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                  Quick queries
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {searchSuggestions.map((suggestion) => {
                    const Icon = suggestionIcon(suggestion.kind);
                    return (
                      <button
                        key={suggestion.token}
                        type="button"
                        title={suggestion.description}
                        onClick={() => appendSearchToken(suggestion.token)}
                        className="inline-flex h-7 items-center gap-1.5 rounded-md border border-[var(--border-soft)] bg-[var(--bg-muted)] px-2 text-xs font-semibold text-[var(--text-muted)] transition hover:border-[var(--border-focus)] hover:text-[var(--text-main)]"
                      >
                        <Icon className="h-3 w-3" />
                        <span>{resolveSuggestionLabel(suggestion)}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
        </Popover>

        {/* Sort */}
        <div className="w-44 shrink-0">
          <SelectFilter
            value={`${filters.sort}:${filters.sortDir}`}
            onChange={(value) => {
              const [sort, sortDir] = value.split(':');
              onChange({
                ...filters,
                sort: sort as DocumentFiltersState['sort'],
                sortDir: sortDir as DocumentFiltersState['sortDir'],
              });
            }}
            options={SORT_OPTIONS}
            placeholder="Sort by"
            ariaLabel="Sort documents"
          />
        </div>

        {/* Save view */}
        {onSaveCurrentView ? (
          <Popover
            open={savePanelOpen}
            onOpenChange={setSavePanelOpen}
            align="end"
            trigger={
              <button
                type="button"
                title="Save current filters as a view"
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] px-3 text-sm font-medium text-[var(--text-muted)] transition hover:bg-[var(--bg-muted)] hover:text-[var(--text-main)]"
              >
                <Bookmark className="h-4 w-4" />
                <span className="hidden lg:inline">Save view</span>
              </button>
            }
          >
            <div className="w-64 p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                Save current view
              </p>
              <div className="flex gap-2">
                <input
                  value={savedViewName}
                  onChange={(event) => setSavedViewName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && canSaveView) {
                      onSaveCurrentView(savedViewName.trim());
                      setSavedViewName('');
                      setSavePanelOpen(false);
                    }
                  }}
                  placeholder="View name…"
                  aria-label="Saved view name"
                  autoFocus
                  className="h-9 min-w-0 flex-1 rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] px-3 text-sm text-[var(--input-text)] placeholder:text-[var(--input-placeholder)] outline-none transition focus:border-[var(--border-focus)] focus:ring-2 focus:ring-[var(--focus-ring)]"
                />
                <button
                  type="button"
                  disabled={!canSaveView}
                  onClick={() => {
                    const label = savedViewName.trim();
                    if (!label) return;
                    onSaveCurrentView(label);
                    setSavedViewName('');
                    setSavePanelOpen(false);
                  }}
                  className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-[var(--color-primary)] px-3 text-xs font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Save className="h-3.5 w-3.5" />
                  Save
                </button>
              </div>
            </div>
          </Popover>
        ) : null}

        {/* Reset */}
        <button
          type="button"
          onClick={resetFilters}
          disabled={!hasActiveFilters && !isSortDirty}
          title="Reset all filters"
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-muted)] transition hover:bg-[var(--bg-muted)] hover:text-[var(--text-main)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <RotateCcw className="h-4 w-4" />
        </button>
      </div>

      {/* ── Row 3: Active filter chips (detail only) ───────────────── */}
      {detailChips.length > 0 ? (
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          {detailChips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={() => clearFilter(chip.key)}
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-soft)] bg-[var(--bg-muted)] px-2.5 py-1 text-xs font-medium text-[var(--text-main)] transition hover:border-[var(--border-focus)]"
            >
              {chip.label}
              <X className="h-3 w-3 text-[var(--text-muted)]" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-[var(--text-faint)]">
        {label}
      </span>
      {children}
    </label>
  );
}

function Popover({
  open,
  onOpenChange,
  trigger,
  children,
  align = 'start',
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: React.ReactNode;
  children: React.ReactNode;
  align?: 'start' | 'end';
}) {
  const triggerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  // Anchor the floating panel to the trigger via fixed positioning so it
  // escapes the filter card's stacking context (the card uses `animate-in`,
  // which would otherwise let the table render above an absolute popover).
  useEffect(() => {
    if (!open) return;

    function updatePosition() {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const width = panelRef.current?.offsetWidth ?? 288;
      const rawLeft = align === 'end' ? rect.right - width : rect.left;
      const left = Math.max(8, Math.min(rawLeft, window.innerWidth - width - 8));
      setPosition({ top: rect.bottom + 8, left });
    }

    updatePosition();

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (
        !triggerRef.current?.contains(target) &&
        !panelRef.current?.contains(target)
      ) {
        onOpenChange(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onOpenChange(false);
    }

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open, onOpenChange, align]);

  return (
    <div ref={triggerRef} className="shrink-0">
      <span onClick={() => onOpenChange(!open)}>{trigger}</span>
      {open && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={panelRef}
              className="fixed z-50 overflow-hidden rounded-xl border"
              style={{
                top: position?.top ?? -9999,
                left: position?.left ?? -9999,
                visibility: position ? 'visible' : 'hidden',
                background: 'var(--surface-overlay-strong)',
                borderColor: 'var(--surface-border)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                boxShadow: 'var(--surface-shadow-lg)',
              }}
            >
              {children}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

function SelectFilter({
  value,
  onChange,
  options,
  placeholder,
  icon: Icon,
  ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder: string;
  icon?: ComponentType<{ className?: string }>;
  ariaLabel: string;
}) {
  return (
    <div className="relative">
      {Icon ? (
        <Icon className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-muted)]" />
      ) : null}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={ariaLabel}
        className={cn(
          'h-9 w-full cursor-pointer appearance-none rounded-lg border bg-[var(--input-bg)] py-2 pr-8 text-sm outline-none transition',
          'focus:ring-2 focus:ring-[var(--focus-ring)] focus:border-[var(--border-focus)]',
          value ? 'border-[var(--border-focus)] text-[var(--color-primary)]' : 'border-[var(--input-border)] text-[var(--text-muted)]',
          Icon ? 'pl-8' : 'pl-3',
        )}
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-muted)]" />
    </div>
  );
}

function formatEnum(value: string): string {
  return value
    .toLowerCase()
    .split('_')
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(' ');
}

function suggestionIcon(
  kind: DocumentSearchSuggestionKind,
): ComponentType<{ className?: string }> {
  if (kind === 'status') return Clock;
  if (kind === 'classification') return Shield;
  if (kind === 'file') return FileText;
  if (kind === 'presence') return FileText;
  if (kind === 'dlp') return Shield;
  if (kind === 'retention') return Clock;
  if (kind === 'owner') return User;
  return Tag;
}
