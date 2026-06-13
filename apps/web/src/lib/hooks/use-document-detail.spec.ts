import { beforeEach, describe, expect, it, vi } from 'vitest';
import { documentsKeys } from '@/features/documents/documents.keys';
import { useDocumentDetail } from './use-document-detail';

const useQueryMock = vi.hoisted(() => vi.fn((options) => options));
const getDocumentDetailMock = vi.hoisted(() => vi.fn());
const getShareTokenMock = vi.hoisted(() => vi.fn());

vi.mock('@tanstack/react-query', () => ({
  useQuery: useQueryMock,
}));

vi.mock('@/lib/api/metadata', () => ({
  getDocumentDetail: getDocumentDetailMock,
}));

vi.mock('@/features/share-links/share-token-store', () => ({
  getShareToken: getShareTokenMock,
}));

beforeEach(() => {
  useQueryMock.mockClear();
  getDocumentDetailMock.mockClear();
  getShareTokenMock.mockReset();
});

describe('useDocumentDetail', () => {
  it('uses a redeemed share token when loading document detail', () => {
    getShareTokenMock.mockReturnValue('raw-token');

    const query = useDocumentDetail('doc-1') as unknown as {
      queryKey: readonly unknown[];
      queryFn: () => unknown;
    };
    query.queryFn();

    expect(getShareTokenMock).toHaveBeenCalledWith('doc-1');
    expect(query.queryKey).toEqual([...documentsKeys.detail('doc-1'), 'share']);
    expect(getDocumentDetailMock).toHaveBeenCalledWith('doc-1', 'raw-token');
  });
});
