import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ServiceUser } from '../common/request-context';
import { buildActorId } from '../common/request-context';

@Injectable()
export class CommentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(docId: string, content: string, user: ServiceUser) {
    return this.prisma.documentComment.create({
      data: {
        docId,
        authorId: buildActorId(user),
        content,
      },
    });
  }

  async findByDoc(docId: string) {
    return this.prisma.documentComment.findMany({
      where: { docId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
