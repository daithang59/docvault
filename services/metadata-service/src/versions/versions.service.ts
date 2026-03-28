import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateVersionDto } from './dto/create-version.dto';
import {
  ServiceUser,
  buildActorId,
} from '../common/request-context';

@Injectable()
export class VersionsService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async create(
    docId: string,
    dto: CreateVersionDto,
    user: ServiceUser,
  ) {
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
        },
      });

      await tx.document.update({
        where: { id: docId },
        data: { currentVersion: dto.version },
      });

      return created;
    });

    return versionRecord;
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
