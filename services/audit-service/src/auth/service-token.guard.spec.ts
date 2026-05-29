import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { AuditController } from '../audit/audit.controller';
import { ROLES_KEY } from './roles.decorator';
import { ServiceTokenGuard } from './service-token.guard';

function contextWithToken(token?: string): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        headers:
          token === undefined
            ? {}
            : {
                'x-docvault-service-token': token,
              },
      }),
    }),
  } as unknown as ExecutionContext;
}

describe('ServiceTokenGuard', () => {
  const previousToken = process.env.AUDIT_INGEST_TOKEN;

  afterEach(() => {
    if (previousToken === undefined) {
      delete process.env.AUDIT_INGEST_TOKEN;
    } else {
      process.env.AUDIT_INGEST_TOKEN = previousToken;
    }
  });

  it('rejects requests without a service token', () => {
    process.env.AUDIT_INGEST_TOKEN = 'expected-token';

    expect(() =>
      new ServiceTokenGuard().canActivate(contextWithToken()),
    ).toThrow(ForbiddenException);
  });

  it('rejects requests with the wrong service token', () => {
    process.env.AUDIT_INGEST_TOKEN = 'expected-token';

    expect(() =>
      new ServiceTokenGuard().canActivate(contextWithToken('wrong-token')),
    ).toThrow(ForbiddenException);
  });

  it('rejects requests when AUDIT_INGEST_TOKEN is not configured', () => {
    delete process.env.AUDIT_INGEST_TOKEN;

    expect(() =>
      new ServiceTokenGuard().canActivate(contextWithToken('expected-token')),
    ).toThrow(ForbiddenException);
  });

  it('accepts requests with the configured service token', () => {
    process.env.AUDIT_INGEST_TOKEN = 'expected-token';

    expect(
      new ServiceTokenGuard().canActivate(contextWithToken('expected-token')),
    ).toBe(true);
  });

  it('guards audit event ingestion without replacing query role guards', () => {
    const createGuards = Reflect.getMetadata(
      GUARDS_METADATA,
      AuditController.prototype.create,
    );
    const queryGuards = Reflect.getMetadata(
      GUARDS_METADATA,
      AuditController.prototype.query,
    );
    const verifyChainGuards = Reflect.getMetadata(
      GUARDS_METADATA,
      AuditController.prototype.verifyChain,
    );

    expect(createGuards).toContain(ServiceTokenGuard);
    expect(queryGuards).not.toContain(ServiceTokenGuard);
    expect(verifyChainGuards).not.toContain(ServiceTokenGuard);
    expect(
      Reflect.getMetadata(ROLES_KEY, AuditController.prototype.query),
    ).toEqual(['compliance_officer', 'admin']);
    expect(
      Reflect.getMetadata(ROLES_KEY, AuditController.prototype.verifyChain),
    ).toEqual(['compliance_officer', 'admin']);
  });
});
