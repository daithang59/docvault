import { beforeEach, describe, expect, it, vi } from 'vitest';
import { runRetention } from './retention.api';

const apiClientMock = vi.hoisted(() => ({
  post: vi.fn(),
}));

vi.mock('@/lib/api/client', () => ({
  default: apiClientMock,
}));

beforeEach(() => {
  apiClientMock.post.mockReset();
});

describe('retention API sensitive actions', () => {
  it('sends the backend step-up proof when running retention automation', async () => {
    const runResult = {
      archived: 2,
      checkedAt: '2026-06-05T10:00:00.000Z',
    };
    apiClientMock.post.mockResolvedValue({ data: runResult });

    const result = await runRetention({
      asOf: '2026-06-05T00:00:00.000Z',
      stepUpProof: 'proof-token',
    });

    expect(apiClientMock.post).toHaveBeenCalledWith(
      '/metadata/retention/run',
      undefined,
      {
        params: { asOf: '2026-06-05T00:00:00.000Z' },
        headers: {
          'x-docvault-step-up-proof': 'proof-token',
        },
      },
    );
    expect(result).toBe(runResult);
  });
});
