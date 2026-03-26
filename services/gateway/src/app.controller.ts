import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags, ApiSecurity } from '@nestjs/swagger';

@ApiTags('app')
@Controller()
export class AppController {
  @Get('health')
  @ApiOperation({
    summary: 'Health check',
    description: 'Returns `200 OK` if the gateway is running.',
  })
  health() {
    return { status: 'ok', service: 'gateway' };
  }

  /** Return the authenticated user parsed from the JWT (Bearer or dv_access_token cookie). */
  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiSecurity('cookie')
  @ApiOperation({
    summary: 'Get current user',
    description:
      'Returns the current authenticated user object extracted from the JWT token. ' +
      'Accepts both Bearer header (`Authorization: Bearer <token>`) and the `dv_access_token` cookie.',
  })
  me(@Req() req: any) {
    return req.user;
  }
}
