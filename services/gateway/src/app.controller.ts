import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from './auth/roles.decorator';
import { RolesGuard } from './auth/roles.guard';

@Controller()
export class AppController {
  @Get('health')
  health() {
    return { status: 'ok', service: 'gateway' };
  }

  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  me(@Req() req: any) {
    return req.user;
  }

  @Get('admin-only')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin')
  adminOnly() {
    return { ok: true, scope: 'admin' };
  }
}
