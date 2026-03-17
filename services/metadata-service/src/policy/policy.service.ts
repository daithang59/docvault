import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AclEffect,
  AclSubjectType,
  DocumentPermission,
} from '../../generated/prisma';
import { createHmac } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuditClient } from '../audit/audit.client';
import { DownloadAuthorizeDto } from './dto/download-authorize.dto';
import {
  RequestContext,
  ServiceUser,
  buildActorId,
} from '../common/request-context';

@Injectable()
export class PolicyService {
  private readonly expiresInSeconds = 300;

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditClient: AuditClient,
  ) {}

  async authorizeDownload(
    docId: string,
    dto: DownloadAuthorizeDto,
    user: ServiceUser,
    context: RequestContext,
  ) {
    const document = await this.prisma.document.findUnique({
      where: { id: docId },
      include: { aclEntries: true },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    const actorId = buildActorId(user);
    const roles = user.roles ?? [];
    const requestedVersion = dto.version ?? document.currentVersion;
    const deniedReason = this.getDeniedReason(document.status, roles);

    if (!requestedVersion || requestedVersion < 1) {
      await this.auditClient.emitEvent(context, {
        action: 'DOCUMENT_DOWNLOAD_AUTHORIZED',
        resourceType: 'DOCUMENT',
        resourceId: docId,
        result: 'DENY',
        reason: 'Document has no uploaded version',
      });
      throw new ForbiddenException('Document has no uploaded version');
    }

    const versionRecord = await this.prisma.documentVersion.findUnique({
      where: {
        docId_version: {
          docId,
          version: requestedVersion,
        },
      },
    });

    if (!versionRecord) {
      throw new NotFoundException('Document version not found');
    }

    if (deniedReason) {
      await this.auditClient.emitEvent(context, {
        action: 'DOCUMENT_DOWNLOAD_AUTHORIZED',
        resourceType: 'DOCUMENT',
        resourceId: docId,
        result: 'DENY',
        reason: deniedReason,
      });
      throw new ForbiddenException(deniedReason);
    }

    if (this.matchesAcl(document.aclEntries, actorId, roles, AclEffect.DENY)) {
      await this.auditClient.emitEvent(context, {
        action: 'DOCUMENT_DOWNLOAD_AUTHORIZED',
        resourceType: 'DOCUMENT',
        resourceId: docId,
        result: 'DENY',
        reason: 'Download denied by ACL',
      });
      throw new ForbiddenException('Download denied by ACL');
    }

    const hasExplicitAllow = this.matchesAcl(
      document.aclEntries,
      actorId,
      roles,
      AclEffect.ALLOW,
    );
    const hasDefaultRoleAccess = roles.some((role) =>
      ['viewer', 'editor', 'approver', 'admin'].includes(role),
    );

    if (
      !hasExplicitAllow &&
      actorId !== document.ownerId &&
      !hasDefaultRoleAccess
    ) {
      await this.auditClient.emitEvent(context, {
        action: 'DOCUMENT_DOWNLOAD_AUTHORIZED',
        resourceType: 'DOCUMENT',
        resourceId: docId,
        result: 'DENY',
        reason: 'Download policy denied',
      });
      throw new ForbiddenException('Download policy denied');
    }

    const expiresAt = new Date(Date.now() + this.expiresInSeconds * 1000);

    await this.auditClient.emitEvent(context, {
      action: 'DOCUMENT_DOWNLOAD_AUTHORIZED',
      resourceType: 'DOCUMENT',
      resourceId: docId,
      result: 'SUCCESS',
    });

    return {
      docId,
      version: versionRecord.version,
      objectKey: versionRecord.objectKey,
      filename: versionRecord.filename,
      contentType: versionRecord.contentType,
      expiresInSeconds: this.expiresInSeconds,
      expiresAt: expiresAt.toISOString(),
      grantToken: this.createGrantToken({
        actorId,
        docId,
        version: versionRecord.version,
        objectKey: versionRecord.objectKey,
        filename: versionRecord.filename,
        contentType: versionRecord.contentType ?? undefined,
        expiresAt: expiresAt.toISOString(),
      }),
    };
  }

  private getDeniedReason(status: string, roles: string[]): string | null {
    if (roles.includes('compliance_officer')) {
      return 'Compliance officers are never allowed to download files';
    }
    if (status !== 'PUBLISHED') {
      return 'Only published documents can be downloaded';
    }
    return null;
  }

  private matchesAcl(
    aclEntries: Array<{
      subjectType: AclSubjectType;
      subjectId: string | null;
      permission: DocumentPermission;
      effect: AclEffect;
    }>,
    actorId: string,
    roles: string[],
    effect: AclEffect,
  ) {
    return aclEntries.some((entry) => {
      if (entry.permission !== DocumentPermission.DOWNLOAD) {
        return false;
      }
      if (entry.effect !== effect) {
        return false;
      }
      if (entry.subjectType === AclSubjectType.ALL) {
        return true;
      }
      if (entry.subjectType === AclSubjectType.USER) {
        return entry.subjectId === actorId;
      }
      if (entry.subjectType === AclSubjectType.ROLE) {
        return entry.subjectId ? roles.includes(entry.subjectId) : false;
      }
      return false;
    });
  }

  private createGrantToken(payload: {
    actorId: string;
    docId: string;
    version: number;
    objectKey: string;
    filename: string;
    contentType?: string;
    expiresAt: string;
  }) {
    const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = createHmac(
      'sha256',
      process.env.DOWNLOAD_GRANT_SECRET ?? 'docvault-download-grant-secret',
    )
      .update(encoded)
      .digest('base64url');

    return `${encoded}.${signature}`;
  }
}
