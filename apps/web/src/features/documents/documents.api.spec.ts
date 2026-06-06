import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getComplianceEvidencePacket } from './documents.api';

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
