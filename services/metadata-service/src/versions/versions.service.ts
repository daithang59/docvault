import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OrgService } from '../org/org.service';
import { CreateVersionDto } from './dto/create-version.dto';
import { ServiceUser, buildActorId } from '../common/request-context';

@Injectable()
export class VersionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orgService: OrgService,
  ) {}

  async create(docId: string, dto: CreateVersionDto, user: ServiceUser) {
    const organizationId = await this.orgService.requireOrgId(
      buildActorId(user),
    );
    const document = await this.prisma.document.findFirst({
      where: { id: docId, organizationId },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    this.assertCanManage(document.ownerId, user);

    const expectedVersion = (document.currentVersion ?? 0) + 1;
    if (dto.version !== expectedVersion) {
      throw new ConflictException(
        `Version ${dto.version} is invalid. Expected ${expectedVersion}.`,
      );
    }

    const dlpStatus = dto.dlpStatus ?? 'NOT_SCANNED';
    const dlpFindings = dto.dlpFindings ?? [];
    const dlpDetected = dlpStatus === 'DETECTED';
    const currentClassification = document.classification as string;
    const shouldEscalateClassification =
      dlpDetected && ['PUBLIC', 'INTERNAL'].includes(currentClassification);

    const versionRecord = await this.prisma.$transaction(async (tx) => {
      const created = await tx.documentVersion.create({
        data: {
          docId,
          version: dto.version,
          objectKey: dto.objectKey,
          checksum: dto.checksum,
          size: dto.size,
          filename: dto.filename,
          contentType: dto.contentType,
          createdBy: buildActorId(user),
          dlpStatus,
          dlpFindings,
        } as any,
      });

      const documentUpdateData: Record<string, unknown> = {
        currentVersion: dto.version,
      };

      // The document-level DLP aggregate reflects the CURRENT version's scan
      // result, so it must follow the new version up (DETECTED) and down
      // (CLEAR/NOT_SCANNED). Historical detections are preserved on the version
      // record and in the immutable audit log, not by pinning this field.
      if (dlpDetected) {
        documentUpdateData.dlpStatus = 'DETECTED';
        documentUpdateData.dlpFindings = dlpFindings;
        documentUpdateData.dlpDetectedAt = new Date();
        // Classification only escalates on detection; de-escalation is left to a
        // human so an earlier CONFIDENTIAL label is never silently downgraded.
        if (shouldEscalateClassification) {
          documentUpdateData.classification = 'CONFIDENTIAL';
        }
      } else {
        documentUpdateData.dlpStatus = dlpStatus;
        documentUpdateData.dlpFindings = dlpFindings;
        documentUpdateData.dlpDetectedAt = null;
      }

      await tx.document.update({
        where: { id: docId },
        data: documentUpdateData as any,
      });

      return created;
    });

    return versionRecord;
  }

  /**
   * Restore a previous version by creating a new version that re-points to the
   * older version's stored file. This preserves history (no destructive
   * overwrite) while making the chosen version current again.
   */
  async restore(docId: string, sourceVersion: number, user: ServiceUser) {
    const organizationId = await this.orgService.requireOrgId(
      buildActorId(user),
    );
    const document = await this.prisma.document.findFirst({
      where: { id: docId, organizationId },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    this.assertCanManage(document.ownerId, user);

    const source = await this.prisma.documentVersion.findUnique({
      where: { docId_version: { docId, version: sourceVersion } },
    });

    if (!source) {
      throw new NotFoundException('Source version not found');
    }

    const nextVersion = (document.currentVersion ?? 0) + 1;
    if (sourceVersion === document.currentVersion) {
      throw new ConflictException('Cannot restore the current version');
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const newVersion = await tx.documentVersion.create({
        data: {
          docId,
          version: nextVersion,
          objectKey: source.objectKey,
          checksum: source.checksum,
          size: source.size,
          filename: source.filename,
          contentType: source.contentType,
          createdBy: buildActorId(user),
          dlpStatus: (source as any).dlpStatus ?? 'NOT_SCANNED',
          dlpFindings: (source as any).dlpFindings ?? [],
        } as any,
      });

      await tx.document.update({
        where: { id: docId },
        data: { currentVersion: nextVersion } as any,
      });

      return newVersion;
    });

    return created;
  }

  private assertCanManage(ownerId: string, user: ServiceUser) {
    const actorId = buildActorId(user);
    const roles = user.roles ?? [];
    if (
      (!roles.includes('editor') && !roles.includes('admin')) ||
      (ownerId !== actorId && !roles.includes('admin'))
    ) {
      throw new ForbiddenException(
        'Only the owner editor or admin can register versions',
      );
    }
  }
}
