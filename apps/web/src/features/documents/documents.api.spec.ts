import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getComplianceEvidencePacket, getDocument } from './documents.api';

const apiClientMock = vi.hoisted(() => ({
  get: vi.fn(),
}));

vi.mock('@/lib/api/client', () => ({
  default: apiClientMock,
}));

beforeEach(() => {
  apiClientMock.get.mockReset();
});

describe('documents API sensitive actions', () => {
  it('sends a redeemed share token when fetching document detail', async () => {
    const document = {
      id: 'doc-1',
      title: 'Shared document',
      versions: [],
      aclEntries: [],
    };
    apiClientMock.get.mockResolvedValue({ data: document });

    const result = await getDocument('doc-1', 'raw token');

    expect(apiClientMock.get).toHaveBeenCalledWith(
      '/metadata/documents/doc-1?shareToken=raw+token',
    );
    expect(result).toMatchObject({
      id: 'doc-1',
      title: 'Shared document',
    });
  });

  it('sends the backend step-up proof when exporting an evidence packet', async () => {
    const packet = {
      metadataOnly: true,
      document: { title: 'Board evidence' },
    };
    apiClientMock.get.mockResolvedValue({ data: packet });

    const result = await getComplianceEvidencePacket('doc-1', {
      stepUpProof: 'proof-token',
    });

    expect(apiClientMock.get).toHaveBeenCalledWith(
      '/metadata/documents/doc-1/evidence-packet',
      {
        headers: {
          'x-docvault-step-up-proof': 'proof-token',
        },
      },
    );
    expect(result).toBe(packet);
  });
});
