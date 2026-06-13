import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DocumentsService } from './documents.service';

/**
 * Scheduled permanent deletion of documents whose trash recovery window has
 * elapsed. Kept separate from request handling so the destructive purge only
 * runs on the cron schedule.
 */
@Injectable()
export class TrashPurgeService {
  private readonly logger = new Logger(TrashPurgeService.name);

  constructor(private readonly documentsService: DocumentsService) {}

  /** Runs at 02:00 every day (server local time). */
  @Cron('0 2 * * *', { name: 'trash-purge' })
  async handlePurge() {
    const result = await this.documentsService.purgeExpiredTrash();
    if (result.purged > 0 || result.failed > 0) {
      this.logger.log(
        `Trash purge: ${result.purged} purged, ${result.failed} failed`,
      );
    }
    return result;
  }
}
