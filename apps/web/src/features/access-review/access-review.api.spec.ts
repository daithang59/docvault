import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getAccessReviewDocuments } from './access-review.api';

const apiClientMock = vi.hoisted(() => ({
  get: vi.fn(),
}));

vi.mock('@/lib/api/client', () => ({
  default: apiClientMock,
}));

beforeEach(() => {
  apiClientMock.get.mockReset();
});

describe('access review API', () => {
  it('loads the gateway-provided review document batch in one request', async () => {
    const documents = [
      {
        id: 'doc-secret',
        title: 'Secret plan',
        status: 'PUBLISHED',
        classification: 'SECRET',
        ownerId: 'owner-1',
        currentVersion: 1,
        filename: 'secret.pdf',
        tags: [],
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-02T00:00:00.000Z',
        versions: [],
        aclEntries: [],
      },
    ];
    apiClientMock.get.mockResolvedValue({ data: documents });

    const result = await getAccessReviewDocuments();

    expect(apiClientMock.get).toHaveBeenCalledWith(
      '/metadata/access-review/documents',
    );
    expect(result).toBe(documents);
  });
});
