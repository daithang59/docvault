import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { ProxyService } from './proxy.service';

@ApiTags('notify-proxy')
@ApiBearerAuth()
@Controller()
export class NotifyProxyController {
  constructor(private readonly proxyService: ProxyService) {}

  @Post('notify')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'Proxy -> notification-service POST /notify' })
  async notify(@Req() req: any, @Body() body: any) {
    const response = await this.proxyService.forward(req, {
      method: 'POST',
      url: `${process.env.NOTIFICATION_SERVICE_URL}/notify`,
      data: body,
    });
    return response.data;
  }
}
