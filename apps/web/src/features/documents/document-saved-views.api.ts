import apiClient from '@/lib/api/client';
import { apiEndpoints } from '@/lib/api/endpoints';
import { unwrap } from '@/lib/api/response';
import {
  DEFAULT_DOCUMENT_FILTERS,
  parseDocumentFiltersFromSearchParams,
  serializeDocumentFiltersToSearchParams,
  type DocumentFiltersState,
} from './document-filter-model';
import type {
  DocumentSavedView,
  DocumentSavedViewScope,
} from './document-saved-views';

interface PersistedDocumentSavedViewDto {
  id: string;
  name?: string;
  label?: string;
  description?: string | null;
  scope: DocumentSavedViewScope;
  ownerId: string;
  filters: DocumentFiltersState;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePersistedDocumentSavedViewInput {
  label: string;
  description?: string;
  scope?: DocumentSavedViewScope;
  filters: DocumentFiltersState;
}

const DEFAULT_CUSTOM_DESCRIPTION =
  'Saved from the current document workbench filters.';

export async function listPersistedDocumentSavedViews(): Promise<
  DocumentSavedView[]
> {
  const res = await apiClient.get<PersistedDocumentSavedViewDto[]>(
    apiEndpoints.metadata.savedViews.list,
  );
  return unwrap(res).map(toDocumentSavedView);
}

export async function createPersistedDocumentSavedView(
  input: CreatePersistedDocumentSavedViewInput,
): Promise<DocumentSavedView> {
  const res = await apiClient.post<PersistedDocumentSavedViewDto>(
    apiEndpoints.metadata.savedViews.create,
    {
      name: input.label.trim(),
      description: input.description?.trim() || DEFAULT_CUSTOM_DESCRIPTION,
      scope: input.scope ?? 'PRIVATE',
      filters: normalizePersistedFilters(input.filters),
    },
  );

  return toDocumentSavedView(unwrap(res));
}

export async function deletePersistedDocumentSavedView(id: string) {
  const res = await apiClient.delete(apiEndpoints.metadata.savedViews.delete(id));
  return unwrap(res);
}

function toDocumentSavedView(
  view: PersistedDocumentSavedViewDto,
): DocumentSavedView {
  return {
    id: view.id,
    label: (view.label ?? view.name ?? 'Saved view').trim() || 'Saved view',
    description: view.description?.trim() || DEFAULT_CUSTOM_DESCRIPTION,
    source: 'custom',
    scope: view.scope,
    ownerId: view.ownerId,
    createdAt: view.createdAt,
    updatedAt: view.updatedAt,
    filters: normalizePersistedFilters(view.filters),
  };
}

function normalizePersistedFilters(
  filters: DocumentFiltersState,
): DocumentFiltersState {
  return parseDocumentFiltersFromSearchParams(
    serializeDocumentFiltersToSearchParams({
      ...DEFAULT_DOCUMENT_FILTERS,
      ...filters,
    }),
  );
}
