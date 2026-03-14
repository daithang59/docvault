import { Injectable } from '@nestjs/common';
import { Prisma, AuditAction, DocumentStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(
    tx: Prisma.TransactionClient | PrismaService,
    params: {
      documentId?: string | null;
      actorId: string;
      actorRole?: string | null;
      action: AuditAction;
      fromStatus?: DocumentStatus | null;
      toStatus?: DocumentStatus | null;
      detail?: string | null;
    },
  ) {
    return (tx as PrismaService).auditLog.create({
      data: {
        documentId: params.documentId ?? null,
        actorId: params.actorId,
        actorRole: params.actorRole ?? null,
        action: params.action,
        fromStatus: params.fromStatus ?? null,
        toStatus: params.toStatus ?? null,
        detail: params.detail ?? null,
      },
    });
  }

  listForDocument(documentId: string) {
    return this.prisma.auditLog.findMany({
      where: { documentId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
