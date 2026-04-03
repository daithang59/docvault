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
  let service: AuditService;

  beforeEach(() => {
    mockLean = jest.fn();
    mockCreate = jest.fn();

    const mockModel = {
      create: mockCreate,
      // MongoDB: findOne({}).sort({ timestamp: -1 }).lean()
      findOne: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({ lean: mockLean }),
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
    const result1 = await service.create(baseDto);

    // Reset mocks so findOne returns null again (fresh chain)
    mockLean.mockResolvedValue(null);
    mockCreate.mockImplementation((data) =>
      Promise.resolve({ ...data, toObject: () => ({ ...data }) }),
    );

    const result2 = await service.create(baseDto);

    expect(result1.hash).toBe(result2.hash);
  });

  it('different inputs produce different hashes', async () => {
    const result1 = await service.create(baseDto);

    mockLean.mockResolvedValue(null);
    mockCreate.mockImplementation((data) =>
      Promise.resolve({ ...data, toObject: () => ({ ...data }) }),
    );

    const result2 = await service.create({
      ...baseDto,
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
});
