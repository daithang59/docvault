import { beforeEach, describe, expect, it, vi } from 'vitest';
import { requestSensitiveActionProof } from './sensitive-action.api';

const apiClientMock = vi.hoisted(() => ({
  post: vi.fn(),
}));

vi.mock('@/lib/api/client', () => ({
  default: apiClientMock,
}));

beforeEach(() => {
  apiClientMock.post.mockReset();
});

describe('sensitive action API', () => {
  it('requests a backend proof for the typed sensitive action challenge', async () => {
    apiClientMock.post.mockResolvedValue({
      data: {
        proof: 'proof-token',
        expiresAt: '2026-06-05T10:05:00.000Z',
      },
    });

    const result = await requestSensitiveActionProof({
      action: 'run-retention',
      challengePhrase: 'RUN RETENTION',
    });

    expect(apiClientMock.post).toHaveBeenCalledWith(
      '/metadata/sensitive-actions/proof',
      {
        action: 'run-retention',
        challengePhrase: 'RUN RETENTION',
      },
    );
    expect(result).toEqual({
      proof: 'proof-token',
      expiresAt: '2026-06-05T10:05:00.000Z',
    });
  });
});
