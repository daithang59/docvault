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
  let mockFindOne: jest.Mock;
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

    mockFindOne = jest.fn().mockReturnValue({
      sort: mockFindOneSort,
    });

    const mockModel = {
      create: mockCreate,
      // MongoDB: findOne({}).sort(...).lean()
      findOne: mockFindOne,
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
    expect(result.epochId).toBe('default');
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

    expect(mockFindOne).toHaveBeenCalledWith(
      {
        $or: [{ epochId: 'default' }, { epochId: { $exists: false } }],
      },
      { hash: 1 },
    );
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
    await service.create({
      ...dto,
      eventId: 'sig-event-2',
      action: 'DOCUMENT_APPROVED',
    });

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
    await service.create({
      ...dto,
      eventId: 'sig-event-2',
      action: 'DOCUMENT_APPROVED',
    });

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

describe('AuditService — concurrent append (race fix)', () => {
  /**
   * Stored model that enforces the unique-prevHash invariant the real
   * MongoDB index provides: two events may never share the same prevHash.
   * A violation throws an E11000-shaped error so we can prove the in-process
   * mutex prevents the chain from forking under concurrent writes.
   */
  function makeUniquePrevHashModel() {
    const storedEvents: any[] = [];
    const usedPrevHashes = new Set<string>();

    return {
      _storedEvents: storedEvents,
      create: jest.fn(async (data) => {
        const prevKey = data.prevHash ?? '__null__';
        if (usedPrevHashes.has(prevKey)) {
          const err: any = new Error(
            `E11000 duplicate key error collection: audit_events index: prevHash_1 dup key: { prevHash: "${data.prevHash}" }`,
          );
          err.code = 11000;
          err.keyPattern = { prevHash: 1 };
          throw err;
        }
        usedPrevHashes.add(prevKey);

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
    };
  }

  const baseDto = {
    actorId: 'user-1',
    actorRoles: ['admin'],
    action: 'DOCUMENT_VIEWED',
    resourceType: 'DOCUMENT',
    resourceId: 'doc-1',
    result: 'SUCCESS',
  };

  it('serializes concurrent creates into a single fork-free chain', async () => {
    const model = makeUniquePrevHashModel();
    const service = new AuditService(model as any);

    const burst = 25;
    const results = await Promise.all(
      Array.from({ length: burst }, (_, i) =>
        service.create({
          ...baseDto,
          eventId: `concurrent-${i}`,
          metadata: { index: i },
        }),
      ),
    );

    // Every write succeeded — the mutex funnelled them so none collided on the
    // unique prevHash index.
    expect(results).toHaveLength(burst);

    // No duplicate prevHash (fork-free) and no duplicate hashes.
    const prevHashes = model._storedEvents.map((e) => e.prevHash ?? null);
    const hashes = model._storedEvents.map((e) => e.hash);
    expect(new Set(prevHashes).size).toBe(burst);
    expect(new Set(hashes).size).toBe(burst);

    // Exactly one genesis event (prevHash === null).
    expect(prevHashes.filter((p) => p === null)).toHaveLength(1);

    // The resulting chain verifies clean.
    const verify = await service.verifyChain();
    expect(verify.valid).toBe(true);
    expect(verify.checked).toBe(burst);
  });

  it('retries against the new head when another writer wins the prevHash race', async () => {
    // Simulate a cross-instance race: the first insert fails with E11000 (some
    // other instance grabbed the head we read), then the head advances and the
    // retry succeeds.
    const externalHead = {
      _id: 'event-external',
      eventId: 'external-writer',
      timestamp: new Date('2026-06-04T00:00:00.000Z'),
      actorId: 'other-instance',
      actorRoles: ['admin'],
      action: 'DOCUMENT_CREATED',
      resourceType: 'DOCUMENT',
      resourceId: 'doc-x',
      result: 'SUCCESS',
      prevHash: null,
      hash: 'a'.repeat(64),
    };

    let createCalls = 0;
    let headReads = 0;
    const saved: any[] = [];

    const model = {
      create: jest.fn(async (data) => {
        createCalls += 1;
        if (createCalls === 1) {
          // Loser of the race: the head we linked to was already extended.
          const err: any = new Error('E11000 duplicate key error: prevHash');
          err.code = 11000;
          err.keyPattern = { prevHash: 1 };
          throw err;
        }
        const savedEvent = { _id: `event-${createCalls}`, ...data };
        saved.push(savedEvent);
        return { ...savedEvent, toObject: () => ({ ...savedEvent }) };
      }),
      findOne: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          lean: jest.fn(async () => {
            headReads += 1;
            // After the collision, the visible head has advanced to externalHead.
            return headReads === 1 ? null : externalHead;
          }),
        }),
      }),
    };

    const service = new AuditService(model as any);

    const result = await service.create({
      actorId: 'user-1',
      actorRoles: ['admin'],
      action: 'DOCUMENT_VIEWED',
      resourceType: 'DOCUMENT',
      resourceId: 'doc-1',
      result: 'SUCCESS',
      eventId: 'retried-event',
    });

    // It retried (two create attempts) and linked to the new head, not the stale one.
    expect(createCalls).toBe(2);
    expect(result.prevHash).toBe(externalHead.hash);
    expect(result.hash).toHaveLength(64);
  });

  it('gives up with a clear error after exhausting retries under relentless contention', async () => {
    // The unique prevHash index rejects every insert (a pathological writer
    // perpetually grabs the head first). The service must fail loudly rather
    // than spin forever.
    const model = {
      create: jest.fn(async () => {
        const err: any = new Error('E11000 duplicate key error: prevHash');
        err.code = 11000;
        err.keyPattern = { prevHash: 1 };
        throw err;
      }),
      findOne: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          lean: jest.fn(async () => null),
        }),
      }),
    };

    const service = new AuditService(model as any);

    await expect(
      service.create({
        actorId: 'user-1',
        actorRoles: ['admin'],
        action: 'DOCUMENT_VIEWED',
        resourceType: 'DOCUMENT',
        resourceId: 'doc-1',
        result: 'SUCCESS',
        eventId: 'doomed-event',
      }),
    ).rejects.toThrow(/write contention/i);
  });
});

