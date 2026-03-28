import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { AuditClient } from '../audit/audit.client';
import { CLASSIFICATION_RETENTION_DAYS } from '../common/classification.constants';
import { ClassificationLevel } from '../../generated/prisma';

@Injectable()
export class RetentionService {
  private readonly logger = new Logger(RetentionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditClient: AuditClient,
  ) {}

  /** Chạy lúc 01:00 mỗi ngày (giờ server local) */
  @Cron('0 1 * * *', { name: 'retention-auto-archive' })
  async handleRetention() {
    this.logger.log('Starting retention auto-archive job...');

    const now = new Date();
    let archived = 0;
    let skipped = 0;

    for (const [classification, retentionDays] of Object.entries(
      CLASSIFICATION_RETENTION_DAYS,
    )) {
      const cutoff = new Date(
        now.getTime() - retentionDays * 24 * 60 * 60 * 1000,
      );

      const candidates = await this.prisma.document.findMany({
        where: {
          status: 'PUBLISHED',
          classification: classification as ClassificationLevel,
          publishedAt: { not: null, lt: cutoff },
          archivedAt: null,
        },
        select: { id: true, title: true },
      });

      for (const doc of candidates) {
        try {
          await this.archiveDocument(doc.id);
          archived++;
        } catch (err) {
          this.logger.error(
            `Failed to auto-archive ${doc.id} (${doc.title}): ${(err as Error).message}`,
          );
          skipped++;
        }
      }
    }

    this.logger.log(
      `Retention job done: ${archived} archived, ${skipped} skipped.`,
    );
  }

  private async archiveDocument(docId: string) {
    // Ghi trực tiếp — không qua StatusService vì system job không có JWT
    await this.prisma.$transaction(async (tx) => {
      await tx.document.update({
        where: { id: docId },
        data: { status: 'ARCHIVED', archivedAt: new Date() },
      });

      await tx.documentWorkflowHistory.create({
        data: {
          docId,
          fromStatus: 'PUBLISHED',
          toStatus: 'ARCHIVED',
          action: 'RETENTION',
          actorId: 'system:retention',
          reason: 'Auto-archived by retention policy',
        },
      });
    });

    await this.auditClient.emitEvent(
      {
        actorId: 'system:retention',
        roles: ['admin'],
        traceId: 'retention-job',
        authorization: '',
        ip: '127.0.0.1',
      } as any,
      {
        action: 'DOCUMENT_AUTO_ARCHIVED',
        resourceType: 'DOCUMENT',
        resourceId: docId,
        result: 'SUCCESS',
        reason: 'Retention policy exceeded',
        metadata: {
          docId,
          action: 'RETENTION',
          fromStatus: 'PUBLISHED',
          toStatus: 'ARCHIVED',
          archivedAt: new Date().toISOString(),
          triggeredBy: 'system:retention',
          triggeredAt: new Date().toISOString(),
        },
      },
    );

    this.logger.log(`Auto-archived document: ${docId}`);
  }
}
