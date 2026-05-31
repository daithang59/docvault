import {
  Roles as SharedRoles,
  RolesGuard as SharedRolesGuard,
  ROLES_KEY as SHARED_ROLES_KEY,
} from '@docvault/auth/rbac';
import {
  Controller,
  Get,
  INestApplication,
  UseGuards,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request = require('supertest');
import { Roles, ROLES_KEY } from './roles.decorator';
import { RolesGuard } from './roles.guard';

@Controller('rbac-test')
@UseGuards(RolesGuard)
class RbacTestController {
  @Get('editor')
  @Roles('editor')
  editorOnly() {
    return { ok: true };
  }
}

describe('document-service shared RBAC wrappers', () => {
  it('re-exports the shared roles decorator and guard', () => {
    expect(Roles).toBe(SharedRoles);
    expect(ROLES_KEY).toBe(SHARED_ROLES_KEY);
    expect(RolesGuard).toBe(SharedRolesGuard);
  });

  it('allows Nest to inject Reflector into the shared guard at runtime', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [RbacTestController],
      providers: [RolesGuard],
    }).compile();
    const app: INestApplication = moduleRef.createNestApplication();

    app.use((req: any, _res: any, next: () => void) => {
      req.user = { roles: ['editor'] };
      next();
    });

    await app.init();

    try {
      await request(app.getHttpServer())
        .get('/rbac-test/editor')
        .expect(200)
        .expect({ ok: true });
    } finally {
      await app.close();
    }
  });
});
