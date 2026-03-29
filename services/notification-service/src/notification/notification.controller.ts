import {
  Controller, Get, Post, Body, Param, Query, Req, UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { NotifyDto } from './dto/notify.dto';
import { NotificationService } from './notification.service';

@ApiTags('notification')
@ApiBearerAuth()
@Controller()
export class NotificationController {
  constructor(private readonly ns: NotificationService) {}

  // ── POST /notify ─────────────────────────────────────────────────────────
  /** Internal — workflow-service calls this to emit a notification. */
  @Post('notify')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Accept a notification event' })
  notify(@Body() body: NotifyDto) {
    return this.ns.notify(body);
  }

  // ── GET /notify ─────────────────────────────────────────────────────────
  /** Frontend — paginated list for the authenticated user. */
  @Get('notify')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'List paginated notifications for the current user' })
  list(
    @Req() req: any,
    @Query('page')  page?: string,
    @Query('limit') limit?: string,
  ) {
    // Prefer username (preferred_username from Keycloak) over sub (UUID).
    // Notifications are stored by the same username that buildActorId() uses.
    const userId = req.user?.username ?? req.user?.sub ?? 'anonymous';
    return this.ns.getForUser(
      userId,
      page  ? parseInt(page,  10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  // ── GET /notify/unread-count ─────────────────────────────────────────────
  /** Lightweight polling endpoint — returns only the count. No auth required. */
  @Get('notify/unread-count')
  @ApiOperation({ summary: 'Get unread notification count' })
  unreadCount(@Req() req: any) {
    const userId = req.user?.username ?? req.user?.sub ?? 'anonymous';
    return { count: this.ns.getUnreadCount(userId) };
  }

  // ── POST /notify/:id/read ────────────────────────────────────────────────
  /** Mark one notification as read. */
  @Post('notify/:id/read')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Mark a single notification as read' })
  markAsRead(@Param('id') id: string) {
    return { ok: this.ns.markAsRead(id) };
  }

  // ── POST /notify/mark-read ───────────────────────────────────────────────
  /** Bulk mark-all-read. */
  @Post('notify/mark-read')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Mark all notifications as read' })
  markAllRead(@Req() req: any) {
    const userId = req.user?.sub ?? req.user?.username ?? 'anonymous';
    this.ns.markAllRead(userId);
    return { ok: true };
  }
}
