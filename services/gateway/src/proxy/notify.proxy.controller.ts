import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
  ApiSecurity,
} from '@nestjs/swagger';
import { ProxyService } from './proxy.service';

@ApiTags('notify-proxy')
@ApiBearerAuth()
@ApiSecurity('cookie')
@Controller()
export class NotifyProxyController {
  constructor(private readonly proxyService: ProxyService) {}

  /** Send a notification to users. Used internally by other services. */
  @Post('notify')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({
    summary: 'Send notification',
    description:
      'Internal endpoint used by workflow-service to send notifications to users ' +
      '(e.g., when a document is submitted for approval or when it is approved/rejected).',
  })
  async notify(@Req() req: any, @Body() body: any) {
    const response = await this.proxyService.forward(req, {
      method: 'POST',
      url: `${process.env.NOTIFICATION_SERVICE_URL}/notify`,
      data: body,
    });
    return response.data;
  }
}