describe('AuditService — audit chain epochs', () => {
  function matchesFilter(event: any, filter: Record<string, any>): boolean {
    if (!filter || Object.keys(filter).length === 0) return true;

    if (Array.isArray(filter.$or)) {
      return filter.$or.some((item: Record<string, any>) =>
        matchesFilter(event, item),
      );
    }

    return Object.entries(filter).every(([key, value]) => {
      if (
        value &&
        typeof value === 'object' &&
        '$exists' in (value as Record<string, unknown>)
      ) {
        return (key in event) === Boolean((value as any).$exists);
      }

      return event[key] === value;
    });
  }

  function sortByDirection(events: any[], sort: Record<string, 1 | -1>) {
    const entries = Object.entries(sort);
    return [...events].sort((a, b) => {
      for (const [field, direction] of entries) {
        const left =
          a[field] instanceof Date ? a[field].getTime() : String(a[field]);
        const right =
          b[field] instanceof Date ? b[field].getTime() : String(b[field]);
        if (left < right) return -1 * direction;
        if (left > right) return 1 * direction;
      }
      return 0;
    });
  }

  function makeEpochAwareModels(seedEpochs: any[]) {
    const events: any[] = [];
    const epochs = [...seedEpochs];
    const incidents: any[] = [];

    const eventModel = {
      _events: events,
      create: jest.fn(async (data) => {
        const savedEvent = {
          _id: `event-${String(events.length + 1).padStart(3, '0')}`,
          ...data,
        };
        events.push(savedEvent);
        return { ...savedEvent, toObject: () => ({ ...savedEvent }) };
      }),
      findOne: jest.fn((filter: Record<string, any>) => ({
        sort: jest.fn((sort: Record<string, 1 | -1>) => ({
          lean: jest.fn(async () => {
            const [head] = sortByDirection(
              events.filter((event) => matchesFilter(event, filter)),
              sort,
            );
            return head ?? null;
          }),
        })),
      })),
      find: jest.fn((filter: Record<string, any>) => ({
        sort: jest.fn((sort: Record<string, 1 | -1>) => ({
          limit: jest.fn((limit: number) => ({
            lean: jest.fn(async () =>
              sortByDirection(
                events.filter((event) => matchesFilter(event, filter)),
                sort,
              ).slice(0, limit),
            ),
          })),
        })),
      })),
    };

    const epochModel = {
      _epochs: epochs,
      create: jest.fn(async (data) => {
        const savedEpoch = {
          _id: `epoch-${String(epochs.length + 1).padStart(3, '0')}`,
          ...data,
        };
        epochs.push(savedEpoch);
        return { ...savedEpoch, toObject: () => ({ ...savedEpoch }) };
      }),
      findOne: jest.fn((filter: Record<string, any>) => ({
        sort: jest.fn((sort: Record<string, 1 | -1>) => ({
          lean: jest.fn(async () => {
            const [epoch] = sortByDirection(
              epochs.filter((item) => matchesFilter(item, filter)),
              sort,
            );
            return epoch ?? null;
          }),
        })),
      })),
      find: jest.fn((filter: Record<string, any>) => ({
        sort: jest.fn((sort: Record<string, 1 | -1>) => ({
          limit: jest.fn((limit: number) => ({
            lean: jest.fn(async () =>
              sortByDirection(
                epochs.filter((item) => matchesFilter(item, filter)),
                sort,
              ).slice(0, limit),
            ),
          })),
        })),
      })),
      updateOne: jest.fn(async (filter: Record<string, any>, update: any) => {
        const epoch = epochs.find((item) => matchesFilter(item, filter));
        if (!epoch) return { modifiedCount: 0 };
        Object.assign(epoch, update.$set ?? {});
        return { modifiedCount: 1 };
      }),
    };

    const incidentModel = {
      _incidents: incidents,
      create: jest.fn(async (data) => {
        const savedIncident = {
          _id: `incident-${String(incidents.length + 1).padStart(3, '0')}`,
          ...data,
        };
        incidents.push(savedIncident);
        return {
          ...savedIncident,
          toObject: () => ({ ...savedIncident }),
        };
      }),
    };

    return { eventModel, epochModel, incidentModel };
  }

  const baseDto = {
    actorId: 'admin-1',
    actorRoles: ['admin'],
    action: 'DOCUMENT_VIEWED',
    resourceType: 'DOCUMENT',
    resourceId: 'doc-epoch',
    result: 'SUCCESS',
  };

  it('reports a valid active epoch separately from compromised history', async () => {
    const { eventModel, epochModel, incidentModel } = makeEpochAwareModels([
      {
        epochId: 'old-epoch',
        status: 'COMPROMISED',
        startedAt: new Date('2026-06-01T00:00:00.000Z'),
        endedAt: new Date('2026-06-13T00:00:00.000Z'),
        genesisReason: 'INITIAL',
        createdBy: 'system',
        reason: 'Compromised during test',
        incidentId: 'AUDIT-INC-old',
        firstBrokenIndex: 1,
        firstBrokenEventId: 'old-event-2',
        lastTrustedHash: 'a'.repeat(64),
      },
      {
        epochId: 'active-epoch',
        status: 'ACTIVE',
        startedAt: new Date('2026-06-13T00:00:01.000Z'),
        genesisReason: 'COMPROMISE_RECOVERY',
        previousEpochId: 'old-epoch',
        createdBy: 'admin-1',
        reason: 'New epoch after incident',
      },
    ]);
    const service = new AuditService(
      eventModel as any,
      epochModel as any,
      incidentModel as any,
    );

    await service.create({
      ...baseDto,
      eventId: 'active-event-1',
      timestamp: '2026-06-13T00:01:00.000Z',
    });

    const result = await service.verifyChain();

    expect(result.valid).toBe(true);
    expect(result.epochId).toBe('active-epoch');
    expect(result.activeEpoch).toMatchObject({
      epochId: 'active-epoch',
      status: 'ACTIVE',
      valid: true,
      checked: 1,
    });
    expect(result.historicalCompromisedCount).toBe(1);
    expect(result.compromisedEpochs).toEqual([
      expect.objectContaining({
        epochId: 'old-epoch',
        status: 'COMPROMISED',
        incidentId: 'AUDIT-INC-old',
        firstBrokenIndex: 1,
      }),
    ]);
  });

  it('seals an invalid active epoch and starts a new trusted epoch', async () => {
    const { eventModel, epochModel, incidentModel } = makeEpochAwareModels([
      {
        epochId: 'active-epoch',
        status: 'ACTIVE',
        startedAt: new Date('2026-06-13T00:00:00.000Z'),
        genesisReason: 'INITIAL',
        createdBy: 'system',
        reason: 'Initial epoch',
      },
    ]);
    const service = new AuditService(
      eventModel as any,
      epochModel as any,
      incidentModel as any,
    );

    await service.create({
      ...baseDto,
      eventId: 'active-event-1',
      timestamp: '2026-06-13T00:01:00.000Z',
    });
    await service.create({
      ...baseDto,
      eventId: 'active-event-2',
      timestamp: '2026-06-13T00:02:00.000Z',
      action: 'DOCUMENT_DOWNLOADED',
    });
    eventModel._events[1].action = 'DOCUMENT_DELETED';

    const result = await service.sealCompromisedChainAndStartEpoch(
      { reason: 'Unrecoverable tamper evidence in active epoch' },
      { actorId: 'admin-1', roles: ['admin'] },
    );

    expect(result.previousEpoch).toMatchObject({
      epochId: 'active-epoch',
      status: 'COMPROMISED',
      firstBrokenIndex: 1,
      firstBrokenEventId: 'active-event-2',
    });
    expect(result.newEpoch).toMatchObject({
      status: 'ACTIVE',
      previousEpochId: 'active-epoch',
      genesisReason: 'COMPROMISE_RECOVERY',
    });
    expect(incidentModel._incidents).toHaveLength(1);
    expect(incidentModel._incidents[0]).toMatchObject({
      affectedEpochId: 'active-epoch',
      firstBrokenIndex: 1,
      resolution: 'NEW_EPOCH_STARTED',
    });
    expect(eventModel._events.at(-1)).toMatchObject({
      epochId: result.newEpoch.epochId,
      action: 'AUDIT_CHAIN_EPOCH_STARTED',
      resourceType: 'AUDIT_CHAIN_EPOCH',
      resourceId: result.newEpoch.epochId,
      result: 'SUCCESS',
    });
  });
});
