import { Controller, Get, Post, Body, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { NotifyDto } from './dto/notify.dto';
import { NotificationService } from './notification.service';

@ApiTags('notification')
@ApiBearerAuth()
@Controller()
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  /** Internal — called by other services (workflow-service) to emit a notification. */
  @Post('notify')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Accept a notification event' })
  notify(@Body() body: NotifyDto) {
    return this.notificationService.notify(body);
  }

  /** Frontend-facing — fetch all notifications for the authenticated user. */
  @Get('notify')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'List notifications for the current user' })
  list(@Req() req: any) {
    const userId = req.user?.sub ?? req.user?.username ?? 'anonymous';
    return this.notificationService.getForUser(userId);
  }

  /** Mark all notifications as read for the authenticated user. */
  @Post('notify/mark-read')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Mark all notifications as read' })
  markAllRead(@Req() req: any) {
    const userId = req.user?.sub ?? req.user?.username ?? 'anonymous';
    this.notificationService.markAllRead(userId);
    return { ok: true };
  }
}
