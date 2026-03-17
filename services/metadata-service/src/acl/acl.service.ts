import {
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
} from '../common/request-context';

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

    const aclEntry = await this.prisma.documentAcl.create({
      data: {
        docId,
        subjectType: dto.subjectType,
        subjectId: dto.subjectId,
        permission: dto.permission,
        effect: dto.effect,
      },
    });

    await this.auditClient.emitEvent(context, {
      action: 'DOCUMENT_ACL_UPDATED',
      resourceType: 'DOCUMENT',
      resourceId: docId,
      result: 'SUCCESS',
    });

    return aclEntry;
  }

  list(docId: string) {
    return this.prisma.documentAcl.findMany({
      where: { docId },
      orderBy: { id: 'asc' },
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
}
