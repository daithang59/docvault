import { AuditService } from './audit.service';

/**
 * Unit tests for AuditService hash chain logic.
 *
 * Uses a plain mock model (no module mocking needed) — the service
 * only needs `findOne().sort().lean()` and `create()`, so we wire
 * those up directly in the test.
 */

describe('AuditService — Hash Chain', () => {
  // Plain mock model — no NestJS/Mongoose dependency
  let mockLean: jest.Mock;
  let mockCreate: jest.Mock;
  let mockFindOneSort: jest.Mock;
  let mockFindSort: jest.Mock;
  let service: AuditService;

  beforeEach(() => {
    mockLean = jest.fn();
    mockCreate = jest.fn();
    mockFindOneSort = jest.fn().mockReturnValue({ lean: mockLean });
    mockFindSort = jest.fn().mockReturnValue({
      limit: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([]),
      }),
    });

    const mockModel = {
      create: mockCreate,
      // MongoDB: findOne({}).sort(...).lean()
      findOne: jest.fn().mockReturnValue({
        sort: mockFindOneSort,
      }),
      find: jest.fn().mockReturnValue({
        sort: mockFindSort,
      }),
    };

    service = new AuditService(mockModel as any);

    mockLean.mockResolvedValue(null);
    // Simulate MongoDB: only the first argument is returned as saved document
    mockCreate.mockImplementation((data) =>
      Promise.resolve({ ...data, toObject: () => ({ ...data }) }),
    );
  });

  const baseDto = {
    eventId: 'fixed-event-id-for-determinism',
    actorId: 'user-1',
    actorRoles: ['admin'],
    action: 'DOCUMENT_CREATED',
    resourceType: 'DOCUMENT',
    resourceId: 'doc-1',
    result: 'SUCCESS',
  };
  const timestampedDto = {
    ...baseDto,
    timestamp: '2026-06-04T00:00:00.000Z',
  };

  function makeStoredModel() {
    const storedEvents: any[] = [];

    const model = {
      create: jest.fn(async (data) => {
        const savedEvent = {
          _id: `event-${String(storedEvents.length + 1).padStart(3, '0')}`,
          ...data,
        };
        storedEvents.push(savedEvent);

        return {
          ...savedEvent,
          toObject: () => ({ ...savedEvent }),
        };
      }),
      findOne: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          lean: jest.fn(async () => {
            const [head] = [...storedEvents].sort((a, b) => {
              const timeDelta = b.timestamp.getTime() - a.timestamp.getTime();
              if (timeDelta !== 0) return timeDelta;
              return String(b._id).localeCompare(String(a._id));
            });

            return head ?? null;
          }),
        }),
      }),
      find: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            lean: jest.fn(async () =>
              [...storedEvents].sort((a, b) => {
                const timeDelta = a.timestamp.getTime() - b.timestamp.getTime();
                if (timeDelta !== 0) return timeDelta;
                return String(a._id).localeCompare(String(b._id));
              }),
            ),
          }),
        }),
      }),
    };

    return model;
  }

  it('first event has prevHash = null', async () => {
    const result = await service.create(baseDto);

    expect(result.prevHash).toBeNull();
    expect(result.hash).toBeDefined();
    expect(typeof result.hash).toBe('string');
    expect(result.hash).toHaveLength(64); // SHA-256 hex
  });

  it('second event chains from first event hash', async () => {
    const first = await service.create(baseDto);
    mockLean.mockResolvedValue({ hash: first.hash });

    const second = await service.create({
      ...baseDto,
      action: 'DOCUMENT_SUBMITTED',
    });

    expect(second.prevHash).toBe(first.hash);
    expect(second.hash).not.toBe(first.hash);
    expect(second.hash).toHaveLength(64);
  });

  it('hash is deterministic for same input', async () => {
    const result1 = await service.create(timestampedDto);

    // Reset mocks so findOne returns null again (fresh chain)
    mockLean.mockResolvedValue(null);
    mockCreate.mockImplementation((data) =>
      Promise.resolve({ ...data, toObject: () => ({ ...data }) }),
    );

    const result2 = await service.create(timestampedDto);

    expect(result1.hash).toBe(result2.hash);
  });

  it('different inputs produce different hashes', async () => {
    const result1 = await service.create(timestampedDto);

    mockLean.mockResolvedValue(null);
    mockCreate.mockImplementation((data) =>
      Promise.resolve({ ...data, toObject: () => ({ ...data }) }),
    );

    const result2 = await service.create({
      ...timestampedDto,
      actorId: 'user-2', // different actor
    });

    expect(result1.hash).not.toBe(result2.hash);
  });

  it('hash includes all canonical fields', async () => {
    const result = await service.create({
      ...baseDto,
      reason: 'test reason',
      ip: '10.0.0.1',
      traceId: 'trace-abc',
    });

    // Verify hash is a valid SHA-256 hex string
    expect(result.hash).toMatch(/^[a-f0-9]{64}$/);
    expect(result.prevHash).toBeNull();
  });

  it('selects the previous chain head with deterministic timestamp and _id ordering', async () => {
    await service.create(baseDto);

    expect(mockFindOneSort).toHaveBeenCalledWith({
      timestamp: -1,
      _id: -1,
    });
  });

  it('verifies the chain with deterministic timestamp and _id ordering', async () => {
    await service.verifyChain();

    expect(mockFindSort).toHaveBeenCalledWith({
      timestamp: 1,
      _id: 1,
    });
  });

  it('verifies a clean chain built from events without caller timestamps', async () => {
    const storedModel = makeStoredModel();
    const storedService = new AuditService(storedModel as any);

    await storedService.create(baseDto);
    await storedService.create({
      ...baseDto,
      eventId: 'second-event-id-for-clean-chain',
      action: 'DOCUMENT_APPROVED',
    });

    await expect(storedService.verifyChain()).resolves.toEqual({
      valid: true,
      checked: 2,
    });
  });

  it('verifies a clean chain when metadata is empty', async () => {
    const storedModel = makeStoredModel();
    const storedService = new AuditService(storedModel as any);

    await storedService.create({
      ...baseDto,
      metadata: {},
    });

    await expect(storedService.verifyChain()).resolves.toEqual({
      valid: true,
      checked: 1,
    });
  });
});
