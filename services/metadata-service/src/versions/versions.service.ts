import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateVersionDto } from './dto/create-version.dto';
import { ServiceUser, buildActorId } from '../common/request-context';

@Injectable()
export class VersionsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(docId: string, dto: CreateVersionDto, user: ServiceUser) {
    const document = await this.prisma.document.findUnique({
      where: { id: docId },
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

      if (dlpDetected) {
        documentUpdateData.dlpStatus = 'DETECTED';
        documentUpdateData.dlpFindings = dlpFindings;
        documentUpdateData.dlpDetectedAt = new Date();
        if (shouldEscalateClassification) {
          documentUpdateData.classification = 'CONFIDENTIAL';
        }
      } else if ((document as any).dlpStatus !== 'DETECTED') {
        documentUpdateData.dlpStatus = dlpStatus;
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
    const document = await this.prisma.document.findUnique({
      where: { id: docId },
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
