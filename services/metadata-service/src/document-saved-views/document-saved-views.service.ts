import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { RequestContext } from '../common/request-context';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateDocumentSavedViewDto,
  DocumentSavedViewScope,
} from './dto/create-document-saved-view.dto';

@Injectable()
export class DocumentSavedViewsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateDocumentSavedViewDto, context: RequestContext) {
    const scope = dto.scope ?? DocumentSavedViewScope.PRIVATE;

    if (scope === DocumentSavedViewScope.TEAM && !this.isAdmin(context)) {
      throw new ForbiddenException('Only admins can create team saved views');
    }

    return this.savedViews.create({
      data: {
        name: dto.name,
        description: dto.description,
        filters: dto.filters,
        scope,
        ownerId: context.actorId,
      },
    });
  }

  findAll(context: RequestContext) {
    return this.savedViews.findMany({
      where: {
        OR: [
          { scope: DocumentSavedViewScope.PRIVATE, ownerId: context.actorId },
          { scope: DocumentSavedViewScope.TEAM },
        ],
      },
      orderBy: [{ scope: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async delete(id: string, context: RequestContext) {
    const savedView = await this.savedViews.findUnique({ where: { id } });

    if (!savedView) {
      throw new NotFoundException('Document saved view not found');
    }

    const canDeletePrivate =
      savedView.scope === DocumentSavedViewScope.PRIVATE &&
      savedView.ownerId === context.actorId;
    const canDeleteTeam =
      savedView.scope === DocumentSavedViewScope.TEAM &&
      (savedView.ownerId === context.actorId || this.isAdmin(context));

    if (!canDeletePrivate && !canDeleteTeam) {
      throw new ForbiddenException('Not allowed to delete this saved view');
    }

    return this.savedViews.delete({ where: { id } });
  }

  private get savedViews() {
    return (this.prisma as any).documentSavedView;
  }

  private isAdmin(context: RequestContext) {
    return context.roles.includes('admin');
  }
}
