import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
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

  /** Fetch notifications for the authenticated user. */
  @Get('notify')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'List notifications for the current user' })
  async list(@Req() req: any) {
    const response = await this.proxyService.forward(req, {
      method: 'GET',
      url: `${process.env.NOTIFICATION_SERVICE_URL}/notify`,
    });
    return response.data;
  }

  /** Mark all notifications as read for the authenticated user. */
  @Post('notify/mark-read')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Mark all notifications as read' })
  async markAllRead(@Req() req: any) {
    const response = await this.proxyService.forward(req, {
      method: 'POST',
      url: `${process.env.NOTIFICATION_SERVICE_URL}/notify/mark-read`,
    });
    return response.data;
  }

  /** Lightweight unread count — used by frontend for polling. */
  @Get('notify/unread-count')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Get unread notification count' })
  async unreadCount(@Req() req: any) {
    const response = await this.proxyService.forward(req, {
      method: 'GET',
      url: `${process.env.NOTIFICATION_SERVICE_URL}/notify/unread-count`,
    });
    return response.data;
  }

  /** Mark a single notification as read. */
  @Post('notify/:id/read')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Mark a single notification as read' })
  async markAsRead(@Req() req: any, @Param('id') id: string) {
    const response = await this.proxyService.forward(req, {
      method: 'POST',
      url: `${process.env.NOTIFICATION_SERVICE_URL}/notify/${id}/read`,
    });
    return response.data;
  }
}
