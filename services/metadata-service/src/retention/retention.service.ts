import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { AuditClient } from '../audit/audit.client';
import { ClassificationLevel } from '../../generated/prisma';
import {
  RETENTION_POLICY_BY_CLASSIFICATION,
  buildRetentionEvidence,
} from '../common/classification.constants';

const DAY_MS = 24 * 60 * 60 * 1000;
const DUE_SOON_DAYS = 14;

export type RetentionStatus = 'ACTIVE' | 'DUE_SOON' | 'OVERDUE' | 'ARCHIVED' | 'UNSET';

export interface RetentionEvidenceRecord {
  docId: string;
  title: string;
  status: string;
  classification: ClassificationLevel;
  publishedAt: string | null;
  archivedAt: string | null;
  retentionClass: string | null;
  retentionUntil: string | null;
  retentionReason: string | null;
  retentionStatus: RetentionStatus;
  daysRemaining: number | null;
}

export interface RetentionEvidenceResult {
  checkedAt: string;
  summary: {
    tracked: number;
    active: number;
    dueSoon: number;
    overdue: number;
    archived: number;
  };
  records: RetentionEvidenceRecord[];
}

export interface RetentionRunOptions {
  now?: Date;
  requestedBy?: string;
}

export interface RetentionRunResult {
  archived: number;
  skipped: number;
  checkedAt: string;
}

@Injectable()
export class RetentionService {
  private readonly logger = new Logger(RetentionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditClient: AuditClient,
  ) {}

  /** Runs at 01:00 every day (server local time) */
  @Cron('0 1 * * *', { name: 'retention-auto-archive' })
  async handleRetention() {
    return this.runRetention();
  }

  async runRetention(options: RetentionRunOptions = {}): Promise<RetentionRunResult> {
    const now = options.now ?? new Date();
    const requestedBy = options.requestedBy ?? 'system:cron';
    this.logger.log('Starting retention auto-archive job...');

    const candidates = await this.prisma.document.findMany({
      where: {
        status: 'PUBLISHED',
        publishedAt: { not: null },
        archivedAt: null,
      },
      select: {
        id: true,
        title: true,
        status: true,
        classification: true,
        publishedAt: true,
        archivedAt: true,
        retentionClass: true,
        retentionUntil: true,
        retentionReason: true,
      },
    });

    let archived = 0;
    let skipped = 0;

    for (const doc of candidates) {
      const evidence = this.toEvidenceRecord(doc as any, now);
      if (!evidence.retentionUntil || evidence.retentionStatus !== 'OVERDUE') {
        continue;
      }

      try {
        await this.archiveDocument(doc as any, now, requestedBy);
        archived++;
      } catch (err) {
        this.logger.error(
          `Failed to auto-archive ${doc.id} (${doc.title}): ${(err as Error).message}`,
        );
        skipped++;
      }
    }

    this.logger.log(
      `Retention job done: ${archived} archived, ${skipped} skipped.`,
    );

    return {
      archived,
      skipped,
      checkedAt: now.toISOString(),
    };
  }

  async listRetentionEvidence(
    now = new Date(),
  ): Promise<RetentionEvidenceResult> {
    const documents = await this.prisma.document.findMany({
      where: {
        status: { in: ['PUBLISHED', 'ARCHIVED'] },
        publishedAt: { not: null },
      },
      orderBy: [{ retentionUntil: 'asc' }, { publishedAt: 'asc' }] as any,
      select: {
        id: true,
        title: true,
        status: true,
        classification: true,
        publishedAt: true,
        archivedAt: true,
        retentionClass: true,
        retentionUntil: true,
        retentionReason: true,
      },
    });

    const records = documents
      .map((doc) => this.toEvidenceRecord(doc as any, now))
      .sort((a, b) => {
        const aTime = a.retentionUntil
          ? new Date(a.retentionUntil).getTime()
          : Number.MAX_SAFE_INTEGER;
        const bTime = b.retentionUntil
          ? new Date(b.retentionUntil).getTime()
          : Number.MAX_SAFE_INTEGER;
        return aTime - bTime;
      });

    const summary = {
      tracked: records.length,
      active: records.filter((record) => record.retentionStatus === 'ACTIVE')
        .length,
      dueSoon: records.filter((record) => record.retentionStatus === 'DUE_SOON')
        .length,
      overdue: records.filter((record) => record.retentionStatus === 'OVERDUE')
        .length,
      archived: records.filter((record) => record.retentionStatus === 'ARCHIVED')
        .length,
    };

    return {
      checkedAt: now.toISOString(),
      summary,
      records,
    };
  }

