import { Injectable, Logger } from '@nestjs/common';
import { NotifyDto } from './dto/notify.dto';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  notify(dto: NotifyDto) {
    this.logger.log(
      JSON.stringify({
        type: dto.type,
        docId: dto.docId,
        actorId: dto.actorId,
        reason: dto.reason,
        traceId: dto.traceId,
      }),
    );

    return {
      accepted: true,
      type: dto.type,
      docId: dto.docId,
    };
  }
}
