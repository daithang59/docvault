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
  const previousRotationToken = process.env.AUDIT_INGEST_TOKEN_PREVIOUS;

  afterEach(() => {
    if (previousToken === undefined) {
      delete process.env.AUDIT_INGEST_TOKEN;
    } else {
      process.env.AUDIT_INGEST_TOKEN = previousToken;
    }
    if (previousRotationToken === undefined) {
      delete process.env.AUDIT_INGEST_TOKEN_PREVIOUS;
    } else {
      process.env.AUDIT_INGEST_TOKEN_PREVIOUS = previousRotationToken;
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

  it('accepts the previous token during a rotation window', () => {
    process.env.AUDIT_INGEST_TOKEN = 'new-token';
    process.env.AUDIT_INGEST_TOKEN_PREVIOUS = 'old-token';

    // Caller still using the old token is accepted while rotation completes.
    expect(
      new ServiceTokenGuard().canActivate(contextWithToken('old-token')),
    ).toBe(true);
    // The new token is accepted too.
    expect(
      new ServiceTokenGuard().canActivate(contextWithToken('new-token')),
    ).toBe(true);
  });

  it('rejects a token that matches neither current nor previous', () => {
    process.env.AUDIT_INGEST_TOKEN = 'new-token';
    process.env.AUDIT_INGEST_TOKEN_PREVIOUS = 'old-token';

    expect(() =>
      new ServiceTokenGuard().canActivate(contextWithToken('retired-token')),
    ).toThrow(ForbiddenException);
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
    const securitySummaryGuards = Reflect.getMetadata(
      GUARDS_METADATA,
      AuditController.prototype.securitySummary,
    );
    const sealChainGuards = Reflect.getMetadata(
      GUARDS_METADATA,
      AuditController.prototype.sealCompromisedChainAndStartEpoch,
    );

    expect(createGuards).toContain(ServiceTokenGuard);
    expect(queryGuards).not.toContain(ServiceTokenGuard);
    expect(verifyChainGuards).not.toContain(ServiceTokenGuard);
    expect(securitySummaryGuards).not.toContain(ServiceTokenGuard);
    expect(sealChainGuards).not.toContain(ServiceTokenGuard);
    expect(
      Reflect.getMetadata(ROLES_KEY, AuditController.prototype.query),
    ).toEqual(['compliance_officer', 'admin']);
    expect(
      Reflect.getMetadata(ROLES_KEY, AuditController.prototype.verifyChain),
    ).toEqual(['compliance_officer', 'admin']);
    expect(
      Reflect.getMetadata(ROLES_KEY, AuditController.prototype.securitySummary),
    ).toEqual(['compliance_officer', 'admin']);
    expect(
      Reflect.getMetadata(
        ROLES_KEY,
        AuditController.prototype.sealCompromisedChainAndStartEpoch,
      ),
    ).toEqual(['compliance_officer', 'admin']);
  });
});
