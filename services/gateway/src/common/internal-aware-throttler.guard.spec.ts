import { Controller, Get, INestApplication, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { isInternalServiceCall } from '@docvault/throttler';
import { InternalAwareThrottlerGuard } from './internal-aware-throttler.guard';

@Controller()
class PingController {
  @Get('ping')
  ping() {
    return { ok: true };
  }
}

@Module({
  imports: [
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60000, limit: 3 }]),
  ],
  controllers: [PingController],
  providers: [{ provide: APP_GUARD, useClass: InternalAwareThrottlerGuard }],
})
class TestAppModule {}

describe('InternalAwareThrottlerGuard (integration)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [TestAppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns 429 once the per-window limit is exceeded', async () => {
    const server = app.getHttpServer();
    // limit is 3 per window; the 4th request from the same tracker should 429.
    await request(server)
      .get('/ping')
      .set('x-user-id', 'rate-user')
      .expect(200);
    await request(server)
      .get('/ping')
      .set('x-user-id', 'rate-user')
      .expect(200);
    await request(server)
      .get('/ping')
      .set('x-user-id', 'rate-user')
      .expect(200);
    await request(server)
      .get('/ping')
      .set('x-user-id', 'rate-user')
      .expect(429);
  });

  it('exempts internal service-to-service calls carrying the shared secret', async () => {
    process.env.INTERNAL_CALL_SECRET = 'internal-secret';
    const server = app.getHttpServer();
    for (let i = 0; i < 6; i++) {
      await request(server)
        .get('/ping')
        .set('x-internal-call', 'internal-secret')
        .set('x-user-id', 'internal-caller')
        .expect(200);
    }
    delete process.env.INTERNAL_CALL_SECRET;
  });
});

// Pure-function security checks for the exemption predicate. Kept separate
// from the integration suite so they don't share throttle bucket state.
describe('isInternalServiceCall', () => {
  const saved = process.env.INTERNAL_CALL_SECRET;
  afterEach(() => {
    if (saved === undefined) delete process.env.INTERNAL_CALL_SECRET;
    else process.env.INTERNAL_CALL_SECRET = saved;
  });

  it('returns false when no secret is configured (fail-closed)', () => {
    delete process.env.INTERNAL_CALL_SECRET;
    expect(
      isInternalServiceCall({ headers: { 'x-internal-call': 'true' } }),
    ).toBe(false);
  });

  it('rejects the legacy "true" flag once a secret is set', () => {
    process.env.INTERNAL_CALL_SECRET = 'internal-secret';
    expect(
      isInternalServiceCall({ headers: { 'x-internal-call': 'true' } }),
    ).toBe(false);
  });

  it('rejects a wrong secret value', () => {
    process.env.INTERNAL_CALL_SECRET = 'internal-secret';
    expect(
      isInternalServiceCall({ headers: { 'x-internal-call': 'guess' } }),
    ).toBe(false);
  });

  it('accepts the exact configured secret', () => {
    process.env.INTERNAL_CALL_SECRET = 'internal-secret';
    expect(
      isInternalServiceCall({
        headers: { 'x-internal-call': 'internal-secret' },
      }),
    ).toBe(true);
  });

  it('returns false when the header is absent', () => {
    process.env.INTERNAL_CALL_SECRET = 'internal-secret';
    expect(isInternalServiceCall({ headers: {} })).toBe(false);
  });
});
