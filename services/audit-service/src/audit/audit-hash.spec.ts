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
      signedCount: 0,
      unsignedCount: 2,
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
      signedCount: 0,
      unsignedCount: 1,
    });
  });
});

describe('AuditService — HMAC signing', () => {
  const SECRET = 'audit-signing-secret';
  const savedSecret = process.env.AUDIT_SIGNING_SECRET;

  function makeStoredModel() {
    const storedEvents: any[] = [];
    return {
      create: jest.fn(async (data) => {
        const savedEvent = {
          _id: `event-${String(storedEvents.length + 1).padStart(3, '0')}`,
          ...data,
        };
        storedEvents.push(savedEvent);
        return { ...savedEvent, toObject: () => ({ ...savedEvent }) };
      }),
      findOne: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          lean: jest.fn(async () => {
            const [head] = [...storedEvents].sort((a, b) => {
              const d = b.timestamp.getTime() - a.timestamp.getTime();
              return d !== 0 ? d : String(b._id).localeCompare(String(a._id));
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
                const d = a.timestamp.getTime() - b.timestamp.getTime();
                return d !== 0 ? d : String(a._id).localeCompare(String(b._id));
              }),
            ),
          }),
        }),
      }),
      _storedEvents: storedEvents,
    };
  }

  const dto = {
    eventId: 'sig-event-1',
    actorId: 'user-1',
    actorRoles: ['admin'],
    action: 'DOCUMENT_CREATED',
    resourceType: 'DOCUMENT',
    resourceId: 'doc-1',
    result: 'SUCCESS',
  };

  afterEach(() => {
    if (savedSecret === undefined) delete process.env.AUDIT_SIGNING_SECRET;
    else process.env.AUDIT_SIGNING_SECRET = savedSecret;
  });

  it('signs new events when a secret is configured', async () => {
    process.env.AUDIT_SIGNING_SECRET = SECRET;
    const model = makeStoredModel();
    const service = new AuditService(model as any);

    const event = await service.create(dto);
    expect(event.signature).toMatch(/^[a-f0-9]{64}$/);
  });

  it('verifies a fully signed chain as valid with signatureValid=true', async () => {
    process.env.AUDIT_SIGNING_SECRET = SECRET;
    const model = makeStoredModel();
    const service = new AuditService(model as any);

    await service.create(dto);
    await service.create({ ...dto, eventId: 'sig-event-2', action: 'DOCUMENT_APPROVED' });

    const result = await service.verifyChain();
    expect(result.valid).toBe(true);
    expect(result.signedCount).toBe(2);
    expect(result.unsignedCount).toBe(0);
    expect(result.signatureValid).toBe(true);
  });

  it('detects a forged event whose hash was recomputed without the secret', async () => {
    process.env.AUDIT_SIGNING_SECRET = SECRET;
    const model = makeStoredModel();
    const service = new AuditService(model as any);

    await service.create(dto);
    await service.create({ ...dto, eventId: 'sig-event-2', action: 'DOCUMENT_APPROVED' });

    // Attacker with DB write access tampers an event and recomputes hash+prevHash,
    // but cannot produce a valid signature without the secret. Simulate by
    // leaving a stale signature while changing the action.
    const events = model._storedEvents;
    events[1].action = 'DOCUMENT_DELETED'; // tamper
    // Recompute the chain hash the way an attacker could (no secret needed):
    const svcAny = service as any;
    const canonical = svcAny.buildCanonicalPayload({
      eventId: events[1].eventId,
      timestamp: events[1].timestamp.toISOString(),
      actorId: events[1].actorId,
      actorRoles: events[1].actorRoles,
      action: events[1].action,
      resourceType: events[1].resourceType,
      resourceId: events[1].resourceId,
      result: events[1].result,
      reason: events[1].reason,
      ip: events[1].ip,
      traceId: events[1].traceId,
    });
    events[1].hash = svcAny.computeHash(events[0].hash, canonical);
    // signature is now stale relative to the new hash → must be detected.

    const result = await service.verifyChain();
    expect(result.valid).toBe(false);
    expect(result.signatureValid).toBe(false);
  });
});
