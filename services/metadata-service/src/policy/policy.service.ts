import {
  BadRequestException,
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
import { createHash, createHmac } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuditClient } from '../audit/audit.client';
import { OrgService } from '../org/org.service';
import { DownloadAuthorizeDto } from './dto/download-authorize.dto';
import { PreviewAuthorizeDto } from './dto/preview-authorize.dto';
import { AccessImpactDto } from './dto/access-impact.dto';
import {
  RequestContext,
  ServiceUser,
  buildActorId,
  normalizeGroups,
} from '../common/request-context';
import { CLASSIFICATION_WATERMARK_LEVELS } from '../common/classification.constants';

type AiGuardrailOperation =
  | 'METADATA_CLASSIFICATION'
  | 'METADATA_TAGGING'
  | 'CONTENT_SUMMARIZATION'
  | 'CONTENT_QA';

type SimulatedRole =
  | 'viewer'
  | 'editor'
  | 'approver'
  | 'compliance_officer'
  | 'admin';

const SIMULATED_ROLES: SimulatedRole[] = [
  'viewer',
  'editor',
  'approver',
  'compliance_officer',
  'admin',
];

const SHARE_LINK_RECIPIENT_ROLES = new Set([
  'viewer',
  'editor',
  'approver',
  'admin',
]);

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
    private readonly orgService: OrgService,
  ) {}

  async authorizeDownload(
    docId: string,
    dto: DownloadAuthorizeDto,
    user: ServiceUser,
    context: RequestContext,
    options: { shareToken?: string } = {},
  ) {
    const organizationId = await this.orgService.requireOrgId(context.actorId);
    const document = await this.prisma.document.findFirst({
      where: { id: docId, organizationId },
      include: { aclEntries: true },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    const shareGrant = await this.resolveShareGrant(docId, options.shareToken);
    const shareAllowsDownload = shareGrant === 'DOWNLOAD';

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

    if (!shareAllowsDownload) {
      if (
        this.matchesAcl(
          document.aclEntries,
          actorId,
          roles,
          groups,
          AclEffect.DENY,
        )
      ) {
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
    options: { shareToken?: string } = {},
  ) {
    const organizationId = await this.orgService.requireOrgId(context.actorId);
    const document = await this.prisma.document.findFirst({
      where: { id: docId, organizationId },
      include: { aclEntries: true },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    const shareGrant = await this.resolveShareGrant(docId, options.shareToken);
    const shareAllowsPreview =
      shareGrant === 'VIEW' || shareGrant === 'DOWNLOAD';

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

    const statusDeniedReason = this.getPreviewDeniedReason();
    if (statusDeniedReason) {
      throw new ForbiddenException(statusDeniedReason);
    }

    if (!shareAllowsPreview) {
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
    options: { shareToken?: string } = {},
  ) {
    const organizationId = await this.orgService.requireOrgId(context.actorId);
    const document = await this.prisma.document.findFirst({
      where: { id: docId, organizationId },
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
    const shareGrant = await this.resolveShareGrant(docId, options.shareToken);
    const shareAllowsMetadata =
      (shareGrant === 'VIEW' || shareGrant === 'DOWNLOAD') &&
      roles.some((role) => SHARE_LINK_RECIPIENT_ROLES.has(role));

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

    if (shareAllowsMetadata) {
      return document;
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

    // A DOWNLOAD allow is strictly stronger than READ: anyone who may download
    // the file may also read its metadata. Treat it as a metadata-read grant.
    const hasExplicitDownloadAllow = this.matchesAcl(
      document.aclEntries,
      actorId,
      roles,
      groups,
      AclEffect.ALLOW,
    );

    if (
      actorId === document.ownerId ||
      hasExplicitReadAllow ||
      hasExplicitDownloadAllow
    ) {
      return document;
    }

    if (roles.includes('compliance_officer')) {
      if (['PUBLISHED', 'ARCHIVED'].includes(document.status)) {
        return document;
      }
      return deny(
        'Compliance officers can only read published or archived metadata',
      );
    }

    if (roles.includes('approver')) {
      if (['PENDING', 'PUBLISHED', 'ARCHIVED'].includes(document.status)) {
        return document;
      }
      return deny(
        'Approvers can only read pending, published, or archived metadata',
      );
    }

    if (!['PUBLISHED', 'ARCHIVED'].includes(document.status)) {
      return deny(
        'Only published or archived documents are readable by this user',
      );
    }

    const classification = document.classification as ClassificationLevel;

    if (classification === 'PUBLIC') {
      return document;
    }

    if (
      classification === 'INTERNAL' &&
      roles.some((role) => ['editor'].includes(role))
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

  async getAiGuardrails(
    docId: string,
    user: ServiceUser,
    context: RequestContext,
  ) {
    const document = await this.assertCanReadMetadata(docId, user, context);
    const actorId = buildActorId(user);
    const roles = user.roles ?? context.roles ?? [];
    const groups = this.getActorGroups(user, context);
    const allowedOperations: AiGuardrailOperation[] = [
      'METADATA_CLASSIFICATION',
      'METADATA_TAGGING',
    ];
    const deniedOperations: Array<{
      operation: AiGuardrailOperation;
      reason: string;
    }> = [];

    const contentDeniedReason = this.getAiContentDeniedReason(
      document,
      roles,
      actorId,
      groups,
    );

    if (contentDeniedReason) {
      deniedOperations.push(
        {
          operation: 'CONTENT_SUMMARIZATION',
          reason: contentDeniedReason,
        },
        {
          operation: 'CONTENT_QA',
          reason: contentDeniedReason,
        },
      );
    } else {
      allowedOperations.push('CONTENT_SUMMARIZATION', 'CONTENT_QA');
    }

    const result = {
      documentId: docId,
      actorId,
      classification: document.classification,
      status: document.status,
      canUseMetadata: true,
      canUseContent: !contentDeniedReason,
      allowedOperations,
      deniedOperations,
      guardrails: [
        'Build AI context only after metadata policy allows the document.',
        'Never include file content when canUseContent is false.',
        'Do not expose object keys, presigned URLs, preview grants, or download grants to AI prompts.',
        'AI answers must carry an audit event before they are shown to users.',
      ],
    };

    // Only audit when the guardrail actually restricts something. A plain page
    // view where every AI operation is allowed produces no security signal, and
    // emitting it on every render floods the activity timeline (this endpoint
    // runs once per document-detail load). Denials are the auditable decision —
    // matching how metadata-read only logs DENY, never routine allows.
    //
    // result stays SUCCESS: the evaluation succeeded and merely reports which
    // operations are unavailable. Marking it DENY would feed deny-burst and
    // repeated-deny detection, turning normal browsing by a restricted role
    // (e.g. compliance officer) into false anomaly signals.
    if (deniedOperations.length > 0) {
      await this.auditClient.emitEvent(context, {
        action: 'AI_GUARDRAILS_EVALUATED',
        resourceType: 'DOCUMENT',
        resourceId: docId,
        result: 'SUCCESS',
        metadata: {
          docId,
          actorId,
          roles,
          groups,
          classification: document.classification,
          status: document.status,
          canUseContent: result.canUseContent,
          allowedOperations,
          deniedOperations,
        },
      });
    }

    return result;
  }

  async getAccessImpactPreview(
    docId: string,
    dto: AccessImpactDto,
    user: ServiceUser,
    context: RequestContext,
  ) {
    if (!dto.classification) {
      throw new BadRequestException(
        'classification is required for access impact preview',
      );
    }

    const document = await this.assertCanReadMetadata(docId, user, context);
    const actorId = buildActorId(user);
    const roles = user.roles ?? context.roles ?? [];

    if (
      !roles.includes('admin') &&
      (actorId !== document.ownerId || !roles.includes('editor'))
    ) {
      throw new ForbiddenException(
        'Only the owner editor or admin can simulate access impact',
      );
    }

    const currentClassification =
      document.classification as ClassificationLevel;
    const proposedClassification = dto.classification as ClassificationLevel;
    const current = this.buildAccessImpactState(
      document.status,
      currentClassification,
    );
    const proposed = this.buildAccessImpactState(
      document.status,
      proposedClassification,
    );
    const roleImpacts = SIMULATED_ROLES.map((role) =>
      this.buildRoleImpact(
        role,
        document.status,
        currentClassification,
        proposedClassification,
      ),
    );
    const currentAccessCount = roleImpacts.reduce(
      (count, impact) =>
        count +
        Number(impact.metadata.current) +
        Number(impact.download.current),
      0,
    );
    const proposedAccessCount = roleImpacts.reduce(
      (count, impact) =>
        count +
        Number(impact.metadata.proposed) +
        Number(impact.download.proposed),
      0,
    );
    const accessExpanded = proposedAccessCount > currentAccessCount;
    const accessReduced = proposedAccessCount < currentAccessCount;
    const watermarkReduced =
      current.watermarkRequired && !proposed.watermarkRequired;
    const dlpOverrideRequired =
      (document as any).dlpStatus === 'DETECTED' &&
      ['PUBLIC', 'INTERNAL'].includes(proposedClassification);
    const warnings = [
      ...(accessExpanded
        ? ['Proposed classification expands baseline access.']
        : []),
      ...(accessReduced
        ? ['Proposed classification reduces baseline access.']
        : []),
      ...(watermarkReduced
        ? ['Watermarking would no longer be required.']
        : []),
      ...(dlpOverrideRequired
        ? ['DLP-detected downgrade requires admin override reason.']
        : []),
    ];

    const result = {
      documentId: docId,
      current,
      proposed,
      changes: {
        accessExpanded,
        accessReduced,
        watermarkReduced,
        dlpOverrideRequired,
        warnings,
      },
      roleImpacts,
      guardrails: [
        'This is a policy simulation only; backend authorization remains authoritative.',
        'Baseline role impact does not enumerate real users or expose file content.',
        'ACL DENY entries and final mutation guards still apply at execution time.',
      ],
    };

    await this.auditClient.emitEvent(context, {
      action: 'DOCUMENT_ACCESS_IMPACT_SIMULATED',
      resourceType: 'DOCUMENT',
      resourceId: docId,
      result: 'SUCCESS',
      metadata: {
        docId,
        actorId,
        roles,
        currentClassification,
        proposedClassification,
        changes: result.changes,
      },
    });

    return result;
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

  private getPreviewDeniedReason(): string | null {
    // Preview is allowed across workflow states as long as ACL/classification checks pass.
    return null;
  }

  private getActorGroups(user: ServiceUser, context: RequestContext): string[] {
    return normalizeGroups([...(user.groups ?? []), ...(context.groups ?? [])]);
  }

  private buildAccessImpactState(
    status: string,
    classification: ClassificationLevel,
  ) {
    return {
      classification,
      status,
      watermarkRequired: CLASSIFICATION_WATERMARK_LEVELS[classification],
    };
  }

  private buildRoleImpact(
    role: SimulatedRole,
    status: string,
    currentClassification: ClassificationLevel,
    proposedClassification: ClassificationLevel,
  ) {
    const metadata = {
      current: this.canBaselineReadMetadata(
        status,
        currentClassification,
        role,
      ),
      proposed: this.canBaselineReadMetadata(
        status,
        proposedClassification,
        role,
      ),
    };
    const download = {
      current: this.canBaselineDownload(status, currentClassification, role),
      proposed: this.canBaselineDownload(status, proposedClassification, role),
    };
    const notes = [
      ...this.buildImpactNotes(role, 'Metadata', metadata),
      ...this.buildImpactNotes(role, 'Download', download),
    ];

    return {
      role,
      metadata,
      download,
      notes,
    };
  }

  private buildImpactNotes(
    role: SimulatedRole,
    label: 'Metadata' | 'Download',
    impact: { current: boolean; proposed: boolean },
  ): string[] {
    if (!impact.current && impact.proposed) {
      return [`${label} becomes allowed for baseline ${role} role.`];
    }
    if (impact.current && !impact.proposed) {
      return [`${label} becomes denied for baseline ${role} role.`];
    }
    return [];
  }

  private canBaselineReadMetadata(
    status: string,
    classification: ClassificationLevel,
    role: SimulatedRole,
  ): boolean {
    if (role === 'admin') {
      return true;
    }
    if (role === 'compliance_officer') {
      return ['PUBLISHED', 'ARCHIVED'].includes(status);
    }
    if (role === 'approver') {
      return ['PENDING', 'PUBLISHED', 'ARCHIVED'].includes(status);
    }
    if (!['PUBLISHED', 'ARCHIVED'].includes(status)) {
      return false;
    }
    if (classification === 'PUBLIC') {
      return true;
    }
    if (classification === 'INTERNAL') {
      return role === 'editor';
    }
    return false;
  }

  private canBaselineDownload(
    status: string,
    classification: ClassificationLevel,
    role: SimulatedRole,
  ): boolean {
    const roles = [role];
    const statusReason = this.getDeniedReason(status, roles);
    if (statusReason) {
      return false;
    }

    return !this.getClassificationDeniedReason(
      classification,
      roles,
      `simulation:${role}`,
      'simulation:owner',
      false,
    );
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
    const tokenPayload = signing.kid
      ? { ...payload, kid: signing.kid }
      : payload;
    const encoded = Buffer.from(JSON.stringify(tokenPayload)).toString(
      'base64url',
    );
    const signature = createHmac('sha256', signing.secret)
      .update(encoded)
      .digest('base64url');

    return `${encoded}.${signature}`;
  }

  private getAiContentDeniedReason(
    document: {
      status: string;
      classification: ClassificationLevel | string;
      ownerId: string;
      currentVersion?: number | null;
      aclEntries: Array<{
        subjectType: AclSubjectType;
        subjectId: string | null;
        permission: DocumentPermission;
        effect: AclEffect;
      }>;
    },
    roles: string[],
    actorId: string,
    groups: string[],
  ): string | null {
    if (roles.includes('compliance_officer')) {
      return 'Compliance officers cannot use file content for AI operations';
    }

    if (document.status === 'DELETED') {
      return 'Deleted documents cannot be used for AI content operations';
    }

    if (!document.currentVersion || document.currentVersion < 1) {
      return 'Document has no uploaded version';
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
      return 'AI content access denied by ACL';
    }

    const hasExplicitAllow = this.matchesPreviewAcl(
      document.aclEntries,
      actorId,
      roles,
      groups,
      AclEffect.ALLOW,
    );

    return this.getPreviewClassificationDeniedReason(
      document.classification as ClassificationLevel,
      roles,
      actorId,
      document.ownerId,
      hasExplicitAllow,
    );
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

    // Owner can preview their own documents regardless of classification
    // (Practical Security model: allows owner to verify uploaded content)
    if (actorId === ownerId) {
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
        if (!roles.some((r) => ['editor', 'approver', 'admin'].includes(r))) {
          return 'INTERNAL documents require at least the editor role';
        }
        return null;

      case 'CONFIDENTIAL':
        // Option A: an explicit ACL ALLOW (or ownership) grants access regardless
        // of role tier. DENY is evaluated earlier by the caller and still wins.
        if (hasExplicitAllow || actorId === ownerId) {
          return null;
        }
        if (!roles.some((r) => ['editor', 'approver', 'admin'].includes(r))) {
          return 'CONFIDENTIAL documents require at least the editor role';
        }
        return 'CONFIDENTIAL documents require explicit ACL grant or document ownership';

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

  /**
   * Validate an optional share token for this document and return the granted
   * permission, or null when no valid share token applies. A token is valid
   * only when it matches the document, is not revoked, not expired, and has
   * not exceeded its access cap.
   */
  private async resolveShareGrant(
    docId: string,
    shareToken?: string,
  ): Promise<'VIEW' | 'DOWNLOAD' | null> {
    if (!shareToken || shareToken.trim().length === 0) {
      return null;
    }

    const tokenHash = createHash('sha256').update(shareToken).digest('hex');
    const link = await (this.prisma as any).documentShareLink.findUnique({
      where: { tokenHash },
    });

    if (!link || link.docId !== docId) {
      return null;
    }
    if (link.revokedAt) {
      return null;
    }
    if (new Date(link.expiresAt).getTime() <= Date.now()) {
      return null;
    }
    if (
      link.maxAccessCount != null &&
      link.accessCount >= link.maxAccessCount
    ) {
      return null;
    }

    return link.permission === 'DOWNLOAD' ? 'DOWNLOAD' : 'VIEW';
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
    const tokenPayload = signing.kid
      ? { ...payload, kid: signing.kid }
      : payload;
    const encoded = Buffer.from(JSON.stringify(tokenPayload)).toString(
      'base64url',
    );
    const signature = createHmac('sha256', signing.secret)
      .update(encoded)
      .digest('base64url');

    return `${encoded}.${signature}`;
  }
}
