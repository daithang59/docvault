import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditClient } from '../audit/audit.client';
import { UpsertAclDto } from './dto/upsert-acl.dto';
import {
  RequestContext,
  ServiceUser,
  buildActorId,
  normalizeGroups,
} from '../common/request-context';
import { AclSubjectType } from '../../generated/prisma';

@Injectable()
export class AclService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditClient: AuditClient,
  ) {}

  async upsert(
    docId: string,
    dto: UpsertAclDto,
    user: ServiceUser,
    context: RequestContext,
  ) {
    const document = await this.prisma.document.findUnique({
      where: { id: docId },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    this.assertCanManage(document.ownerId, user);

    const subjectId = this.normalizeSubjectId(dto);
    if (dto.subjectType !== AclSubjectType.ALL && !subjectId) {
      throw new BadRequestException(
        'Subject ID is required unless subject type is ALL',
      );
    }

    const aclEntry = await this.prisma.documentAcl.create({
      data: {
        docId,
        subjectType: dto.subjectType,
        subjectId,
        permission: dto.permission,
        effect: dto.effect,
      },
    });

    await this.auditClient.emitEvent(context, {
      action: 'DOCUMENT_ACL_UPDATED',
      resourceType: 'DOCUMENT',
      resourceId: docId,
      result: 'SUCCESS',
      metadata: {
        docId,
        aclId: aclEntry.id,
        subjectType: dto.subjectType,
        subjectId,
        permission: dto.permission,
        effect: dto.effect,
      },
    });

    return aclEntry;
  }

  list(docId: string) {
    return this.prisma.documentAcl.findMany({
      where: { docId },
      orderBy: { id: 'asc' },
    });
  }

  async delete(
    docId: string,
    aclId: string,
    user: ServiceUser,
    context: RequestContext,
  ) {
    const document = await this.prisma.document.findUnique({
      where: { id: docId },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    this.assertCanManage(document.ownerId, user);

    const aclEntry = await this.prisma.documentAcl.findUnique({
      where: { id: aclId },
    });

    if (!aclEntry || aclEntry.docId !== docId) {
      throw new NotFoundException('ACL entry not found');
    }

    await this.prisma.documentAcl.delete({ where: { id: aclId } });

    await this.auditClient.emitEvent(context, {
      action: 'DOCUMENT_ACL_DELETED',
      resourceType: 'DOCUMENT',
      resourceId: docId,
      result: 'SUCCESS',
      metadata: {
        docId,
        removedAclId: aclId,
        removedSubjectId: aclEntry.subjectId,
        removedSubjectType: aclEntry.subjectType,
        removedPermission: aclEntry.permission,
        removedEffect: aclEntry.effect,
        removedBy: buildActorId(user),
      },
    });
  }

  private assertCanManage(ownerId: string, user: ServiceUser) {
    const actorId = buildActorId(user);
    const roles = user.roles ?? [];
    if (
      (!roles.includes('editor') && !roles.includes('admin')) ||
      (ownerId !== actorId && !roles.includes('admin'))
    ) {
      throw new ForbiddenException(
        'Only the owner editor or admin can update ACL',
      );
    }
  }

  private normalizeSubjectId(dto: UpsertAclDto): string | undefined {
    if (dto.subjectType === AclSubjectType.ALL) {
      return undefined;
    }

    if (dto.subjectType === AclSubjectType.GROUP) {
      return normalizeGroups([dto.subjectId ?? ''])[0];
    }

    return dto.subjectId?.trim() || undefined;
  }
}
