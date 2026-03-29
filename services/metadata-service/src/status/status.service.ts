import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditClient } from '../audit/audit.client';
import { UpdateStatusDto } from './dto/update-status.dto';
import {
  RequestContext,
  ServiceUser,
  buildActorId,
} from '../common/request-context';

/**
 * MVP transition map:
 *  SUBMIT  : DRAFT     → PENDING
 *  APPROVE : PENDING   → PUBLISHED
 *  REJECT  : PENDING   → DRAFT
 *  ARCHIVE : PUBLISHED → ARCHIVED
 *  DELETE  : DRAFT     → DELETED
 */
const TRANSITION_MAP: Record<string, { from: string; to: string }> = {
  SUBMIT: { from: 'DRAFT', to: 'PENDING' },
  APPROVE: { from: 'PENDING', to: 'PUBLISHED' },
  REJECT: { from: 'PENDING', to: 'DRAFT' },
  ARCHIVE: { from: 'PUBLISHED', to: 'ARCHIVED' },
  DELETE: { from: 'DRAFT', to: 'DELETED' },
};

@Injectable()
export class StatusService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditClient: AuditClient,
  ) {}

  async update(
    docId: string,
    dto: UpdateStatusDto,
    user: ServiceUser,
    context: RequestContext,
  ) {
    const document = await this.prisma.document.findUnique({
      where: { id: docId },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    // --- Role guard ---
    const roles = user.roles ?? [];
    if (!roles.some((role) => ['editor', 'approver', 'admin'].includes(role))) {
      throw new ForbiddenException(
        'Only editor, approver, or admin can update status',
      );
    }

    // --- Transition guard ---
    const transition = TRANSITION_MAP[dto.action];
    if (!transition) {
      throw new BadRequestException(`Unknown workflow action: ${dto.action}`);
    }

    if (document.status !== transition.from) {
      throw new ConflictException(
        `Cannot ${dto.action} a document in status ${document.status}. ` +
          `Expected status: ${transition.from}`,
      );
    }

    if (dto.status !== transition.to) {
      throw new BadRequestException(
        `Action ${dto.action} must set status to ${transition.to}, ` +
          `but got ${dto.status}`,
      );
    }

    // --- Build update data ---
    const updateData: Record<string, any> = { status: transition.to };

    if (dto.action === 'APPROVE') {
      updateData.publishedAt = new Date();
    }
    if (dto.action === 'ARCHIVE') {
      updateData.archivedAt = new Date();
    }
    if (dto.action === 'DELETE') {
      updateData.deletedAt = new Date();
    }

    const actorId = buildActorId(user);

    // --- Atomic: update status + insert workflow history ---
    const updated = await this.prisma.$transaction(async (tx) => {
      const updatedDoc = await tx.document.update({
        where: { id: docId },
        data: updateData,
      });

      await tx.documentWorkflowHistory.create({
        data: {
          docId,
          fromStatus: document.status as any,
          toStatus: transition.to as any,
          action: dto.action as any,
          actorId,
          reason: dto.reason,
        },
      });

      return updatedDoc;
    });

    // --- Emit audit event (fire-and-forget) ---
    await this.auditClient.emitEvent(context, {
      action: `DOCUMENT_${dto.action}`,
      resourceType: 'DOCUMENT',
      resourceId: docId,
      result: 'SUCCESS',
      reason: dto.reason ?? `${document.status} -> ${transition.to}`,
      metadata: {
        docId,
        title: document.title,
        fromStatus: document.status,
        toStatus: transition.to,
        action: dto.action,
        reason: dto.reason ?? null,
        actorId,
        publishedAt: updated.publishedAt ?? null,
        archivedAt: updated.archivedAt ?? null,
        deletedAt: updated.deletedAt ?? null,
        triggeredAt: new Date().toISOString(),
      },
    });

    return updated;
  }
}
