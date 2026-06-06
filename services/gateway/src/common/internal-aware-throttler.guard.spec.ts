import { Controller, Get, INestApplication, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
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
    await request(server).get('/ping').set('x-user-id', 'rate-user').expect(200);
    await request(server).get('/ping').set('x-user-id', 'rate-user').expect(200);
    await request(server).get('/ping').set('x-user-id', 'rate-user').expect(200);
    await request(server).get('/ping').set('x-user-id', 'rate-user').expect(429);
  });

  it('exempts internal service-to-service calls via x-internal-call', async () => {
    const server = app.getHttpServer();
    for (let i = 0; i < 6; i++) {
      await request(server)
        .get('/ping')
        .set('x-internal-call', 'true')
        .set('x-user-id', 'internal-caller')
        .expect(200);
    }
  });
});
