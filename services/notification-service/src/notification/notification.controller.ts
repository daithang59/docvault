import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { NotifyDto } from './dto/notify.dto';
import { NotificationService } from './notification.service';

@ApiTags('notification')
@ApiBearerAuth()
@Controller()
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Post('notify')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({
    summary: 'Accept a notification event and log it in dev mode',
  })
  notify(@Body() body: NotifyDto) {
    return this.notificationService.notify(body);
  }
}
