import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_DOCUMENT_FILTERS } from './document-filter-model';
import {
  createPersistedDocumentSavedView,
  deletePersistedDocumentSavedView,
  listPersistedDocumentSavedViews,
} from './document-saved-views.api';

const apiClientMock = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  delete: vi.fn(),
}));

vi.mock('@/lib/api/client', () => ({
  default: apiClientMock,
}));

beforeEach(() => {
  apiClientMock.get.mockReset();
  apiClientMock.post.mockReset();
  apiClientMock.delete.mockReset();
});

describe('document saved views API', () => {
  it('lists persisted saved views from the saved-views endpoint for the current user', async () => {
    apiClientMock.get.mockResolvedValue({
      data: [
        {
          id: 'view-1',
          name: 'Finance board',
          description: 'Board review queue',
          scope: 'PRIVATE',
          ownerId: 'editor-1',
          filters: {
            ...DEFAULT_DOCUMENT_FILTERS,
            search: 'tag:finance',
            classification: 'CONFIDENTIAL',
          },
          createdAt: '2026-06-04T03:00:00.000Z',
          updatedAt: '2026-06-04T03:00:00.000Z',
        },
      ],
    });

    const result = await listPersistedDocumentSavedViews();

    expect(apiClientMock.get).toHaveBeenCalledWith('/metadata/document-saved-views');
    expect(result).toEqual([
      expect.objectContaining({
        id: 'view-1',
        label: 'Finance board',
        source: 'custom',
        scope: 'PRIVATE',
        filters: expect.objectContaining({
          search: 'tag:finance',
          classification: 'CONFIDENTIAL',
        }),
      }),
    ]);
  });

  it('creates a persisted saved view with normalized filters and owner scope', async () => {
    apiClientMock.post.mockResolvedValue({
      data: {
        id: 'view-created',
        name: 'Security triage',
        description: 'Saved from the current document workbench filters.',
        scope: 'TEAM',
        ownerId: 'admin-1',
        filters: {
          ...DEFAULT_DOCUMENT_FILTERS,
          view: 'pending-review',
          search: 'tag:security',
          sort: 'updatedAt',
          sortDir: 'desc',
        },
        createdAt: '2026-06-04T04:00:00.000Z',
        updatedAt: '2026-06-04T04:00:00.000Z',
      },
    });

    const result = await createPersistedDocumentSavedView({
      label: 'Security triage',
      scope: 'TEAM',
      filters: {
        ...DEFAULT_DOCUMENT_FILTERS,
        view: 'pending-review',
        search: 'tag:security',
        status: 'NOT_A_STATUS' as never,
        sort: 'updatedAt',
        sortDir: 'desc',
      },
    });

    expect(apiClientMock.post).toHaveBeenCalledWith('/metadata/document-saved-views', {
      name: 'Security triage',
      description: 'Saved from the current document workbench filters.',
      scope: 'TEAM',
      filters: {
        ...DEFAULT_DOCUMENT_FILTERS,
        view: 'pending-review',
        search: 'tag:security',
      },
    });
    expect(result).toEqual(
      expect.objectContaining({
        id: 'view-created',
        label: 'Security triage',
        source: 'custom',
        scope: 'TEAM',
      }),
    );
  });

  it('deletes a persisted saved view through the metadata gateway endpoint', async () => {
    apiClientMock.delete.mockResolvedValue({ data: { ok: true } });

    await deletePersistedDocumentSavedView('view-1');

    expect(apiClientMock.delete).toHaveBeenCalledWith(
      '/metadata/document-saved-views/view-1',
    );
  });
});
