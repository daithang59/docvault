import { createHash } from 'crypto';
import { AuditService } from './audit.service';

// --- Mock PrismaService ---
const mockCreate = jest.fn();
const mockFindFirst = jest.fn();
const mockFindMany = jest.fn();

const mockPrisma = {
  auditEvent: {
    create: mockCreate,
    findFirst: mockFindFirst,
    findMany: mockFindMany,
  },
};

describe('AuditService — Hash Chain', () => {
  let service: AuditService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AuditService(mockPrisma as any);
    mockCreate.mockImplementation(({ data }) => Promise.resolve(data));
  });

  const baseDto = {
    actorId: 'user-1',
    actorRoles: ['admin'],
    action: 'DOCUMENT_CREATED',
    resourceType: 'DOCUMENT',
    resourceId: 'doc-1',
    result: 'SUCCESS',
  };

  it('first event has prevHash = null', async () => {
    mockFindFirst.mockResolvedValue(null); // no prior events

    const result = await service.create(baseDto);

    expect(result.prevHash).toBeNull();
    expect(result.hash).toBeDefined();
    expect(typeof result.hash).toBe('string');
    expect(result.hash).toHaveLength(64); // SHA-256 hex
  });

  it('second event chains from first event hash', async () => {
    mockFindFirst.mockResolvedValue(null);
    const first = await service.create(baseDto);

    mockFindFirst.mockResolvedValue({ hash: first.hash });
    const second = await service.create({
      ...baseDto,
      action: 'DOCUMENT_SUBMITTED',
    });

    expect(second.prevHash).toBe(first.hash);
    expect(second.hash).not.toBe(first.hash);
    expect(second.hash).toHaveLength(64);
  });

  it('hash is deterministic for same input', async () => {
    mockFindFirst.mockResolvedValue(null);

    const result1 = await service.create(baseDto);

    jest.clearAllMocks();
    mockFindFirst.mockResolvedValue(null);
    mockCreate.mockImplementation(({ data }) => Promise.resolve(data));

    const result2 = await service.create(baseDto);

    expect(result1.hash).toBe(result2.hash);
  });

  it('different inputs produce different hashes', async () => {
    mockFindFirst.mockResolvedValue(null);

    const result1 = await service.create(baseDto);

    jest.clearAllMocks();
    mockFindFirst.mockResolvedValue(null);
    mockCreate.mockImplementation(({ data }) => Promise.resolve(data));

    const result2 = await service.create({
      ...baseDto,
      actorId: 'user-2', // different actor
    });

    expect(result1.hash).not.toBe(result2.hash);
  });

  it('hash includes all canonical fields', async () => {
    mockFindFirst.mockResolvedValue(null);

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
