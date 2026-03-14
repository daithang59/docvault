import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDocumentDto } from './dto/create-document.dto';

@Injectable()
export class DocumentsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.documentMetadata.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  create(dto: CreateDocumentDto, user: { sub: string; username?: string }) {
    return this.prisma.documentMetadata.create({
      data: {
        title: dto.title,
        description: dto.description,
        filename: dto.filename,
        contentType: dto.contentType,
        ownerId: user.username ?? user.sub,
      },
    });
  }
}
