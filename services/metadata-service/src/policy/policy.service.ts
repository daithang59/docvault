import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AclEffect,
  AclSubjectType,
  ClassificationLevel,
  DocumentPermission,
} from '../../generated/prisma';
import { createHmac } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuditClient } from '../audit/audit.client';
import { DownloadAuthorizeDto } from './dto/download-authorize.dto';
import { PreviewAuthorizeDto } from './dto/preview-authorize.dto';
import {
  RequestContext,
  ServiceUser,
  buildActorId,
} from '../common/request-context';
import { CLASSIFICATION_WATERMARK_LEVELS } from '../common/classification.constants';

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
      throw new ForbiddenException(deniedReason);
    }

    if (this.matchesAcl(document.aclEntries, actorId, roles, AclEffect.DENY)) {
      throw new ForbiddenException('Download denied by ACL');
    }

    const hasExplicitAllow = this.matchesAcl(
      document.aclEntries,
      actorId,
      roles,
      AclEffect.ALLOW,
    );

    // --- Classification-based access check ---
    const classificationReason = this.getClassificationDeniedReason(
      document.classification as ClassificationLevel,
      roles,
      actorId,
      document.ownerId,
      hasExplicitAllow,
    );

    if (classificationReason) {
      throw new ForbiddenException(classificationReason);
    }

    const expiresAt = new Date(Date.now() + this.expiresInSeconds * 1000);

    await this.auditClient.emitEvent(context, {
      action: 'DOCUMENT_DOWNLOAD_AUTHORIZED',
      resourceType: 'DOCUMENT',
      resourceId: docId,
      result: 'SUCCESS',
      metadata: {
        docId,
        title: null,
        classification: document.classification,
        status: document.status,
        version: requestedVersion,
        objectKey: versionRecord.objectKey,
        filename: versionRecord.filename,
        contentType: versionRecord.contentType ?? null,
        fileSize: versionRecord.size,
        checksum: versionRecord.checksum,
        actorId,
        roles,
        expiresAt: expiresAt.toISOString(),
      },
    });

    return {
      docId,
      version: versionRecord.version,
      objectKey: versionRecord.objectKey,
      filename: versionRecord.filename,
      contentType: versionRecord.contentType,
      expiresInSeconds: this.expiresInSeconds,
      expiresAt: expiresAt.toISOString(),
      classification: document.classification,
      watermarkRequired:
        CLASSIFICATION_WATERMARK_LEVELS[
          document.classification as ClassificationLevel
        ],
      grantToken: this.createGrantToken({
        actorId,
        docId,
        version: versionRecord.version,
        objectKey: versionRecord.objectKey,
        filename: versionRecord.filename,
        contentType: versionRecord.contentType ?? undefined,
        expiresAt: expiresAt.toISOString(),
        classification: document.classification,
        watermarkRequired:
          CLASSIFICATION_WATERMARK_LEVELS[
            document.classification as ClassificationLevel
          ],
      }),
    };
  }

  async authorizePreview(
    docId: string,
    dto: PreviewAuthorizeDto,
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

    if (!requestedVersion || requestedVersion < 1) {
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

    // NOTE: compliance_officer is allowed here — preview is not download
    const statusDeniedReason = this.getPreviewDeniedReason(document.status);
    if (statusDeniedReason) {
      throw new ForbiddenException(statusDeniedReason);
    }

    if (
      this.matchesPreviewAcl(
        document.aclEntries,
        actorId,
        roles,
        AclEffect.DENY,
      )
    ) {
      throw new ForbiddenException('Preview denied by ACL');
    }

    const hasExplicitAllow = this.matchesPreviewAcl(
      document.aclEntries,
      actorId,
      roles,
      AclEffect.ALLOW,
    );

    const classificationReason = this.getPreviewClassificationDeniedReason(
      document.classification as ClassificationLevel,
      roles,
      actorId,
      document.ownerId,
      hasExplicitAllow,
    );

    if (classificationReason) {
      throw new ForbiddenException(classificationReason);
    }

    const expiresAt = new Date(Date.now() + this.expiresInSeconds * 1000);

    await this.auditClient.emitEvent(context, {
      action: 'DOCUMENT_PREVIEW_AUTHORIZED',
      resourceType: 'DOCUMENT',
      resourceId: docId,
      result: 'SUCCESS',
      metadata: {
        docId,
        classification: document.classification,
        status: document.status,
        version: requestedVersion,
        filename: versionRecord.filename,
        contentType: versionRecord.contentType ?? null,
        actorId,
        roles,
        expiresAt: expiresAt.toISOString(),
      },
    });

    return {
      docId,
      version: versionRecord.version,
      objectKey: versionRecord.objectKey,
      filename: versionRecord.filename,
      contentType: versionRecord.contentType,
      expiresInSeconds: this.expiresInSeconds,
      expiresAt: expiresAt.toISOString(),
      classification: document.classification,
      grantToken: this.createPreviewGrantToken({
        actorId,
        docId,
        version: versionRecord.version,
        objectKey: versionRecord.objectKey,
        filename: versionRecord.filename,
        contentType: versionRecord.contentType ?? undefined,
        expiresAt: expiresAt.toISOString(),
        classification: document.classification,
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

  private getPreviewDeniedReason(_status: string): string | null {
    // Preview is allowed across workflow states as long as ACL/classification checks pass.
    return null;
  }

  private matchesPreviewAcl(
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
      if (entry.permission !== DocumentPermission.READ) {
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

  private createPreviewGrantToken(payload: {
    actorId: string;
    docId: string;
    version: number;
    objectKey: string;
    filename: string;
    contentType?: string;
    expiresAt: string;
    classification: string;
  }) {
    const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = createHmac(
      'sha256',
      process.env.PREVIEW_GRANT_SECRET ??
        process.env.DOWNLOAD_GRANT_SECRET ??
        'docvault-download-grant-secret',
    )
      .update(encoded)
      .digest('base64url');

    return `${encoded}.${signature}`;
  }

  private getPreviewClassificationDeniedReason(
    classification: ClassificationLevel,
    roles: string[],
    actorId: string,
    ownerId: string,
    hasExplicitAllow: boolean,
  ): string | null {
    // Preview-specific rule: admin can always preview when route-level auth passed.
    if (roles.includes('admin')) {
      return null;
    }

    // Approver can preview ALL classifications (highest non-admin authority)
    if (roles.includes('approver')) {
      return null;
    }

    return this.getClassificationDeniedReason(
      classification,
      roles,
      actorId,
      ownerId,
      hasExplicitAllow,
    );
  }

  private getClassificationDeniedReason(
    classification: ClassificationLevel,
    roles: string[],
    actorId: string,
    ownerId: string,
    hasExplicitAllow: boolean,
  ): string | null {
    switch (classification) {
      case 'PUBLIC':
        return null;

      case 'INTERNAL':
        if (
          !roles.some((r) =>
            ['viewer', 'editor', 'approver', 'admin'].includes(r),
          )
        ) {
          return 'INTERNAL documents require at least the viewer role';
        }
        return null;

      case 'CONFIDENTIAL':
        if (!roles.some((r) => ['editor', 'approver', 'admin'].includes(r))) {
          return 'CONFIDENTIAL documents require at least the editor role';
        }
        if (actorId !== ownerId && !hasExplicitAllow) {
          return 'CONFIDENTIAL documents require explicit ACL grant or document ownership';
        }
        return null;

      case 'SECRET':
        if (!roles.some((r) => ['approver', 'admin'].includes(r))) {
          return 'SECRET documents require at least the approver role';
        }
        if (actorId !== ownerId && !hasExplicitAllow) {
          return 'SECRET documents require explicit ACL grant or document ownership';
        }
        return null;

      default:
        return 'Unknown classification level';
    }
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
    classification: string;
    watermarkRequired: boolean;
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