  private toEvidenceRecord(
    doc: {
      id: string;
      title: string;
      status: string;
      classification: ClassificationLevel;
      publishedAt: Date | null;
      archivedAt: Date | null;
      retentionClass?: string | null;
      retentionUntil?: Date | null;
      retentionReason?: string | null;
    },
    now: Date,
  ): RetentionEvidenceRecord {
    const fallback =
      doc.publishedAt != null
        ? buildRetentionEvidence(doc.classification, doc.publishedAt)
        : null;
    const policy = RETENTION_POLICY_BY_CLASSIFICATION[doc.classification];
    const retentionClass =
      doc.retentionClass ?? fallback?.retentionClass ?? policy.retentionClass;
    const retentionUntil = doc.retentionUntil ?? fallback?.retentionUntil ?? null;
    const retentionReason =
      doc.retentionReason ?? fallback?.retentionReason ?? policy.reason;
    const daysRemaining =
      retentionUntil == null
        ? null
        : Math.ceil((retentionUntil.getTime() - now.getTime()) / DAY_MS);

    let retentionStatus: RetentionStatus = 'UNSET';
    if (doc.status === 'ARCHIVED') {
      retentionStatus = 'ARCHIVED';
    } else if (daysRemaining == null) {
      retentionStatus = 'UNSET';
    } else if (daysRemaining < 0) {
      retentionStatus = 'OVERDUE';
    } else if (daysRemaining <= DUE_SOON_DAYS) {
      retentionStatus = 'DUE_SOON';
    } else {
      retentionStatus = 'ACTIVE';
    }

    return {
      docId: doc.id,
      title: doc.title,
      status: doc.status,
      classification: doc.classification,
      publishedAt: doc.publishedAt?.toISOString() ?? null,
      archivedAt: doc.archivedAt?.toISOString() ?? null,
      retentionClass,
      retentionUntil: retentionUntil?.toISOString() ?? null,
      retentionReason,
      retentionStatus,
      daysRemaining,
    };
  }

  private async archiveDocument(
    doc: {
      id: string;
      title: string;
      classification: ClassificationLevel;
      publishedAt: Date | null;
      retentionClass?: string | null;
      retentionUntil?: Date | null;
      retentionReason?: string | null;
    },
    now: Date,
    requestedBy: string,
  ) {
    const docId = doc.id;
    const evidence = this.toEvidenceRecord(
      {
        ...doc,
        status: 'PUBLISHED',
        archivedAt: null,
      },
      now,
    );

    // Write directly — bypass StatusService since system jobs have no JWT
    await this.prisma.$transaction(async (tx) => {
      await tx.document.update({
        where: { id: docId },
        data: { status: 'ARCHIVED', archivedAt: now },
      });

      await tx.documentWorkflowHistory.create({
        data: {
          docId,
          fromStatus: 'PUBLISHED',
          toStatus: 'ARCHIVED',
          action: 'RETENTION',
          actorId: 'system:retention',
          reason: `Auto-archived by retention policy ${evidence.retentionClass}`,
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
          title: doc.title,
          classification: doc.classification,
          retentionClass: evidence.retentionClass,
          retentionUntil: evidence.retentionUntil,
          retentionReason: evidence.retentionReason,
          archivedAt: now.toISOString(),
          requestedBy,
          triggeredBy: 'system:retention',
          triggeredAt: now.toISOString(),
        },
      },
    );

    this.logger.log(`Auto-archived document: ${docId}`);
  }
}
