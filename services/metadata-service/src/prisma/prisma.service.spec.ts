import { PrismaService } from './prisma.service';

/**
 * Unit test for the RLS session-context helper. We don't need a live Postgres:
 * we assert that withOrgContext opens a transaction and sets app.current_org
 * (transaction-scoped) before running the caller's work, so RLS policies can
 * scope every query to the org without leaking across pooled connections.
 */
describe('PrismaService.withOrgContext', () => {
  it('sets the org session variable inside a transaction, then runs fn', async () => {
    const executeRaw = jest.fn().mockResolvedValue(1);
    const tx = { $executeRaw: executeRaw };

    // Fake $transaction that just invokes the callback with our tx stub.
    const service = Object.create(PrismaService.prototype) as PrismaService;
    (service as any).$transaction = jest.fn(async (cb: any) => cb(tx));

    const fn = jest.fn().mockResolvedValue('result');
    const result = await service.withOrgContext('org-acme', fn);

    expect((service as any).$transaction).toHaveBeenCalledTimes(1);
    // set_config called before the caller's work
    expect(executeRaw).toHaveBeenCalledTimes(1);
    // The org id is passed as a bound parameter (template strings array call).
    const callArgs = executeRaw.mock.calls[0];
    expect(JSON.stringify(callArgs)).toContain('org-acme');
    expect(fn).toHaveBeenCalledWith(tx);
    expect(result).toBe('result');
  });

  it('propagates the org id as a parameter (not string-interpolated)', async () => {
    const executeRaw = jest.fn().mockResolvedValue(1);
    const tx = { $executeRaw: executeRaw };
    const service = Object.create(PrismaService.prototype) as PrismaService;
    (service as any).$transaction = jest.fn(async (cb: any) => cb(tx));

    await service.withOrgContext("org'; DROP TABLE documents;--", jest.fn());

    // Tagged-template call → first arg is the strings array, the org id is a
    // separate bound value. The raw SQL string must NOT contain the payload.
    const [strings, ...values] = executeRaw.mock.calls[0];
    expect(Array.isArray(strings)).toBe(true);
    expect(strings.join('')).not.toContain('DROP TABLE');
    expect(values).toContain("org'; DROP TABLE documents;--");
  });
});
