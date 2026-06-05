'use client';

import type { ComponentType } from 'react';
import {
  Bookmark,
  ChevronDown,
  Clock,
  FileText,
  FolderOpen,
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
import { useState } from 'react';

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
    const nextSearch = currentSearch
      ? `${currentSearch} ${token}`
      : token;

    if (currentSearch.toLowerCase().includes(token.toLowerCase())) {
      return;
    }

    setField('search', nextSearch);
  }

  const activeChips = getActiveDocumentFilterChips(filters, options);
  const hasActiveFilters = activeChips.length > 0;
  const canSaveView = Boolean(savedViewName.trim() && onSaveCurrentView);
  const hasFolders = options.folders.length > 0;

  return (
    <div
      className="mb-4 rounded-lg border p-3"
      style={{
        background: 'var(--bg-card)',
        borderColor: 'var(--border-soft)',
      }}
    >
      <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-[var(--text-faint)]" />
          <p className="text-sm font-semibold text-[var(--text-strong)]">
            Document filters
          </p>
        </div>
        <p className="text-xs text-[var(--text-muted)]">
          Showing {resultCount} of {totalCount} documents
        </p>
      </div>

      {savedViews.length > 0 || onSaveCurrentView ? (
        <div className="mb-3 rounded-lg border border-[var(--border-soft)] bg-[var(--bg-subtle)] p-3">
          <div className="mb-2 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-2">
              <Bookmark className="h-4 w-4 text-[var(--text-faint)]" />
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                Saved views
              </p>
            </div>
            {onSaveCurrentView ? (
              <div className="flex w-full gap-2 lg:w-auto">
                <input
                  value={savedViewName}
                  onChange={(event) => setSavedViewName(event.target.value)}
                  placeholder="Name current view..."
                  aria-label="Saved view name"
                  className="h-9 min-w-0 flex-1 rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-3 text-sm text-[var(--input-text)] placeholder:text-[var(--input-placeholder)] outline-none transition focus:border-[var(--border-focus)] focus:ring-2 focus:ring-[var(--focus-ring)] lg:w-52"
                />
                <button
                  type="button"
                  disabled={!canSaveView}
                  onClick={() => {
                    const label = savedViewName.trim();
                    if (!label) return;
                    onSaveCurrentView?.(label);
                    setSavedViewName('');
                  }}
                  className="inline-flex h-9 items-center justify-center gap-2 rounded-xl bg-[var(--color-primary)] px-3 text-xs font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Save className="h-3.5 w-3.5" />
                  Save
                </button>
              </div>
            ) : null}
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1">
            {savedViews.map((view) => {
              const active = activeSavedViewId === view.id;

              return (
                <div
                  key={view.id}
                  className={cn(
                    'inline-flex h-10 shrink-0 items-center overflow-hidden rounded-xl border transition',
                    active
                      ? 'border-[var(--border-focus)] bg-[var(--color-primary)] text-white'
                      : 'border-[var(--border-soft)] bg-[var(--bg-card)] text-[var(--text-muted)]',
                  )}
                >
                  <button
                    type="button"
                    title={view.description}
                    onClick={() => onApplySavedView?.(view)}
                    className="inline-flex h-full items-center gap-2 px-3 text-xs font-semibold"
                  >
                    <span>{view.label}</span>
                    <span
                      className={cn(
                        'rounded-full px-1.5 py-0.5 text-[10px]',
                        active
                          ? 'bg-white/20 text-white'
                          : 'bg-[var(--bg-muted)] text-[var(--text-faint)]',
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
                        'flex h-full w-8 items-center justify-center border-l transition',
                        active
                          ? 'border-white/20 text-white hover:bg-white/10'
                          : 'border-[var(--border-soft)] text-[var(--text-faint)] hover:bg-[var(--bg-muted)] hover:text-[var(--state-error-text)]',
                      )}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="mb-3 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Document quick views">
        {quickViews.map((view) => {
          const active = filters.view === view.value;

          return (
            <button
              key={view.value}
              type="button"
              role="tab"
              aria-selected={active}
              title={view.description}
              onClick={() => setField('view', view.value)}
              className={cn(
                'inline-flex h-9 shrink-0 items-center gap-2 rounded-xl border px-3 text-xs font-semibold transition',
                active
                  ? 'border-[var(--border-focus)] bg-[var(--color-primary)] text-white'
                  : 'border-[var(--border-soft)] bg-[var(--bg-muted)] text-[var(--text-muted)] hover:text-[var(--text-main)]',
              )}
            >
              <span>{view.label}</span>
              <span
                className={cn(
                  'rounded-full px-1.5 py-0.5 text-[10px]',
                  active
                    ? 'bg-white/20 text-white'
                    : 'bg-[var(--bg-card)] text-[var(--text-faint)]',
                )}
              >
                {view.count}
              </span>
            </button>
          );
        })}
      </div>

      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-[minmax(240px,1fr)_repeat(5,minmax(140px,auto))_auto]">
        <div className="relative min-w-0">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            value={filters.search}
            onChange={(event) => setField('search', event.target.value)}
            placeholder="Search documents..."
            aria-label="Search documents"
            title="Search syntax: status:pending, class:confidential, tag:finance, owner:editor, file:report.pdf"
            className="h-10 w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] py-2 pl-9 pr-3 text-sm text-[var(--input-text)] placeholder:text-[var(--input-placeholder)] outline-none transition focus:border-[var(--border-focus)] focus:ring-2 focus:ring-[var(--focus-ring)]"
          />
          <span className="sr-only">Search syntax</span>
        </div>

        <SelectFilter
          value={filters.status}
          onChange={(value) => setField('status', value as DocumentStatus | '')}
        options={STATUSES.map((status) => ({ value: status, label: formatEnum(status) }))}
        placeholder="All Status"
        ariaLabel="Filter by status"
      />

        <SelectFilter
          value={filters.classification}
          onChange={(value) =>
            setField('classification', value as ClassificationLevel | '')
          }
          options={CLASSIFICATIONS.map((classification) => ({
            value: classification,
            label: formatEnum(classification),
          }))}
          placeholder="All Classifications"
          ariaLabel="Filter by classification"
        />

        <SelectFilter
          value={filters.ownerId}
          onChange={(value) => setField('ownerId', value)}
          options={options.owners}
          placeholder="All Owners"
          icon={User}
          ariaLabel="Filter by owner"
        />

        <SelectFilter
          value={filters.tag}
          onChange={(value) => setField('tag', value)}
          options={options.tags.map((tag) => ({ value: tag, label: tag }))}
          placeholder="All Tags"
          icon={Tag}
          ariaLabel="Filter by tag"
        />

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

        <button
          type="button"
          onClick={resetFilters}
          disabled={!hasActiveFilters && filters.sort === DEFAULT_DOCUMENT_FILTERS.sort && filters.sortDir === DEFAULT_DOCUMENT_FILTERS.sortDir}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-3 text-sm font-medium text-[var(--text-muted)] transition hover:bg-[var(--bg-muted)] hover:text-[var(--text-main)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Reset
        </button>
      </div>

      {searchSuggestions.length > 0 ? (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex shrink-0 items-center gap-2">
            <Search className="h-3.5 w-3.5 text-[var(--text-faint)]" />
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
              Query chips
            </p>
          </div>
          <div className="flex min-w-0 gap-2 overflow-x-auto pb-1 sm:pb-0">
            {searchSuggestions.map((suggestion) => {
              const Icon = suggestionIcon(suggestion.kind);

              return (
                <button
                  key={suggestion.token}
                  type="button"
                  title={suggestion.description}
                  onClick={() => appendSearchToken(suggestion.token)}
                  className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-[var(--border-soft)] bg-[var(--bg-muted)] px-2.5 text-xs font-semibold text-[var(--text-muted)] transition hover:border-[var(--border-focus)] hover:text-[var(--text-main)]"
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{suggestion.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {hasFolders ? (
        <div className="mt-3 rounded-lg border border-[var(--border-soft)] bg-[var(--bg-subtle)] p-3">
          <div className="mb-2 flex items-center gap-2">
            <FolderOpen className="h-4 w-4 text-[var(--text-faint)]" />
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
              Smart folders
            </p>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {options.folders.map((folder) => {
              const active = filters.folder === folder.value;

              return (
                <button
                  key={folder.value}
                  type="button"
                  onClick={() =>
                    setField('folder', active ? '' : folder.value)
                  }
                  className={cn(
                    'inline-flex h-9 shrink-0 items-center gap-2 rounded-xl border px-3 text-xs font-semibold transition',
                    active
                      ? 'border-[var(--border-focus)] bg-[var(--color-primary)] text-white'
                      : 'border-[var(--border-soft)] bg-[var(--bg-card)] text-[var(--text-muted)] hover:text-[var(--text-main)]',
                  )}
                >
                  <span>Folder: {folder.value}</span>
                  <span
                    className={cn(
                      'rounded-full px-1.5 py-0.5 text-[10px]',
                      active
                        ? 'bg-white/20 text-white'
                        : 'bg-[var(--bg-muted)] text-[var(--text-faint)]',
                    )}
                  >
                    {folder.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {activeChips.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {activeChips.map((chip) => (
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
          'h-10 w-full cursor-pointer appearance-none rounded-xl border bg-[var(--input-bg)] py-2 pr-8 text-sm outline-none transition',
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
