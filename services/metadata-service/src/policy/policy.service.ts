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
  normalizeGroups,
} from '../common/request-context';
import { CLASSIFICATION_WATERMARK_LEVELS } from '../common/classification.constants';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function getSigningSecret(baseName: string): { kid?: string; secret: string } {
  const kid = process.env.GRANT_TOKEN_CURRENT_KID?.trim();
  if (kid) {
    return {
      kid,
      secret: requireEnv(`${baseName}_${kid}`),
    };
  }

  return { secret: requireEnv(baseName) };
}

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
    const groups = this.getActorGroups(user, context);
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

    if (this.matchesAcl(document.aclEntries, actorId, roles, groups, AclEffect.DENY)) {
      throw new ForbiddenException('Download denied by ACL');
    }

    const hasExplicitAllow = this.matchesAcl(
      document.aclEntries,
      actorId,
      roles,
      groups,
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
        groups,
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
    const groups = this.getActorGroups(user, context);
    const requestedVersion = dto.version ?? document.currentVersion;

    if (roles.includes('compliance_officer')) {
      throw new ForbiddenException(
        'Compliance officers are not allowed to preview file content',
      );
    }

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

    const statusDeniedReason = this.getPreviewDeniedReason(document.status);
    if (statusDeniedReason) {
      throw new ForbiddenException(statusDeniedReason);
    }

    if (
      this.matchesPreviewAcl(
        document.aclEntries,
        actorId,
        roles,
        groups,
        AclEffect.DENY,
      )
    ) {
      throw new ForbiddenException('Preview denied by ACL');
    }

    const hasExplicitAllow = this.matchesPreviewAcl(
      document.aclEntries,
      actorId,
      roles,
      groups,
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
        groups,
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

  async assertCanReadMetadata(
    docId: string,
    user: ServiceUser,
    context: RequestContext,
  ) {
    const document = await this.prisma.document.findUnique({
      where: { id: docId },
      include: {
        versions: { orderBy: { version: 'desc' } },
        aclEntries: true,
      },
    });

    if (!document || document.status === 'DELETED') {
      throw new NotFoundException('Document not found');
    }

    const actorId = buildActorId(user);
    const roles = user.roles ?? context.roles ?? [];
    const groups = this.getActorGroups(user, context);

    const deny = async (reason: string) => {
      await this.auditClient.emitEvent(context, {
        action: 'DOCUMENT_METADATA_READ_DENIED',
        resourceType: 'DOCUMENT',
        resourceId: docId,
        result: 'DENY',
        reason,
        metadata: {
          docId,
          classification: document.classification,
          status: document.status,
          actorId,
          roles,
          groups,
        },
      });
      throw new ForbiddenException(reason);
    };

    if (
      this.matchesPreviewAcl(
        document.aclEntries,
        actorId,
        roles,
        groups,
        AclEffect.DENY,
      )
    ) {
      return deny('Metadata read denied by ACL');
    }

    if (roles.includes('admin')) {
      return document;
    }

    const hasExplicitReadAllow = this.matchesPreviewAcl(
      document.aclEntries,
      actorId,
      roles,
      groups,
      AclEffect.ALLOW,
    );

    if (actorId === document.ownerId || hasExplicitReadAllow) {
      return document;
    }

    if (roles.includes('compliance_officer')) {
      if (['PUBLISHED', 'ARCHIVED'].includes(document.status)) {
        return document;
      }
      return deny('Compliance officers can only read published or archived metadata');
    }

    if (roles.includes('approver')) {
      if (['PENDING', 'PUBLISHED', 'ARCHIVED'].includes(document.status)) {
        return document;
      }
      return deny('Approvers can only read pending, published, or archived metadata');
    }

    if (document.status !== 'PUBLISHED') {
      return deny('Only published documents are readable by this user');
    }

    const classification = document.classification as ClassificationLevel;

    if (classification === 'PUBLIC') {
      return document;
    }

    if (
      classification === 'INTERNAL' &&
      roles.some((role) => ['viewer', 'editor'].includes(role))
    ) {
      return document;
    }

    if (
      classification === 'CONFIDENTIAL' &&
      roles.includes('editor') &&
      hasExplicitReadAllow
    ) {
      return document;
    }

    return deny('Metadata read denied by classification policy');
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

  private getActorGroups(user: ServiceUser, context: RequestContext): string[] {
    return normalizeGroups([...(user.groups ?? []), ...(context.groups ?? [])]);
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
    groups: string[],
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
      if (entry.subjectType === AclSubjectType.GROUP) {
        return this.matchesGroupSubject(entry.subjectId, groups);
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
    const signing = getSigningSecret('PREVIEW_GRANT_SECRET');
    const tokenPayload = signing.kid ? { ...payload, kid: signing.kid } : payload;
    const encoded = Buffer.from(JSON.stringify(tokenPayload)).toString(
      'base64url',
    );
    const signature = createHmac('sha256', signing.secret)
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
    // Admin bypasses all classification-based restrictions
    if (roles.includes('admin')) {
      return null;
    }

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
    groups: string[],
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
      if (entry.subjectType === AclSubjectType.GROUP) {
        return this.matchesGroupSubject(entry.subjectId, groups);
      }
      return false;
    });
  }

  private matchesGroupSubject(
    subjectId: string | null,
    groups: string[],
  ): boolean {
    const normalizedSubject = normalizeGroups(subjectId ? [subjectId] : [])[0];
    return normalizedSubject ? groups.includes(normalizedSubject) : false;
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
    const signing = getSigningSecret('DOWNLOAD_GRANT_SECRET');
    const tokenPayload = signing.kid ? { ...payload, kid: signing.kid } : payload;
    const encoded = Buffer.from(JSON.stringify(tokenPayload)).toString(
      'base64url',
    );
    const signature = createHmac('sha256', signing.secret)
      .update(encoded)
      .digest('base64url');

    return `${encoded}.${signature}`;
  }
}
